import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEditReports } from "@/lib/roles";
import * as XLSX from "xlsx";

type Row = (string | number | Date | null | undefined)[];

function cellStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}
function cellNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
}
function cellDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Try parsing DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    let y = m[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo}-${d}`;
  }
  return null;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (!canEditReports(role)) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const userId = (session.user as { id: string }).id;

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });

  let rows: Row[];
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<Row>(ws, { header: 1, defval: "" });
  } catch {
    return NextResponse.json({ error: "No se pudo leer el archivo Excel" }, { status: 400 });
  }

  // Locate header fields and sections
  const findRow = (re: RegExp) => rows.findIndex(r => re.test(cellStr(r[0])));
  const fechaIdx = findRow(/^fecha/i);
  const tasaIdx = findRow(/^tasa/i);
  const obsIdx = findRow(/observa/i);
  const consIdx = findRow(/^consultas$/i);
  const labIdx = findRow(/laborator/i);
  const areaIdx = findRow(/pacientes por/i);
  const antIdx = findRow(/anticipo/i);
  const apsIdx = findRow(/^aps\b/i);

  const fechaStr = fechaIdx >= 0 ? cellDate(rows[fechaIdx][1]) : null;
  if (!fechaStr) return NextResponse.json({ error: "Fecha inválida o faltante (formato esperado: YYYY-MM-DD)" }, { status: 400 });
  const tasa = tasaIdx >= 0 ? cellNum(rows[tasaIdx][1]) : 0;
  if (!tasa || tasa <= 0) return NextResponse.json({ error: "Tasa inválida o faltante" }, { status: 400 });
  const observaciones = obsIdx >= 0 ? cellStr(rows[obsIdx][1]) || undefined : undefined;

  const readSection = (start: number, end: number, skipHeaderRows = 2) => {
    if (start < 0) return [];
    const out: Row[] = [];
    const stop = end > 0 ? end : rows.length;
    for (let i = start + skipHeaderRows; i < stop; i++) {
      const r = rows[i] || [];
      const empty = r.slice(0, 5).every(c => cellStr(c) === "");
      if (empty) continue;
      out.push(r);
    }
    return out;
  };

  const consRows = readSection(consIdx, labIdx);
  const labRows = readSection(labIdx, areaIdx);
  const areaRows = readSection(areaIdx, antIdx);
  const antRows = readSection(antIdx, apsIdx, 3); // 1 section title + 1 column header + 1 hint row
  const apsRows = readSection(apsIdx, rows.length);

  const [especialidades, unidades] = await Promise.all([
    prisma.especialidad.findMany({ where: { activa: true } }),
    prisma.unidadServicio.findMany({ where: { activa: true } }),
  ]);
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const espMap = new Map(especialidades.map(e => [norm(e.nombre), e]));
  const uniMap = new Map(unidades.map(u => [norm(u.nombre), u]));

  const warnings: string[] = [];

  const consultas: { especialidadId: string; numPacientes: number; totalBs: number; ingresoDivisa: number; porcentajeClinica: number }[] = [];
  for (const r of consRows) {
    const nombre = cellStr(r[0]);
    if (!nombre) continue;
    const esp = espMap.get(norm(nombre));
    const pac = Math.round(cellNum(r[1]));
    const bs = cellNum(r[2]);
    const div = cellNum(r[3]);
    if (!esp) {
      if (pac > 0 || bs > 0 || div > 0) warnings.push(`Especialidad no encontrada: "${nombre}"`);
      continue;
    }
    if (pac === 0 && bs === 0 && div === 0) continue;
    consultas.push({
      especialidadId: esp.id,
      numPacientes: pac,
      totalBs: bs,
      ingresoDivisa: div,
      porcentajeClinica: pac * esp.honorarioClinica,
    });
  }

  const servicios: { unidadServicioId: string; numPacientes: number; totalBs: number; ingresoDivisa: number; porcentajeClinica: number }[] = [];
  for (const r of labRows) {
    const nombre = cellStr(r[0]);
    if (!nombre) continue;
    const uni = uniMap.get(norm(nombre));
    const pac = Math.round(cellNum(r[1]));
    const bs = cellNum(r[2]);
    const div = cellNum(r[3]);
    if (!uni) {
      if (pac > 0 || bs > 0 || div > 0) warnings.push(`Unidad no encontrada: "${nombre}"`);
      continue;
    }
    if (pac === 0 && bs === 0 && div === 0) continue;
    servicios.push({ unidadServicioId: uni.id, numPacientes: pac, totalBs: bs, ingresoDivisa: div, porcentajeClinica: 0 });
  }

  const areaMap: Record<string, "EMERGENCIA" | "HOSPITALIZACION" | "UCI"> = {
    "emergencia": "EMERGENCIA",
    "hospitalizacion": "HOSPITALIZACION",
    "uci": "UCI",
  };
  const pacientesArea: { area: "EMERGENCIA" | "HOSPITALIZACION" | "UCI"; numPacientes: number }[] = [];
  for (const r of areaRows) {
    const k = norm(cellStr(r[0]));
    const area = areaMap[k];
    if (!area) continue;
    const pac = Math.round(cellNum(r[1]));
    if (pac > 0) pacientesArea.push({ area, numPacientes: pac });
  }

  const tipoMap: Record<string, "HOSPITALIZACION" | "EMERGENCIA" | "ESTUDIOS"> = {
    "hospitalizacion": "HOSPITALIZACION",
    "emergencia": "EMERGENCIA",
    "estudios": "ESTUDIOS",
  };
  const anticipos: { tipo: "HOSPITALIZACION" | "EMERGENCIA" | "ESTUDIOS"; pacienteNombre?: string; totalBs: number; ingresoDivisa: number; numPacientes: number; estado: "PENDIENTE" | "APLICADO" }[] = [];
  for (const r of antRows) {
    const tipoCell = norm(cellStr(r[0]));
    const tipo = tipoMap[tipoCell];
    if (!tipo) continue;
    const paciente = cellStr(r[1]);
    const bs = cellNum(r[2]);
    const div = cellNum(r[3]);
    if (bs === 0 && div === 0) continue;
    anticipos.push({ tipo, pacienteNombre: paciente || undefined, totalBs: bs, ingresoDivisa: div, numPacientes: 1, estado: "PENDIENTE" });
  }

  let aps: { consultas: number; laboratoriosImagenes: number; movimientosDia: number; totalFacturados: number } | null = null;
  if (apsRows.length > 0) {
    const apsVals: Record<string, number> = {};
    for (const r of apsRows) apsVals[norm(cellStr(r[0]))] = Math.round(cellNum(r[1]));
    const c = apsVals["consultas"] || 0;
    const li = apsVals["laboratorios/imagenes"] || apsVals["laboratorios / imagenes"] || 0;
    const mo = apsVals["movimientos del dia"] || 0;
    const tf = apsVals["total facturados"] || 0;
    if (c || li || mo || tf) aps = { consultas: c, laboratoriosImagenes: li, movimientosDia: mo, totalFacturados: tf };
  }

  const fechaDate = new Date(fechaStr + "T12:00:00.000Z");
  const existing = await prisma.dailyReport.findUnique({ where: { fecha: fechaDate } });
  if (existing) {
    return NextResponse.json({ error: `Ya existe un reporte para ${fechaStr}`, id: existing.id }, { status: 409 });
  }

  const reporte = await prisma.dailyReport.create({
    data: {
      fecha: fechaDate,
      tasaCambio: tasa,
      observaciones,
      estado: "CERRADO",
      cerradoAt: new Date(),
      creadoPorId: userId,
      consultas: { create: consultas },
      servicios: { create: servicios },
      pacientesArea: { create: pacientesArea },
      anticipos: { create: anticipos },
      ...(aps ? { aps: { create: aps } } : {}),
    },
  });

  return NextResponse.json({
    id: reporte.id,
    fecha: fechaStr,
    resumen: {
      consultas: consultas.length,
      servicios: servicios.length,
      anticipos: anticipos.length,
      pacientesArea: pacientesArea.length,
      aps: aps ? 1 : 0,
    },
    warnings,
  });
}
