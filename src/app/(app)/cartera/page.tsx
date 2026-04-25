import { prisma } from "@/lib/prisma";
import { tasaDiariaCompound, proyectarTasa } from "@/lib/devaluacion";
import { CarteraClient } from "./cartera-client";

export const dynamic = "force-dynamic";

const MS_DIA = 1000 * 60 * 60 * 24;

const startOfDayUTC = (d: Date) => {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
};

/**
 * Cartera = dinero ya cobrado y depositado en cuentas, expuesto a la
 * devaluación del bolívar mientras espera salir (nómina, gastos, conversión).
 *
 * - Saldo base = ingreso clínica acumulado de los últimos 15 días
 *   (aproxima lo que aún no ha salido por nómina quincenal).
 * - Pérdida proyectada = pérdida USD adicional si el saldo se mantiene en Bs
 *   durante 1, 3, 7 o 15 días más, asumiendo que la devaluación diaria
 *   continúa al ritmo observado en los últimos 30 días.
 * - Proyección de tasa = valor estimado del Bs/$ a 7/15/30/45 días, persistido
 *   diariamente en TasaProyeccion para luego comparar contra la tasa real.
 */
export default async function CarteraPage() {
  // ── 1. Reportes recientes (60 días, suficiente para ventana de tasa diaria) ──
  const reportesRecientes = await prisma.dailyReport.findMany({
    orderBy: { fecha: "desc" },
    take: 60,
    select: {
      id: true,
      fecha: true,
      tasaCambio: true,
      consultas: { select: { porcentajeClinica: true } },
      servicios: { select: { totalBs: true } },
      anticipos: { select: { totalBs: true } },
      cuentasPorCobrar: { select: { totalBs: true } },
    },
  });

  if (reportesRecientes.length === 0) {
    return <CarteraClient empty />;
  }

  const tasaHoy = reportesRecientes[0].tasaCambio;
  const fechaHoy = reportesRecientes[0].fecha;

  // ── 2. Tasa de devaluación diaria compound (ventana ~30 días) ──
  const findTasaNDias = (n: number) => {
    const ref = reportesRecientes[0].fecha.getTime();
    const target = ref - n * MS_DIA;
    for (const r of reportesRecientes) {
      if (r.fecha.getTime() <= target) {
        return {
          tasa: r.tasaCambio,
          dias: Math.round((ref - r.fecha.getTime()) / MS_DIA),
        };
      }
    }
    const r = reportesRecientes[reportesRecientes.length - 1];
    return {
      tasa: r.tasaCambio,
      dias: Math.round((ref - r.fecha.getTime()) / MS_DIA),
    };
  };
  const { tasa: tasa30dAgo, dias: ventanaBaseDias } = findTasaNDias(30);
  const tasaDiaria = tasaDiariaCompound(tasa30dAgo, tasaHoy, ventanaBaseDias || 1);

  // ── 3. Saldo en cuentas: últimos 15 días incluyendo hoy ──
  const ultimos15 = reportesRecientes.filter(
    (r) => fechaHoy.getTime() - r.fecha.getTime() <= 14 * MS_DIA
  );

  const dias = ultimos15
    .map((r) => {
      const consClinicaUsd = r.consultas.reduce(
        (s, c) => s + c.porcentajeClinica,
        0
      );
      const consClinicaBs = consClinicaUsd * r.tasaCambio;
      const servBs = r.servicios.reduce((s, x) => s + x.totalBs, 0);
      const antBs = r.anticipos.reduce((s, x) => s + x.totalBs, 0);
      const cueBs = r.cuentasPorCobrar.reduce((s, x) => s + x.totalBs, 0);
      const ingresoBs = consClinicaBs + servBs + antBs + cueBs;
      const ingresoUsdOrigen =
        consClinicaUsd + (servBs + antBs + cueBs) / r.tasaCambio;
      const ingresoUsdHoy = tasaHoy > 0 ? ingresoBs / tasaHoy : 0;
      const perdidaUsd = ingresoUsdOrigen - ingresoUsdHoy;
      const diasTranscurridos = Math.max(
        0,
        Math.round((fechaHoy.getTime() - r.fecha.getTime()) / MS_DIA)
      );
      return {
        id: r.id,
        fecha: r.fecha.toISOString(),
        tasaDia: r.tasaCambio,
        diasTranscurridos,
        consClinicaBs,
        servBs,
        antBs,
        cueBs,
        ingresoBs,
        ingresoUsdOrigen,
        ingresoUsdHoy,
        perdidaUsd,
      };
    })
    .sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );

  const totales = {
    saldoBs: dias.reduce((s, d) => s + d.ingresoBs, 0),
    saldoUsdOrigen: dias.reduce((s, d) => s + d.ingresoUsdOrigen, 0),
    saldoUsdHoy: dias.reduce((s, d) => s + d.ingresoUsdHoy, 0),
    perdidaYaUsd: dias.reduce((s, d) => s + d.perdidaUsd, 0),
  };

  // ── 4. Pérdida proyectada sobre el saldo total a 1/3/7/15 días ──
  const HORIZONTES_PERDIDA = [1, 3, 7, 15];
  const proyPerdida = HORIZONTES_PERDIDA.map((d) => {
    const tasaFut = proyectarTasa(tasaHoy, d, tasaDiaria);
    const perdidaUsd =
      tasaHoy > 0 && tasaFut > 0
        ? totales.saldoBs / tasaHoy - totales.saldoBs / tasaFut
        : 0;
    return { dias: d, tasaProyectada: tasaFut, perdidaUsd };
  });

  // ── 5. Proyección de tasa a 7/15/30/45 días + persistencia ──
  const HORIZONTES_TASA = [7, 15, 30, 45];
  const fechaProyeccion = startOfDayUTC(fechaHoy);

  // Upsert proyecciones de hoy (idempotente: un upsert por día x horizonte)
  try {
    await Promise.all(
      HORIZONTES_TASA.map((d) => {
        const fechaObj = new Date(fechaProyeccion.getTime() + d * MS_DIA);
        const tasaFut = proyectarTasa(tasaHoy, d, tasaDiaria);
        return prisma.tasaProyeccion.upsert({
          where: {
            fechaProyeccion_diasAdelante: {
              fechaProyeccion,
              diasAdelante: d,
            },
          },
          create: {
            fechaProyeccion,
            diasAdelante: d,
            fechaObjetivo: fechaObj,
            tasaHoy,
            tasaDiariaPct: tasaDiaria,
            tasaProyectada: tasaFut,
          },
          update: {
            fechaObjetivo: fechaObj,
            tasaHoy,
            tasaDiariaPct: tasaDiaria,
            tasaProyectada: tasaFut,
          },
        });
      })
    );
  } catch (e) {
    console.error("[cartera] upsert TasaProyeccion falló:", e);
  }

  // ── 6. Backfill: proyecciones cuya fecha objetivo ya llegó pero sin tasa real ──
  try {
    const pendientes = await prisma.tasaProyeccion.findMany({
      where: {
        tasaRealAlObjetivo: null,
        fechaObjetivo: { lte: fechaProyeccion },
      },
    });
    for (const p of pendientes) {
      const objMs = p.fechaObjetivo.getTime();
      let candidato: { tasaCambio: number; fecha: Date } | null = null;
      let mejorDelta = Infinity;
      for (const r of reportesRecientes) {
        const delta = Math.abs(r.fecha.getTime() - objMs);
        if (delta < mejorDelta) {
          mejorDelta = delta;
          candidato = r;
        }
      }
      if (candidato && mejorDelta <= 5 * MS_DIA) {
        const tasaReal = candidato.tasaCambio;
        const dif =
          p.tasaProyectada > 0
            ? ((tasaReal - p.tasaProyectada) / p.tasaProyectada) * 100
            : 0;
        await prisma.tasaProyeccion.update({
          where: { id: p.id },
          data: { tasaRealAlObjetivo: tasaReal, diferenciaPct: dif },
        });
      }
    }
  } catch (e) {
    console.error("[cartera] backfill TasaProyeccion falló:", e);
  }

  // ── 7. Cargar histórico cumplido (esperado vs real) ──
  const historicoRaw = await prisma.tasaProyeccion.findMany({
    where: { tasaRealAlObjetivo: { not: null } },
    orderBy: { fechaObjetivo: "desc" },
    take: 30,
  });

  return (
    <CarteraClient
      empty={false}
      tasaHoy={tasaHoy}
      fechaHoy={fechaHoy.toISOString()}
      tasaDiariaPct={tasaDiaria * 100}
      ventanaBaseDias={ventanaBaseDias}
      dias={dias}
      totales={totales}
      proyPerdida={proyPerdida}
      proyTasa={HORIZONTES_TASA.map((d) => ({
        dias: d,
        tasaProyectada: proyectarTasa(tasaHoy, d, tasaDiaria),
        fechaObjetivo: new Date(
          fechaProyeccion.getTime() + d * MS_DIA
        ).toISOString(),
      }))}
      historico={historicoRaw.map((h) => ({
        id: h.id,
        fechaProyeccion: h.fechaProyeccion.toISOString(),
        fechaObjetivo: h.fechaObjetivo.toISOString(),
        diasAdelante: h.diasAdelante,
        tasaHoy: h.tasaHoy,
        tasaProyectada: h.tasaProyectada,
        tasaReal: h.tasaRealAlObjetivo ?? 0,
        diferenciaPct: h.diferenciaPct ?? 0,
      }))}
    />
  );
}
