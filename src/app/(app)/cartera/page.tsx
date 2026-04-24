import { prisma } from "@/lib/prisma";
import {
  clasificarConvenio,
  perdidaCambiariaUsd,
  perdidaProyectadaUsd,
  tasaDiariaCompound,
  proyectarTasa,
} from "@/lib/devaluacion";
import { CarteraClient, type ConvenioAging, type ProyeccionData } from "./cartera-client";

export const dynamic = "force-dynamic";

/**
 * Aging de cartera: agrupa las cuentas por cobrar por convenio.
 *
 * Supuesto: cada DailyReport lleva una "foto" del saldo en Bs.
 * - Origen = primera fecha en la que apareció el convenio.
 * - Saldo actual = última fecha reportada (foto más reciente).
 * - Pérdida cambiaria = diferencia en $ entre cobrar ese saldo en la fecha
 *   de origen vs cobrarlo hoy (ambos valorizados con el saldo Bs actual).
 */
export default async function CarteraPage() {
  const cuentas = await prisma.cuentaPorCobrar.findMany({
    include: {
      reporte: { select: { fecha: true, tasaCambio: true } },
    },
    orderBy: { reporte: { fecha: "asc" } },
  });

  // Historial reciente de tasas para calcular devaluación diaria compuesta
  const reportesRecientes = await prisma.dailyReport.findMany({
    orderBy: { fecha: "desc" },
    take: 60,
    select: { fecha: true, tasaCambio: true },
  });
  const tasaHoy = reportesRecientes[0]?.tasaCambio ?? 0;
  const fechaHoy = reportesRecientes[0]?.fecha ?? new Date();

  // Tasa diaria compound: usa ventana de ~30 días; si hay menos, usa lo disponible
  const MS_DIA = 1000 * 60 * 60 * 24;
  const findTasaNDias = (n: number): { tasa: number; dias: number } => {
    if (reportesRecientes.length === 0) return { tasa: 0, dias: 0 };
    const ref = reportesRecientes[0].fecha.getTime();
    const target = ref - n * MS_DIA;
    for (const r of reportesRecientes) {
      if (r.fecha.getTime() <= target) {
        const dias = Math.round((ref - r.fecha.getTime()) / MS_DIA);
        return { tasa: r.tasaCambio, dias };
      }
    }
    // No hay dato tan antiguo → usa el más viejo disponible
    const r = reportesRecientes[reportesRecientes.length - 1];
    const dias = Math.round((ref - r.fecha.getTime()) / MS_DIA);
    return { tasa: r.tasaCambio, dias };
  };

  const { tasa: tasa30dAgo, dias: dias30d } = findTasaNDias(30);
  const tasaDiaria = tasaDiariaCompound(tasa30dAgo, tasaHoy, dias30d || 1);
  const ventanaBaseDias = dias30d;

  // Agrupar por nombreConvenio normalizado
  const norm = (s: string) => s.trim().toUpperCase();
  const map = new Map<
    string,
    {
      nombreOriginal: string;
      primeraFecha: Date;
      tasaOrigen: number;
      ultimaFecha: Date;
      tasaUltima: number;
      saldoActualBs: number;
      saldoActualDivisa: number;
      apariciones: number;
    }
  >();

  for (const c of cuentas) {
    const key = norm(c.nombreConvenio);
    const fecha = c.reporte.fecha;
    const tasa = c.reporte.tasaCambio;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        nombreOriginal: c.nombreConvenio,
        primeraFecha: fecha,
        tasaOrigen: tasa,
        ultimaFecha: fecha,
        tasaUltima: tasa,
        saldoActualBs: c.totalBs,
        saldoActualDivisa: c.ingresoDivisa,
        apariciones: 1,
      });
    } else {
      if (fecha < existing.primeraFecha) {
        existing.primeraFecha = fecha;
        existing.tasaOrigen = tasa;
      }
      if (fecha >= existing.ultimaFecha) {
        existing.ultimaFecha = fecha;
        existing.tasaUltima = tasa;
        existing.saldoActualBs = c.totalBs;
        existing.saldoActualDivisa = c.ingresoDivisa;
      }
      existing.apariciones += 1;
    }
  }

  const convenios: ConvenioAging[] = Array.from(map.values())
    .map((v) => {
      const diasCartera = Math.max(
        0,
        Math.round((fechaHoy.getTime() - v.primeraFecha.getTime()) / MS_DIA)
      );
      const tipo = clasificarConvenio(v.nombreOriginal);
      const saldoOrigenUsd = v.tasaOrigen > 0 ? v.saldoActualBs / v.tasaOrigen : 0;
      const saldoActualUsd = tasaHoy > 0 ? v.saldoActualBs / tasaHoy : 0;
      const perdidaUsd = perdidaCambiariaUsd(v.saldoActualBs, v.tasaOrigen, tasaHoy);
      const perdidaPct = saldoOrigenUsd > 0 ? (perdidaUsd / saldoOrigenUsd) * 100 : 0;

      // Proyección: pérdida adicional si no se cobra en 30/60/90 días
      const perdidaProyectada30 = perdidaProyectadaUsd(v.saldoActualBs, tasaHoy, 30, tasaDiaria);
      const perdidaProyectada60 = perdidaProyectadaUsd(v.saldoActualBs, tasaHoy, 60, tasaDiaria);
      const perdidaProyectada90 = perdidaProyectadaUsd(v.saldoActualBs, tasaHoy, 90, tasaDiaria);

      return {
        nombre: v.nombreOriginal,
        tipo,
        primeraFecha: v.primeraFecha.toISOString(),
        ultimaFecha: v.ultimaFecha.toISOString(),
        diasCartera,
        tasaOrigen: v.tasaOrigen,
        tasaHoy,
        saldoActualBs: v.saldoActualBs,
        saldoActualDivisa: v.saldoActualDivisa,
        saldoOrigenUsd,
        saldoActualUsd,
        perdidaUsd,
        perdidaPct,
        perdidaProyectada30,
        perdidaProyectada60,
        perdidaProyectada90,
        apariciones: v.apariciones,
      };
    })
    .sort((a, b) => b.perdidaUsd - a.perdidaUsd);

  const proyeccion: ProyeccionData = {
    tasaDiariaPct: tasaDiaria * 100,
    ventanaBaseDias,
    tasaProy30: proyectarTasa(tasaHoy, 30, tasaDiaria),
    tasaProy60: proyectarTasa(tasaHoy, 60, tasaDiaria),
    tasaProy90: proyectarTasa(tasaHoy, 90, tasaDiaria),
  };

  return (
    <CarteraClient
      convenios={convenios}
      tasaHoy={tasaHoy}
      fechaHoy={fechaHoy.toISOString()}
      proyeccion={proyeccion}
    />
  );
}
