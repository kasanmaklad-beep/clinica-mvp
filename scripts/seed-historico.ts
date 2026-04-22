/**
 * Importa PDFs históricos de caja diaria al sistema.
 * Uso: npx tsx scripts/seed-historico.ts
 */
import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const PDF_DIR = path.join(__dirname, "../data/pdfs");

// ───────── Utilidades ──────────────────────────────────────────────────────────

const MESES: Record<string, number> = {
  ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6,
  JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12,
};

const TIPO_MAP: Record<string, "HOSPITALIZACION" | "EMERGENCIA" | "ESTUDIOS"> = {
  HOSPITALIZACION: "HOSPITALIZACION", HOSPITALIZACIÓN: "HOSPITALIZACION",
  EMERGENCIA: "EMERGENCIA", ESTUDIOS: "ESTUDIOS",
  GINECOLOGIA: "HOSPITALIZACION", GINECOLOGÍA: "HOSPITALIZACION",
  OFTALMOLOGIA: "ESTUDIOS", OFTAMOLOGIA: "ESTUDIOS",
  TRAUMATOLOGIA: "HOSPITALIZACION", TRAUMATOLOGÍA: "HOSPITALIZACION",
  "CIRUGIA GENERAL": "ESTUDIOS", "CIRUGÍA GENERAL": "ESTUDIOS",
  CIRUGIA: "ESTUDIOS", CIRUGÍA: "ESTUDIOS",
  CARDIOLOGIA: "HOSPITALIZACION", CARDIOLOGÍA: "HOSPITALIZACION",
  PEDIATRIA: "HOSPITALIZACION", PEDIATRÍA: "HOSPITALIZACION",
  MEDICINA: "HOSPITALIZACION",
};

const AREA_MAP: Record<string, "EMERGENCIA" | "HOSPITALIZACION" | "UCI"> = {
  emergencia: "EMERGENCIA", hospitalizacion: "HOSPITALIZACION",
  hospitalización: "HOSPITALIZACION", hospitalizados: "HOSPITALIZACION",
  uci: "UCI",
};

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function parseNum(s: string): number {
  if (!s) return 0;
  const clean = s.trim().replace(/\./g, "").replace(",", ".");
  return parseFloat(clean) || 0;
}

function parseDate(text: string): string | null {
  const m = text.match(/Movimientos del d[ií]a[^\d]*(\d{1,2})\s+DE\s+([A-ZÁÉÍÓÚ]+)\s+de\s+(\d{4})/i);
  if (!m) return null;
  const mes = MESES[m[2].toUpperCase()];
  if (!mes) return null;
  return `${m[3]}-${String(mes).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function parseTasa(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Standard: number on same line as "Tasa del dia: 265,07"
    const std = line.match(/Tasa\s*.*?del\s+d[ií]a\s*:?\s*([0-9][0-9.,]{2,})/i);
    if (std) return parseNum(std[1]);

    // "del dia:" found but number is on the next 1-3 lines (PDF layout overlap)
    if (/del\s+d[ií]a\s*:/i.test(line)) {
      // inline: check remainder of the same line after the colon
      const rest = line.replace(/.*del\s+d[ií]a\s*:\s*/i, "");
      const inm = rest.match(/([0-9][0-9.,]{2,})/);
      if (inm) { const v = parseNum(inm[1]); if (v > 10) return v; }
      // overflow: number on one of the next 3 lines
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const nums = (lines[j].match(/[0-9][0-9.,]{2,}/g) || []);
        for (const n of nums) {
          const v = parseNum(n);
          if (v > 10 && v < 100000) return v;
        }
      }
    }
  }
  // Fallback: standalone number after date line
  let foundDate = false;
  for (const line of lines) {
    if (/Movimientos del d[ií]a/i.test(line)) { foundDate = true; continue; }
    if (foundDate && line.trim()) {
      const m = line.trim().match(/^([0-9.,]{4,})$/);
      if (m) return parseNum(m[1]);
      break;
    }
  }
  return 0;
}

// ───────── Parser de secciones ─────────────────────────────────────────────────

interface DataRow {
  name: string;
  totalDolar: number;
  totalBs: number;
  numPac: number;
  porcClinica: number;
  comentarios: string;
}

function findColPos(lines: string[], fromIdx: number): {
  colBs: number; colDolar: number; colPac: number; colClinica: number; colCom: number; headerEnd: number;
} | null {
  // Find the line that contains "Total Bs." (up to 6 lines ahead)
  let primaryHeader = "";
  let lastHeaderLine = fromIdx;
  for (let i = fromIdx; i < Math.min(fromIdx + 6, lines.length); i++) {
    if (lines[i].includes("Total Bs.")) {
      primaryHeader = lines[i];
      lastHeaderLine = i;
      break;
    }
  }
  if (!primaryHeader) return null;

  // Use positions within the primary header line (avoids offset from merged multi-line headers)
  const colBs = primaryHeader.indexOf("Total Bs.");
  const colDolar = primaryHeader.indexOf("Total $");
  const colPacRaw = primaryHeader.search(/N°\s+de\s+Pacientes|Pacientes/);
  const colClinica = primaryHeader.indexOf("% $.Clinica");
  const colCom = primaryHeader.indexOf("Comentarios");

  return {
    colBs, colDolar: colDolar >= 0 ? colDolar : -1,
    colPac: colPacRaw >= 0 ? colPacRaw : colBs + 18,
    colClinica: colClinica >= 0 ? colClinica : -1,
    colCom: colCom >= 0 ? colCom : -1,
    headerEnd: lastHeaderLine,
  };
}

function extractDataRows(lines: string[], sectionStart: number, sectionEnd: number): DataRow[] {
  const cols = findColPos(lines, sectionStart + 1);
  if (!cols) return [];

  const rows: DataRow[] = [];
  for (let i = cols.headerEnd + 1; i < sectionEnd; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    if (/Totales|Total General/i.test(line)) continue;
    if (/^[\s═─]+$/.test(line)) continue;
    // Debe iniciar con N° (número) seguido del nombre
    if (!/^\s*\d+\s/.test(line)) continue;

    const nameEnd = Math.min(
      cols.colDolar > 0 ? cols.colDolar - 1 : 999,
      cols.colBs - 1,
    );
    const rawName = line.substring(0, nameEnd).replace(/^\s*\d+\s+/, "").trim();
    if (!rawName || rawName.length < 2) continue;

    const get = (start: number, end: number) =>
      start >= 0 ? line.substring(start, end > start ? end : start + 20).trim() : "";

    const totalDolar = cols.colDolar >= 0 ? parseNum(get(cols.colDolar, cols.colBs - 1)) : 0;
    const totalBs = parseNum(get(cols.colBs, cols.colPac - 2));
    const pacEnd = cols.colClinica > 0 ? cols.colClinica - 2 : cols.colPac + 15;
    const numPac = parseInt(get(cols.colPac, pacEnd)) || 0;
    const clinEnd = cols.colCom > 0 ? cols.colCom - 2 : cols.colClinica + 18;
    const porcClinica = cols.colClinica > 0 ? parseNum(get(cols.colClinica, clinEnd)) : 0;
    const comentarios = cols.colCom > 0 ? line.substring(cols.colCom).trim() : "";

    rows.push({ name: rawName, totalDolar, totalBs, numPac, porcClinica, comentarios });
  }
  return rows;
}

// ───────── Encontrar secciones ─────────────────────────────────────────────────

function findSection(lines: string[], pattern: RegExp, from = 0): number {
  for (let i = from; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i;
  }
  return -1;
}

// ───────── Parsear un PDF completo ─────────────────────────────────────────────

interface ParsedReport {
  fecha: string;
  tasa: number;
  consultas: DataRow[];
  servicios: DataRow[];
  pacientesArea: { area: "EMERGENCIA" | "HOSPITALIZACION" | "UCI"; numPacientes: number }[];
  anticipos: DataRow[];
  cuentas: DataRow[];
  aps: { consultas: number; laboratoriosImagenes: number; movimientosDia: number; totalFacturados: number } | null;
}

function parsePDF(pdfPath: string): ParsedReport | null {
  let text: string;
  try {
    text = execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: "utf8", timeout: 15000 });
  } catch {
    return null;
  }

  const lines = text.split("\n");
  const fecha = parseDate(text);
  if (!fecha) return null;

  const tasa = parseTasa(lines);

  // Índices de secciones
  const iCons = findSection(lines, /Unidades de Consulta/i);
  const iLab = findSection(lines, /Unidades de Servicios.*Laborator/i);
  const iPac = findSection(lines, /Pacientes.*Emergencia.*Hospitaliz/i);
  const iAnt = findSection(lines, /^[\s]*Anticipos/i);
  const iCue = findSection(lines, /Cuentas Por Cobrar.*Convenios/i);
  const iAps = findSection(lines, /UNIDAD DE APS/i);
  const iEnd = lines.length;

  const endOf = (idx: number, ...nexts: number[]) => {
    const valid = nexts.filter(n => n > idx);
    return valid.length > 0 ? Math.min(...valid) : iEnd;
  };

  const consRows = iCons >= 0 ? extractDataRows(lines, iCons, endOf(iCons, iLab, iPac, iAnt, iCue, iAps)) : [];
  const labRows = iLab >= 0 ? extractDataRows(lines, iLab, endOf(iLab, iPac, iAnt, iCue, iAps)) : [];
  const antRows = iAnt >= 0 ? extractDataRows(lines, iAnt, endOf(iAnt, iCue, iAps)) : [];
  const cueRows = iCue >= 0 ? extractDataRows(lines, iCue, endOf(iCue, iAps)) : [];

  // Pacientes por área
  const pacientesArea: ParsedReport["pacientesArea"] = [];
  if (iPac >= 0) {
    const pacEnd = endOf(iPac, iAnt, iCue, iAps);
    for (let i = iPac + 1; i < pacEnd; i++) {
      const line = lines[i];
      if (!line || !line.trim()) continue;
      if (/Totales|Total/i.test(line)) continue;
      const m = line.match(/^\s*\d+\s+(.+?)\s{3,}(\d+)/);
      if (m) {
        const areaKey = norm(m[1]);
        const area = AREA_MAP[areaKey];
        if (area) pacientesArea.push({ area, numPacientes: parseInt(m[2]) || 0 });
      }
    }
  }

  // APS
  let aps: ParsedReport["aps"] = null;
  if (iAps >= 0) {
    const apsVals: number[] = [];
    for (let i = iAps + 1; i < iEnd; i++) {
      const line = lines[i];
      if (!line || !line.trim()) continue;
      const m = line.match(/^\s*\d*\s+.+?\s+(\d+)\s/);
      if (m) apsVals.push(parseInt(m[1]) || 0);
      if (apsVals.length >= 4) break;
    }
    if (apsVals.length >= 3) {
      aps = {
        consultas: apsVals[0] || 0,
        laboratoriosImagenes: apsVals[1] || 0,
        movimientosDia: apsVals[2] || 0,
        totalFacturados: apsVals[3] || 0,
      };
    }
  }

  return { fecha, tasa, consultas: consRows, servicios: labRows, pacientesArea, anticipos: antRows, cuentas: cueRows, aps };
}

// ───────── Importar al DB ──────────────────────────────────────────────────────

async function importarReporte(
  parsed: ParsedReport,
  userId: string,
  espMap: Map<string, { id: string; honorarioClinica: number }>,
  uniMap: Map<string, string>,
) {
  const warnings: string[] = [];

  const fechaDate = new Date(parsed.fecha + "T12:00:00.000Z");

  // Consultas
  const consultas = [];
  for (const r of parsed.consultas) {
    const esp = espMap.get(norm(r.name));
    if (!esp) { warnings.push(`Especialidad no encontrada: "${r.name}"`); continue; }
    if (r.numPac === 0 && r.totalBs === 0 && r.totalDolar === 0) continue;
    consultas.push({
      especialidadId: esp.id,
      numPacientes: r.numPac,
      totalBs: r.totalBs,
      ingresoDivisa: r.totalDolar,
      porcentajeClinica: r.porcClinica > 0 ? r.porcClinica : r.numPac * esp.honorarioClinica,
    });
  }

  // Servicios
  const servicios = [];
  for (const r of parsed.servicios) {
    const uniId = uniMap.get(norm(r.name));
    if (!uniId) { warnings.push(`Unidad no encontrada: "${r.name}"`); continue; }
    if (r.numPac === 0 && r.totalBs === 0 && r.totalDolar === 0) continue;
    servicios.push({
      unidadServicioId: uniId,
      numPacientes: r.numPac,
      totalBs: r.totalBs,
      ingresoDivisa: r.totalDolar,
      porcentajeClinica: 0,
    });
  }

  // Anticipos
  const anticipos = [];
  for (const r of parsed.anticipos) {
    const tipoKey = r.name.trim().toUpperCase();
    const tipo = TIPO_MAP[tipoKey] ?? "HOSPITALIZACION";
    if (r.totalBs === 0 && r.totalDolar === 0) continue;
    anticipos.push({
      tipo,
      pacienteNombre: r.comentarios || undefined,
      totalBs: r.totalBs,
      ingresoDivisa: r.totalDolar,
      numPacientes: r.numPac || 1,
      estado: "APLICADO" as const,  // histórico = ya aplicado
    });
  }

  // Cuentas por cobrar / Convenios
  const cuentasPorCobrar = [];
  for (const r of parsed.cuentas) {
    if (!r.name || (r.totalBs === 0 && r.totalDolar === 0)) continue;
    cuentasPorCobrar.push({
      nombreConvenio: r.name.trim(),
      totalBs: r.totalBs,
      ingresoDivisa: r.totalDolar,
      numPacientes: r.numPac || 0,
      comentarios: r.comentarios || undefined,
    });
  }

  await prisma.dailyReport.create({
    data: {
      fecha: fechaDate,
      tasaCambio: parsed.tasa,
      estado: "CERRADO",
      cerradoAt: fechaDate,
      creadoPorId: userId,
      consultas: { create: consultas },
      servicios: { create: servicios },
      pacientesArea: { create: parsed.pacientesArea.filter(p => p.numPacientes > 0) },
      anticipos: { create: anticipos },
      cuentasPorCobrar: { create: cuentasPorCobrar },
      ...(parsed.aps ? { aps: { create: parsed.aps } } : {}),
    },
  });

  return warnings;
}

// ───────── Main ────────────────────────────────────────────────────────────────

async function main() {
  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!adminUser) { console.error("❌ No hay usuario ADMIN en la base de datos."); process.exit(1); }

  const [especialidades, unidades] = await Promise.all([
    prisma.especialidad.findMany(),
    prisma.unidadServicio.findMany(),
  ]);

  const espMap = new Map(especialidades.map(e => [norm(e.nombre), { id: e.id, honorarioClinica: e.honorarioClinica }]));
  // Alias for common PDF misspellings
  if (espMap.has("oftalmologia")) espMap.set("oftamologia", espMap.get("oftalmologia")!);
  const uniMap = new Map(unidades.map(u => [norm(u.nombre), u.id]));

  const pdfs = fs.readdirSync(PDF_DIR).filter(f => f.toLowerCase().endsWith(".pdf")).sort();
  console.log(`\n📂 ${pdfs.length} PDFs encontrados en ${PDF_DIR}\n`);

  let ok = 0, skip = 0, errParse = 0, errDB = 0;
  const allWarnings: string[] = [];

  for (const file of pdfs) {
    const fullPath = path.join(PDF_DIR, file);
    process.stdout.write(`  → ${file.padEnd(45)} `);

    // 1. Parsear
    const parsed = parsePDF(fullPath);
    if (!parsed) {
      console.log("⚠️  No se pudo extraer fecha");
      errParse++;
      continue;
    }
    if (!parsed.tasa || parsed.tasa <= 0) {
      console.log(`⚠️  Tasa no encontrada (fecha: ${parsed.fecha})`);
      errParse++;
      continue;
    }

    // 2. Verificar si ya existe
    const fechaDate = new Date(parsed.fecha + "T12:00:00.000Z");
    const exists = await prisma.dailyReport.findUnique({ where: { fecha: fechaDate } });
    if (exists) {
      console.log(`⏭️  Ya existe (${parsed.fecha})`);
      skip++;
      continue;
    }

    // 3. Importar
    try {
      const warnings = await importarReporte(parsed, adminUser.id, espMap, uniMap);
      if (warnings.length > 0) {
        console.log(`✅ ${parsed.fecha}  tasa:${parsed.tasa}  ⚠️ ${warnings.length} avisos`);
        allWarnings.push(...warnings.map(w => `  ${parsed.fecha}: ${w}`));
      } else {
        console.log(`✅ ${parsed.fecha}  tasa:${parsed.tasa}  cons:${parsed.consultas.length}  lab:${parsed.servicios.length}  ant:${parsed.anticipos.length}`);
      }
      ok++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`❌ Error DB: ${msg.slice(0, 200)}`);
      // Debug: print the parsed data so we can diagnose the problem
      console.log(`   fecha=${parsed.fecha} tasa=${parsed.tasa}`);
      console.log(`   consultas: ${JSON.stringify(parsed.consultas.map(r => r.name))}`);
      console.log(`   servicios: ${JSON.stringify(parsed.servicios.map(r => r.name))}`);
      console.log(`   anticipos: ${JSON.stringify(parsed.anticipos.map(r => r.name))}`);
      errDB++;
    }
  }

  console.log(`
══════════════════════════════════════════════
  Importados:  ${ok}
  Ya existían: ${skip}
  Sin fecha/tasa: ${errParse}
  Errores DB:  ${errDB}
  Total PDFs:  ${pdfs.length}
══════════════════════════════════════════════`);

  if (allWarnings.length > 0) {
    console.log(`\n⚠️  Avisos (nombres no encontrados en catálogo):`);
    const unique = [...new Set(allWarnings)].slice(0, 40);
    unique.forEach(w => console.log(w));
    if (allWarnings.length > 40) console.log(`  ... y ${allWarnings.length - 40} más`);
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
