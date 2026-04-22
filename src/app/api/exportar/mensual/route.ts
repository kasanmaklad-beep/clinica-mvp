import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return new NextResponse("No autorizado", { status: 401 });

  const { searchParams } = new URL(req.url);
  const mes   = searchParams.get("mes");   // YYYY-MM
  const hasta = searchParams.get("hasta"); // YYYY-MM-DD (opcional)

  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    return new NextResponse("Parámetro 'mes' inválido", { status: 400 });
  }

  const [year, month] = mes.split("-").map(Number);
  const desdeDate = new Date(Date.UTC(year, month - 1, 1));
  const hastaDate =
    hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta)
      ? new Date(hasta + "T23:59:59.999Z")
      : new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const reports = await prisma.dailyReport.findMany({
    where: { fecha: { gte: desdeDate, lte: hastaDate } },
    orderBy: { fecha: "asc" },
    include: {
      consultas: {
        include: { especialidad: { select: { nombre: true } } },
      },
      servicios: {
        include: { unidadServicio: { select: { nombre: true, categoria: true } } },
      },
      anticipos: true,
      cuentasPorCobrar: true,
    },
  });

  if (reports.length === 0) {
    return new NextResponse("Sin reportes en el período seleccionado", { status: 404 });
  }

  // ─── Aggregation ───────────────────────────────────────────────────────────
  let totalClinicaUsd = 0, totalClinicaBs = 0, totalPacientes = 0;
  let consDiv = 0, consBs = 0, consPac = 0;
  let labDiv = 0,  labBs = 0,  labPac = 0;
  let imgDiv = 0,  imgBs = 0,  imgPac = 0;
  let antDiv = 0,  antBs = 0;
  let cueDiv = 0,  cueBs = 0,  cuePac = 0;

  const espMap = new Map<string, { clinica: number; pac: number }>();
  const dayRows: (string | number)[][] = [];

  for (const r of reports) {
    const tasa    = r.tasaCambio || 1;
    const labRows = r.servicios.filter(s => s.unidadServicio.categoria !== "IMAGENES");
    const imgRows = r.servicios.filter(s => s.unidadServicio.categoria === "IMAGENES");

    const dayConsPac     = r.consultas.reduce((s, x) => s + x.numPacientes, 0);
    const dayConsClinica = r.consultas.reduce((s, x) => s + x.porcentajeClinica, 0);
    const dayConsBs      = r.consultas.reduce((s, x) => s + x.totalBs, 0);
    const dayLabBs       = labRows.reduce((s, x) => s + x.totalBs, 0);
    const dayLabPac      = labRows.reduce((s, x) => s + x.numPacientes, 0);
    const dayImgBs       = imgRows.reduce((s, x) => s + x.totalBs, 0);
    const dayImgPac      = imgRows.reduce((s, x) => s + x.numPacientes, 0);
    const dayAntBs       = r.anticipos.reduce((s, a) => s + a.totalBs, 0);
    const dayCueBs       = r.cuentasPorCobrar.reduce((s, c) => s + c.totalBs, 0);
    const dayCuePac      = r.cuentasPorCobrar.reduce((s, c) => s + c.numPacientes, 0);

    const dayLabUsd = dayLabBs / tasa;
    const dayImgUsd = dayImgBs / tasa;
    const dayAntUsd = dayAntBs / tasa;
    const dayCueUsd = dayCueBs / tasa;

    const dayClinicaUsd = dayConsClinica + dayLabUsd + dayImgUsd + dayAntUsd + dayCueUsd;
    const dayClinicaBs  = dayConsClinica * tasa + dayLabBs + dayImgBs + dayAntBs + dayCueBs;
    const dayTotalPac   = dayConsPac + dayLabPac + dayImgPac + dayCuePac;

    totalClinicaUsd += dayClinicaUsd;
    totalClinicaBs  += dayClinicaBs;
    totalPacientes  += dayTotalPac;
    consDiv += dayConsClinica; consBs += dayConsBs; consPac += dayConsPac;
    labDiv  += dayLabUsd;      labBs  += dayLabBs;  labPac  += dayLabPac;
    imgDiv  += dayImgUsd;      imgBs  += dayImgBs;  imgPac  += dayImgPac;
    antDiv  += dayAntUsd;      antBs  += dayAntBs;
    cueDiv  += dayCueUsd;      cueBs  += dayCueBs;  cuePac  += dayCuePac;

    for (const c of r.consultas) {
      const e = espMap.get(c.especialidad.nombre) ?? { clinica: 0, pac: 0 };
      e.clinica += c.porcentajeClinica;
      e.pac     += c.numPacientes;
      espMap.set(c.especialidad.nombre, e);
    }

    dayRows.push([
      r.fecha.toISOString().slice(0, 10),
      tasa,
      dayConsPac,
      dayLabPac,
      dayImgPac,
      dayCuePac,
      dayTotalPac,
      round2(dayClinicaUsd),
      round2(dayClinicaBs),
      r.estado,
    ]);
  }

  const topEsp = Array.from(espMap.entries())
    .sort((a, b) => b[1].clinica - a[1].clinica)
    .slice(0, 5);

  const rpp       = totalPacientes > 0 ? totalClinicaUsd / totalPacientes : 0;
  const areaTotal = totalClinicaUsd || 1;

  // ─── Labels ────────────────────────────────────────────────────────────────
  const mesLabel = new Date(Date.UTC(year, month - 1, 1))
    .toLocaleDateString("es-VE", { month: "long", year: "numeric", timeZone: "UTC" });
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const fmt = (d: Date) =>
    d.toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

  // ─── Build workbook ────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();

  // ── Hoja 1: Resumen ────────────────────────────────────────────────────────
  const pct = (v: number) => round2((v / areaTotal) * 100) + "%";
  const rppArea = (usd: number, pac: number) => (pac > 0 ? round2(usd / pac) : "—");

  const resumenData: (string | number)[][] = [
    ["HOSPITAL CLÍNICAS DEL ESTE"],
    [`Reporte Mensual — ${capitalize(mesLabel)}`],
    [`Período: ${fmt(desdeDate)}  al  ${fmt(hastaDate)}`],
    [],
    ["INGRESO CLÍNICA"],
    ["Ingreso USD ($)",           round2(totalClinicaUsd)],
    ["Equivalente Bs.",           round2(totalClinicaBs)],
    ["Pacientes totales",         totalPacientes],
    ["Ingreso / paciente (USD)",  round2(rpp)],
    ["Días reportados",           reports.length],
    [],
    ["DESGLOSE POR ÁREA"],
    ["Área", "USD ($)", "Bs.", "Pacientes", "$ / pac.", "% del total"],
    ["Consultas",   round2(consDiv), round2(consBs), consPac, rppArea(consDiv, consPac), pct(consDiv)],
    ["Laboratorio", round2(labDiv),  round2(labBs),  labPac,  rppArea(labDiv,  labPac),  pct(labDiv)],
    ["Imágenes",    round2(imgDiv),  round2(imgBs),  imgPac,  rppArea(imgDiv,  imgPac),  pct(imgDiv)],
    ["Anticipos",   round2(antDiv),  round2(antBs),  "—",     "—",                       pct(antDiv)],
    ["Convenios",   round2(cueDiv),  round2(cueBs),  cuePac,  rppArea(cueDiv,  cuePac),  pct(cueDiv)],
    ["TOTAL",       round2(totalClinicaUsd), round2(totalClinicaBs), totalPacientes, round2(rpp), "100%"],
    [],
    ["TOP 5 ESPECIALIDADES (por % Clínica)"],
    ["#", "Especialidad", "Pacientes", "% Clínica USD ($)"],
    ...topEsp.map(([nombre, v], i) => [i + 1, nombre, v.pac, round2(v.clinica)]),
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(resumenData);
  ws1["!cols"] = [
    { wch: 32 }, { wch: 18 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, "Resumen");

  // ── Hoja 2: Detalle por día ────────────────────────────────────────────────
  const detailHeaders = [
    "Fecha",
    "Tasa (Bs/$)",
    "Pac. Consultas",
    "Pac. Laboratorio",
    "Pac. Imágenes",
    "Pac. Convenios",
    "Total Pacientes",
    "Clínica USD ($)",
    "Clínica Bs.",
    "Estado",
  ];
  const ws2 = XLSX.utils.aoa_to_sheet([detailHeaders, ...dayRows]);
  ws2["!cols"] = [
    { wch: 12 }, { wch: 13 }, { wch: 15 }, { wch: 17 },
    { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, "Detalle por día");

  // xlsx returns Buffer (Node.js); copy into a real ArrayBuffer for the Blob
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw   = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as any;
  const bytes = new Uint8Array(raw as ArrayLike<number>);
  const blob  = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const filename = hasta
    ? `clinica-${mes}-hasta-${hasta}.xlsx`
    : `clinica-${mes}-completo.xlsx`;

  return new NextResponse(blob, {
    status: 200,
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
