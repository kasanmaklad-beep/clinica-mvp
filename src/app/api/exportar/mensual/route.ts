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
      // Componentes en Bs (lo que entró a las cuentas)
      round2(dayConsClinica * tasa), // honorario clínica de consultas, en Bs
      round2(dayLabBs),
      round2(dayImgBs),
      round2(dayAntBs),
      round2(dayCueBs),
      // Componentes en USD (Bs/tasa, excepto consultas que ya viene en USD)
      round2(dayConsClinica),
      round2(dayLabUsd),
      round2(dayImgUsd),
      round2(dayAntUsd),
      round2(dayCueUsd),
      // Total del día (suma horizontal)
      round2(dayClinicaUsd),
      round2(dayClinicaBs),
      // Pacientes
      dayConsPac,
      dayLabPac,
      dayImgPac,
      dayCuePac,
      dayTotalPac,
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
    ["TOP 5 ESPECIALIDADES (por Ingreso Clínica $)"],
    ["#", "Especialidad", "Pacientes", "Ingreso Clínica USD ($)"],
    ...topEsp.map(([nombre, v], i) => [i + 1, nombre, v.pac, round2(v.clinica)]),
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(resumenData);
  ws1["!cols"] = [
    { wch: 32 }, { wch: 18 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, "Resumen");

  // ── Hoja 2: Detalle por día (con componentes para verificación manual) ─────
  const detailHeaders = [
    "Fecha",
    "Tasa (Bs/$)",
    // Componentes Bs
    "Consultas Bs (clínica)",
    "Laboratorio Bs",
    "Imágenes Bs",
    "Anticipos Bs",
    "Convenios Bs",
    // Componentes USD
    "Consultas $ (clínica)",
    "Laboratorio $",
    "Imágenes $",
    "Anticipos $",
    "Convenios $",
    // Totales del día
    "TOTAL CLÍNICA $",
    "TOTAL CLÍNICA Bs",
    // Pacientes
    "Pac. Consultas",
    "Pac. Laboratorio",
    "Pac. Imágenes",
    "Pac. Convenios",
    "Total Pacientes",
    "Estado",
  ];
  // Fila de totales al final (suma todas las columnas numéricas)
  const sumCol = (idx: number) =>
    dayRows.reduce((s, row) => s + (typeof row[idx] === "number" ? (row[idx] as number) : 0), 0);
  const totalRow: (string | number)[] = [
    "TOTAL MES",
    "—",
    round2(sumCol(2)),  // Consultas Bs
    round2(sumCol(3)),  // Lab Bs
    round2(sumCol(4)),  // Img Bs
    round2(sumCol(5)),  // Anticipos Bs
    round2(sumCol(6)),  // Convenios Bs
    round2(sumCol(7)),  // Consultas $
    round2(sumCol(8)),  // Lab $
    round2(sumCol(9)),  // Img $
    round2(sumCol(10)), // Anticipos $
    round2(sumCol(11)), // Convenios $
    round2(sumCol(12)), // TOTAL $
    round2(sumCol(13)), // TOTAL Bs
    sumCol(14),         // pac cons
    sumCol(15),         // pac lab
    sumCol(16),         // pac img
    sumCol(17),         // pac cue
    sumCol(18),         // total pac
    "",
  ];
  const ws2 = XLSX.utils.aoa_to_sheet([detailHeaders, ...dayRows, [], totalRow]);
  ws2["!cols"] = [
    { wch: 12 }, { wch: 12 },
    { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
    { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 18 }, { wch: 18 },
    { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, "Detalle por día");

  // ── Hoja 3: Líneas individuales (cada concepto del PDF, día por día) ───────
  const lineasHeaders = [
    "Fecha",
    "Tasa (Bs/$)",
    "Sección",
    "Concepto",
    "Pacientes",
    "Total Bs",
    "Total $ (PDF)",
    "% Clínica $ (consultas)",
    "Aporte Clínica $",
    "Cómo se calcula",
  ];
  const lineasRows: (string | number)[][] = [];
  for (const r of reports) {
    const tasa = r.tasaCambio || 1;
    const fechaStr = r.fecha.toISOString().slice(0, 10);
    for (const c of r.consultas) {
      lineasRows.push([
        fechaStr, tasa, "Consulta", c.especialidad.nombre,
        c.numPacientes, round2(c.totalBs), round2(c.ingresoDivisa),
        round2(c.porcentajeClinica),
        round2(c.porcentajeClinica),
        "= % Clínica $ (ya en USD)",
      ]);
    }
    for (const s of r.servicios) {
      const isImg = s.unidadServicio.categoria === "IMAGENES";
      lineasRows.push([
        fechaStr, tasa, isImg ? "Imágenes" : "Laboratorio", s.unidadServicio.nombre,
        s.numPacientes, round2(s.totalBs), round2(s.ingresoDivisa),
        "—",
        round2(s.totalBs / tasa),
        "= Total Bs / Tasa",
      ]);
    }
    for (const a of r.anticipos) {
      lineasRows.push([
        fechaStr, tasa, "Anticipo", a.tipo,
        "—", round2(a.totalBs), round2(a.ingresoDivisa),
        "—",
        round2(a.totalBs / tasa),
        "= Total Bs / Tasa",
      ]);
    }
    for (const c of r.cuentasPorCobrar) {
      lineasRows.push([
        fechaStr, tasa, "Convenio", c.nombreConvenio,
        c.numPacientes, round2(c.totalBs), round2(c.ingresoDivisa),
        "—",
        round2(c.totalBs / tasa),
        "= Total Bs / Tasa",
      ]);
    }
  }
  // Fila de total al final
  const sumLineasCol = (idx: number) =>
    lineasRows.reduce((s, row) => s + (typeof row[idx] === "number" ? (row[idx] as number) : 0), 0);
  const lineasTotal: (string | number)[] = [
    "TOTAL MES", "—", "", "",
    sumLineasCol(4) || "",
    round2(sumLineasCol(5)),
    round2(sumLineasCol(6)),
    "",
    round2(sumLineasCol(8)),
    "",
  ];
  const ws3 = XLSX.utils.aoa_to_sheet([lineasHeaders, ...lineasRows, [], lineasTotal]);
  ws3["!cols"] = [
    { wch: 12 }, { wch: 12 }, { wch: 13 }, { wch: 32 },
    { wch: 11 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, ws3, "Detalle líneas");

  // ── Hoja 4: Cómo se calcula (fórmula explicada) ────────────────────────────
  const explicacion: (string | number)[][] = [
    ["FÓRMULA DEL INGRESO CLÍNICA"],
    [],
    ["Por cada día, el ingreso real que entra a la clínica se calcula así:"],
    [],
    ["  Ingreso Clínica $ = Consultas $ + Laboratorio $ + Imágenes $ + Anticipos $ + Convenios $"],
    [],
    ["DETALLE DE CADA COMPONENTE:"],
    [],
    ["1) CONSULTAS"],
    ["   La clínica solo recibe el honorario clínica (% Clínica $ en el PDF), ya en USD."],
    ["   El resto del Total Bs facturado va al médico y NO entra a la clínica."],
    ["   → Consultas $ = suma de la columna '% Clínica $' de cada especialidad"],
    [],
    ["2) LABORATORIO  /  3) IMÁGENES  /  4) ANTICIPOS  /  5) CONVENIOS"],
    ["   Todo el Total Bs entra a la clínica (no hay médico intermedio)."],
    ["   Se convierte a USD usando la tasa del día."],
    ["   → Componente $ = Total Bs / Tasa del día"],
    [],
    ["EJEMPLO CON UN DÍA:"],
    [`   Tomá cualquier fila de la hoja "Detalle por día":`],
    ["   Sumá las 5 columnas USD: Consultas $ + Lab $ + Img $ + Anticipos $ + Convenios $"],
    ["   El resultado debe ser igual a la columna 'TOTAL CLÍNICA $'"],
    [],
    ["VERIFICACIÓN DEL TOTAL DEL MES:"],
    ["   Sumá la columna 'TOTAL CLÍNICA $' de todos los días."],
    ["   Ese valor debe coincidir con el total que muestra el dashboard."],
    [],
    ["TOTALES DEL PERÍODO:"],
    ["Concepto", "Valor"],
    ["Consultas $ (clínica)", round2(consDiv)],
    ["Laboratorio $",         round2(labDiv)],
    ["Imágenes $",            round2(imgDiv)],
    ["Anticipos $",           round2(antDiv)],
    ["Convenios $",           round2(cueDiv)],
    ["TOTAL CLÍNICA $",       round2(totalClinicaUsd)],
    [],
    ["Verificación:",         round2(consDiv + labDiv + imgDiv + antDiv + cueDiv)],
    [`(debe coincidir con TOTAL CLÍNICA $: ${round2(totalClinicaUsd)})`],
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(explicacion);
  ws4["!cols"] = [{ wch: 70 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws4, "Cómo se calcula");

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
