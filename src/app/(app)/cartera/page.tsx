import { prisma } from "@/lib/prisma";
import { clasificarConvenio, perdidaCambiariaUsd } from "@/lib/devaluacion";
import { CarteraClient, type ConvenioAging } from "./cartera-client";

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

  // Tasa más reciente (del reporte más reciente)
  const ultimoReporte = await prisma.dailyReport.findFirst({
    orderBy: { fecha: "desc" },
    select: { fecha: true, tasaCambio: true },
  });
  const tasaHoy = ultimoReporte?.tasaCambio ?? 0;
  const fechaHoy = ultimoReporte?.fecha ?? new Date();

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

  const MS_DIA = 1000 * 60 * 60 * 24;

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
        apariciones: v.apariciones,
      };
    })
    .sort((a, b) => b.perdidaUsd - a.perdidaUsd);

  return (
    <CarteraClient
      convenios={convenios}
      tasaHoy={tasaHoy}
      fechaHoy={fechaHoy.toISOString()}
    />
  );
}
