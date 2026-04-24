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

/**
 * Busca la línea del header "Total Bs." en la sección para saber
 * dónde empiezan las filas de datos. Usa tokens (split por 2+ espacios)
 * y NO posiciones fijas de columna — las posiciones rompen cuando un
 * número o nombre rebasa el ancho nominal de la celda y queda
 * right-alineado una posición a la izquierda del header (bug histórico).
 */
function findHeaderEnd(lines: string[], fromIdx: number): number | null {
  for (let i = fromIdx; i < Math.min(fromIdx + 6, lines.length); i++) {
    if (lines[i].includes("Total Bs.")) return i;
  }
  return null;
}

/** Es entero puro (ni puntos ni comas). */
const isInteger = (s: string) => /^\d+$/.test(s);
/** Es un monto: solo dígitos/puntos/comas Y contiene al menos un punto o coma. */
const isMoney = (s: string) => /^[\d.,]+$/.test(s) && /[.,]/.test(s);

/**
 * Parser estándar para CONSULTAS / SERVICIOS / ANTICIPOS.
 * Formato:  CODE NOMBRE  TOTAL_$  TOTAL_BS  NUMPAC  [PCT_CLINICA]  [COMENTARIO]
 *
 * numPac es el primer entero puro que aparece DESPUÉS de 2 montos consecutivos
 * (así distinguimos entero-pacientes de token "0" en money columns).
 */
function parseStandardRow(tokens: string[]): DataRow | null {
  if (tokens.length < 4) return null;
  if (!isInteger(tokens[0])) return null;

  let numPacIdx = -1;
  for (let i = 3; i < tokens.length; i++) {
    if (isInteger(tokens[i]) && isMoney(tokens[i - 1]) && isMoney(tokens[i - 2])) {
      numPacIdx = i;
      break;
    }
  }
  if (numPacIdx === -1) {
    for (let i = 3; i < tokens.length; i++) {
      if (isInteger(tokens[i])) { numPacIdx = i; break; }
    }
  }
  if (numPacIdx === -1 || numPacIdx < 3) return null;

  // El nombre es todo lo textual hasta el primer token monetario ($ o número con decimal).
  // Esto es robusto frente a PDFs viejos con columnas extra "EFECTIVO $ HCDE / MEDICOS"
  // que meten tokens "70,00 $ 140,00" entre el nombre y Total $.
  const nameParts: string[] = [];
  for (let i = 1; i < numPacIdx - 2; i++) {
    const t = tokens[i];
    if (isMoney(t) || t === "$") break;
    nameParts.push(t);
  }
  const nombre = nameParts.join(" ").trim();
  if (!nombre || nombre.length < 2) return null;
  const totalDolar = parseNum(tokens[numPacIdx - 2]);
  const totalBs = parseNum(tokens[numPacIdx - 1]);
  const numPac = parseInt(tokens[numPacIdx]) || 0;

  let porcClinica = 0, comentarios = "";
  const rest = tokens.slice(numPacIdx + 1);
  if (rest.length > 0) {
    if (isMoney(rest[0])) { porcClinica = parseNum(rest[0]); comentarios = rest.slice(1).join(" ").trim(); }
    else comentarios = rest.join(" ").trim();
  }
  return { name: nombre, totalDolar, totalBs, numPac, porcClinica, comentarios };
}

/**
 * Parser para CUENTAS POR COBRAR / CONVENIOS.
 * Formato distinto (sin numPac):  CODE NOMBRE  TOTAL_$  TOTAL_BS  $  AMOUNT_USD
 *
 * Reconocible porque algún token es "$" solo (separador de columna USD).
 * El último token antes del fin es el monto en USD (ingresoDivisa).
 */
function parseCuentasRow(tokens: string[]): DataRow | null {
  if (tokens.length < 4) return null;
  if (!isInteger(tokens[0])) return null;

  // Localizar el "$" que marca el inicio de la columna de USD
  const dollarIdx = tokens.findIndex((t, i) => i > 0 && t === "$");
  if (dollarIdx === -1) return null;
  // Debe venir al menos un token monetario después
  if (dollarIdx === tokens.length - 1) return null;
  const montoUsd = parseNum(tokens[dollarIdx + 1]);

  // Antes del "$" deben estar TOTAL_$ y TOTAL_BS al final
  if (dollarIdx < 3) return null;
  const totalBs = parseNum(tokens[dollarIdx - 1]);
  const totalDolar = parseNum(tokens[dollarIdx - 2]);
  const nombre = tokens.slice(1, dollarIdx - 2).join(" ").trim();
  if (!nombre || nombre.length < 2) return null;

  return {
    name: nombre,
    totalDolar,
    totalBs,
    numPac: 0,
    porcClinica: 0,
    comentarios: "",
    // cuentas lleva ingresoDivisa en la col USD del PDF, no en totalDolar
    // (guardamos el monto USD en comentarios como marcador temporal)
    _cuentasIngresoUsd: montoUsd,
  } as DataRow & { _cuentasIngresoUsd?: number };
}

function extractDataRows(
  lines: string[],
  sectionStart: number,
  sectionEnd: number,
  section: "standard" | "cuentas" = "standard"
): DataRow[] {
  const headerEnd = findHeaderEnd(lines, sectionStart + 1);
  if (headerEnd === null) return [];

  const rows: DataRow[] = [];
  // Cuentas pueden ocupar varias líneas: guardamos una línea "pendiente" cuando
  // el nombre ocupa 2 líneas y los montos vienen en la siguiente.
  let pendingName = "";

  for (let i = headerEnd + 1; i < sectionEnd; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    if (/Totales|Total General/i.test(line)) continue;
    if (/^[\s═─]+$/.test(line)) continue;

    const tokens = line.trim().split(/\s{2,}/);

    // Línea sin código pero con nombre + posibles montos al final (cuentas multi-línea)
    if (section === "cuentas" && !/^\s*\d+\s/.test(line)) {
      // Puede ser: "Dr. JOSÉ N. MARCANO (ABONO A" (solo nombre)
      //        o: "2.000,00   0,00" (solo montos — continuación)
      if (tokens.length === 1 && !isMoney(tokens[0])) {
        pendingName = pendingName ? `${pendingName} ${tokens[0]}` : tokens[0];
      }
      continue;
    }

    if (!/^\s*\d+\s/.test(line)) continue;

    let row: DataRow | null = null;
    if (section === "cuentas") {
      // Intento de fila estándar primero (con numPac)
      row = parseStandardRow(tokens);
      // Si falla, intentar formato cuentas con "$"
      if (!row) row = parseCuentasRow(tokens);
      // Aplicar pendingName si existe (nombre que venía de la línea anterior)
      if (row && pendingName) {
        row.name = `${pendingName} ${row.name}`.trim();
        pendingName = "";
      }
    } else {
      row = parseStandardRow(tokens);
    }

    if (row) rows.push(row);
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
  const cueRows = iCue >= 0 ? extractDataRows(lines, iCue, endOf(iCue, iAps), "cuentas") : [];

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
    // "APS" como fila en consultas se ignora: son consultas del programa APS que
    // ya están contadas en la sección UNIDAD DE APS del mismo reporte.
    if (norm(r.name) === "aps") continue;
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
  // En el PDF, la col "Comentarios" de cuentas contiene "$ MONTO_USD" → ese es
  // el ingresoDivisa. El parser lo deja en _cuentasIngresoUsd. Como fallback,
  // si no existe, usamos totalDolar (compatibilidad con formato alternativo).
  const cuentasPorCobrar = [];
  for (const r of parsed.cuentas) {
    if (!r.name) continue;
    const ingresoDiv =
      typeof (r as DataRow & { _cuentasIngresoUsd?: number })._cuentasIngresoUsd === "number"
        ? (r as DataRow & { _cuentasIngresoUsd?: number })._cuentasIngresoUsd!
        : r.totalDolar;
    if (r.totalBs === 0 && ingresoDiv === 0 && r.totalDolar === 0) continue;
    cuentasPorCobrar.push({
      nombreConvenio: r.name.trim(),
      totalBs: r.totalBs,
      ingresoDivisa: ingresoDiv,
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
  const replaceMode = process.argv.includes("--replace");
  if (replaceMode) {
    console.log("⚠️  MODO --replace ACTIVO: los reportes existentes serán REEMPLAZADOS.\n");
  }

  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!adminUser) { console.error("❌ No hay usuario ADMIN en la base de datos."); process.exit(1); }

  const [especialidades, unidades] = await Promise.all([
    prisma.especialidad.findMany(),
    prisma.unidadServicio.findMany(),
  ]);

  const espMap = new Map(especialidades.map(e => [norm(e.nombre), { id: e.id, honorarioClinica: e.honorarioClinica }]));
  // Alias for common PDF misspellings
  if (espMap.has("oftalmologia")) espMap.set("oftamologia", espMap.get("oftalmologia")!);
  if (espMap.has("ginecologia regenerativa")) {
    // Typos en PDFs: "Regenertiva", "Regeneretiva", "Ginecoloia"
    const gin = espMap.get("ginecologia regenerativa")!;
    espMap.set("ginecologia regenertiva", gin);
    espMap.set("ginecologia regeneretiva", gin);
    espMap.set("ginecoloia regenerativa", gin);
  }
  // Hemato-Oncología → Oncología (sub-variante, no es especialidad separada)
  if (espMap.has("oncologia")) {
    const onc = espMap.get("oncologia")!;
    espMap.set("hemato-oncologia", onc);
    espMap.set("hemato oncologia", onc);
  }
  // PRE-ANESTESIA → Anestesiología
  if (espMap.has("anestesiologia")) {
    const ane = espMap.get("anestesiologia")!;
    espMap.set("pre-anestesia", ane);
    espMap.set("pre anestesia", ane);
  }
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
      if (!replaceMode) {
        console.log(`⏭️  Ya existe (${parsed.fecha}) — pasa --replace para reescribir`);
        skip++;
        continue;
      }
      // En modo replace: borra el reporte viejo (cascade borra sus líneas)
      await prisma.dailyReport.delete({ where: { id: exists.id } });
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
