/**
 * DRY-RUN: corre el parser ARREGLADO sobre todos los PDFs y compara
 * con lo que hay en la BD. NO modifica nada.
 *
 * Reporta:
 *  - Días con diferencias en totales (Bs, pacientes, $)
 *  - Deltas agregados por sección
 *  - Días con avisos del parser (especialidades desconocidas, etc.)
 */
import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();
const PDF_DIR = path.join(__dirname, "../data/pdfs");

const MESES: Record<string, number> = {
  ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6,
  JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12,
};

function parseNum(s: string): number {
  if (!s) return 0;
  return parseFloat(s.trim().replace(/\./g, "").replace(",", ".")) || 0;
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
    const std = line.match(/Tasa\s*.*?del\s+d[ií]a\s*:?\s*([0-9][0-9.,]{2,})/i);
    if (std) return parseNum(std[1]);
    if (/del\s+d[ií]a\s*:/i.test(line)) {
      const rest = line.replace(/.*del\s+d[ií]a\s*:\s*/i, "");
      const inm = rest.match(/([0-9][0-9.,]{2,})/);
      if (inm) { const v = parseNum(inm[1]); if (v > 10) return v; }
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const nums = (lines[j].match(/[0-9][0-9.,]{2,}/g) || []);
        for (const n of nums) {
          const v = parseNum(n);
          if (v > 10 && v < 100000) return v;
        }
      }
    }
  }
  return 0;
}

interface DataRow { name: string; totalDolar: number; totalBs: number; numPac: number; porcClinica: number; comentarios: string; _cuentasIngresoUsd?: number; }

const isInteger = (s: string) => /^\d+$/.test(s);
const isMoney = (s: string) => /^[\d.,]+$/.test(s) && /[.,]/.test(s);

function findHeaderEnd(lines: string[], fromIdx: number): number | null {
  for (let i = fromIdx; i < Math.min(fromIdx + 6, lines.length); i++) {
    if (lines[i].includes("Total Bs.")) return i;
  }
  return null;
}

function parseStandardRow(tokens: string[]): DataRow | null {
  if (tokens.length < 4) return null;
  if (!isInteger(tokens[0])) return null;
  let numPacIdx = -1;
  for (let i = 3; i < tokens.length; i++) {
    if (isInteger(tokens[i]) && isMoney(tokens[i - 1]) && isMoney(tokens[i - 2])) { numPacIdx = i; break; }
  }
  if (numPacIdx === -1) {
    for (let i = 3; i < tokens.length; i++) if (isInteger(tokens[i])) { numPacIdx = i; break; }
  }
  if (numPacIdx === -1 || numPacIdx < 3) return null;
  const nombre = tokens.slice(1, numPacIdx - 2).join(" ").trim();
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

function parseCuentasRow(tokens: string[]): DataRow | null {
  if (tokens.length < 4) return null;
  if (!isInteger(tokens[0])) return null;
  const dollarIdx = tokens.findIndex((t, i) => i > 0 && t === "$");
  if (dollarIdx === -1 || dollarIdx === tokens.length - 1 || dollarIdx < 3) return null;
  const montoUsd = parseNum(tokens[dollarIdx + 1]);
  const totalBs = parseNum(tokens[dollarIdx - 1]);
  const totalDolar = parseNum(tokens[dollarIdx - 2]);
  const nombre = tokens.slice(1, dollarIdx - 2).join(" ").trim();
  if (!nombre || nombre.length < 2) return null;
  return { name: nombre, totalDolar, totalBs, numPac: 0, porcClinica: 0, comentarios: "", _cuentasIngresoUsd: montoUsd };
}

function extractDataRows(lines: string[], sectionStart: number, sectionEnd: number, section: "standard" | "cuentas" = "standard"): DataRow[] {
  const headerEnd = findHeaderEnd(lines, sectionStart + 1);
  if (headerEnd === null) return [];
  const rows: DataRow[] = [];
  let pendingName = "";
  for (let i = headerEnd + 1; i < sectionEnd; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    if (/Totales|Total General/i.test(line)) continue;
    if (/^[\s═─]+$/.test(line)) continue;
    const tokens = line.trim().split(/\s{2,}/);
    if (section === "cuentas" && !/^\s*\d+\s/.test(line)) {
      if (tokens.length === 1 && !isMoney(tokens[0])) pendingName = pendingName ? `${pendingName} ${tokens[0]}` : tokens[0];
      continue;
    }
    if (!/^\s*\d+\s/.test(line)) continue;
    let row: DataRow | null = null;
    if (section === "cuentas") {
      row = parseStandardRow(tokens) || parseCuentasRow(tokens);
      if (row && pendingName) { row.name = `${pendingName} ${row.name}`.trim(); pendingName = ""; }
    } else {
      row = parseStandardRow(tokens);
    }
    if (row) rows.push(row);
  }
  return rows;
}

function findSection(lines: string[], pattern: RegExp, from = 0): number {
  for (let i = from; i < lines.length; i++) if (pattern.test(lines[i])) return i;
  return -1;
}

function parsePDF(pdfPath: string) {
  let text: string;
  try { text = execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: "utf8", timeout: 15000 }); }
  catch { return null; }
  const lines = text.split("\n");
  const fecha = parseDate(text);
  if (!fecha) return null;
  const tasa = parseTasa(lines);
  const iCons = findSection(lines, /Unidades de Consulta/i);
  const iLab = findSection(lines, /Unidades de Servicios.*Laborator/i);
  const iPac = findSection(lines, /Pacientes.*Emergencia.*Hospitaliz/i);
  const iAnt = findSection(lines, /^[\s]*Anticipos/i);
  const iCue = findSection(lines, /Cuentas Por Cobrar.*Convenios/i);
  const iAps = findSection(lines, /UNIDAD DE APS/i);
  const iEnd = lines.length;
  const endOf = (idx: number, ...nexts: number[]) => { const v = nexts.filter(n => n > idx); return v.length > 0 ? Math.min(...v) : iEnd; };
  const cons = iCons >= 0 ? extractDataRows(lines, iCons, endOf(iCons, iLab, iPac, iAnt, iCue, iAps)) : [];
  const serv = iLab >= 0 ? extractDataRows(lines, iLab, endOf(iLab, iPac, iAnt, iCue, iAps)) : [];
  const ant = iAnt >= 0 ? extractDataRows(lines, iAnt, endOf(iAnt, iCue, iAps)) : [];
  const cue = iCue >= 0 ? extractDataRows(lines, iCue, endOf(iCue, iAps), "cuentas") : [];
  return { fecha, tasa, cons, serv, ant, cue };
}

async function main() {
  const pdfs = fs.readdirSync(PDF_DIR).filter(f => f.toLowerCase().endsWith(".pdf")).sort();
  console.log(`📂 ${pdfs.length} PDFs\n`);

  const sumPDF = { consBs: 0, servBs: 0, antBs: 0, cueBs: 0, consPac: 0, servPac: 0, cuePac: 0 };
  const sumDB = { consBs: 0, servBs: 0, antBs: 0, cueBs: 0, consPac: 0, servPac: 0, cuePac: 0 };
  const daysWithDiff: Array<{ fecha: string; deltaBs: number; notes: string }> = [];
  const daysNoDbMatch: string[] = [];
  const daysParseErr: string[] = [];

  for (const file of pdfs) {
    const parsed = parsePDF(path.join(PDF_DIR, file));
    if (!parsed) { daysParseErr.push(file); continue; }
    const fechaDate = new Date(parsed.fecha + "T12:00:00.000Z");
    const dbRep = await prisma.dailyReport.findUnique({
      where: { fecha: fechaDate },
      include: { consultas: true, servicios: true, anticipos: true, cuentasPorCobrar: true },
    });

    const pdfConsBs = parsed.cons.reduce((s, x) => s + x.totalBs, 0);
    const pdfServBs = parsed.serv.reduce((s, x) => s + x.totalBs, 0);
    const pdfAntBs = parsed.ant.reduce((s, x) => s + x.totalBs, 0);
    const pdfCueBs = parsed.cue.reduce((s, x) => s + x.totalBs, 0);
    const pdfCueUsd = parsed.cue.reduce((s, x) => s + (x._cuentasIngresoUsd ?? x.totalDolar), 0);
    const pdfConsPac = parsed.cons.reduce((s, x) => s + x.numPac, 0);
    const pdfServPac = parsed.serv.reduce((s, x) => s + x.numPac, 0);
    const pdfCuePac = parsed.cue.reduce((s, x) => s + x.numPac, 0);
    sumPDF.consBs += pdfConsBs; sumPDF.servBs += pdfServBs; sumPDF.antBs += pdfAntBs; sumPDF.cueBs += pdfCueBs;
    sumPDF.consPac += pdfConsPac; sumPDF.servPac += pdfServPac; sumPDF.cuePac += pdfCuePac;

    if (!dbRep) { daysNoDbMatch.push(parsed.fecha); continue; }

    const dbConsBs = dbRep.consultas.reduce((s, x) => s + x.totalBs, 0);
    const dbServBs = dbRep.servicios.reduce((s, x) => s + x.totalBs, 0);
    const dbAntBs = dbRep.anticipos.reduce((s, x) => s + x.totalBs, 0);
    const dbCueBs = dbRep.cuentasPorCobrar.reduce((s, x) => s + x.totalBs, 0);
    const dbConsPac = dbRep.consultas.reduce((s, x) => s + x.numPacientes, 0);
    const dbServPac = dbRep.servicios.reduce((s, x) => s + x.numPacientes, 0);
    const dbCuePac = dbRep.cuentasPorCobrar.reduce((s, x) => s + x.numPacientes, 0);
    sumDB.consBs += dbConsBs; sumDB.servBs += dbServBs; sumDB.antBs += dbAntBs; sumDB.cueBs += dbCueBs;
    sumDB.consPac += dbConsPac; sumDB.servPac += dbServPac; sumDB.cuePac += dbCuePac;

    const deltaBs = (pdfConsBs + pdfServBs + pdfAntBs + pdfCueBs) - (dbConsBs + dbServBs + dbAntBs + dbCueBs);
    const deltaPac = (pdfConsPac + pdfServPac + pdfCuePac) - (dbConsPac + dbServPac + dbCuePac);
    const notes: string[] = [];
    if (Math.abs(pdfConsBs - dbConsBs) > 1) notes.push(`cons Bs:${(pdfConsBs - dbConsBs).toFixed(0)}`);
    if (Math.abs(pdfServBs - dbServBs) > 1) notes.push(`serv Bs:${(pdfServBs - dbServBs).toFixed(0)}`);
    if (Math.abs(pdfAntBs - dbAntBs) > 1) notes.push(`ant Bs:${(pdfAntBs - dbAntBs).toFixed(0)}`);
    if (Math.abs(pdfCueBs - dbCueBs) > 1) notes.push(`cue Bs:${(pdfCueBs - dbCueBs).toFixed(0)}`);
    if (deltaPac !== 0) notes.push(`pac:${deltaPac > 0 ? "+" : ""}${deltaPac}`);
    if (notes.length > 0) daysWithDiff.push({ fecha: parsed.fecha, deltaBs, notes: notes.join(", ") });
  }

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("📊 DIFERENCIAS AGREGADAS (PDF real vs BD actual)");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Consultas  Bs: ${fmt(sumDB.consBs).padStart(18)} → ${fmt(sumPDF.consBs).padStart(18)}  Δ ${fmt(sumPDF.consBs - sumDB.consBs)}`);
  console.log(`Servicios  Bs: ${fmt(sumDB.servBs).padStart(18)} → ${fmt(sumPDF.servBs).padStart(18)}  Δ ${fmt(sumPDF.servBs - sumDB.servBs)}`);
  console.log(`Anticipos  Bs: ${fmt(sumDB.antBs).padStart(18)} → ${fmt(sumPDF.antBs).padStart(18)}  Δ ${fmt(sumPDF.antBs - sumDB.antBs)}`);
  console.log(`Cuentas    Bs: ${fmt(sumDB.cueBs).padStart(18)} → ${fmt(sumPDF.cueBs).padStart(18)}  Δ ${fmt(sumPDF.cueBs - sumDB.cueBs)}`);
  console.log("---");
  const totDB = sumDB.consBs + sumDB.servBs + sumDB.antBs + sumDB.cueBs;
  const totPDF = sumPDF.consBs + sumPDF.servBs + sumPDF.antBs + sumPDF.cueBs;
  console.log(`GRAN TOTAL Bs: ${fmt(totDB).padStart(18)} → ${fmt(totPDF).padStart(18)}  Δ ${fmt(totPDF - totDB)}`);
  console.log();
  console.log(`Pacientes consultas: ${sumDB.consPac} → ${sumPDF.consPac}  Δ ${sumPDF.consPac - sumDB.consPac}`);
  console.log(`Pacientes servicios: ${sumDB.servPac} → ${sumPDF.servPac}  Δ ${sumPDF.servPac - sumDB.servPac}`);
  console.log(`Pacientes cuentas  : ${sumDB.cuePac} → ${sumPDF.cuePac}  Δ ${sumPDF.cuePac - sumDB.cuePac}`);

  console.log();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`🔢 ${daysWithDiff.length} días con diferencias (de ${pdfs.length} PDFs)`);
  console.log("═══════════════════════════════════════════════════════════════");
  // Mostrar los top 20 por delta absoluto
  daysWithDiff.sort((a, b) => Math.abs(b.deltaBs) - Math.abs(a.deltaBs));
  for (const d of daysWithDiff.slice(0, 20)) {
    console.log(`  ${d.fecha}  Δ Bs ${fmt(d.deltaBs).padStart(14)}  |  ${d.notes}`);
  }
  if (daysWithDiff.length > 20) console.log(`  ... y ${daysWithDiff.length - 20} días más`);

  if (daysNoDbMatch.length > 0) {
    console.log(`\n⚠️  ${daysNoDbMatch.length} PDFs sin reporte en BD (se crearían nuevos):`);
    daysNoDbMatch.slice(0, 10).forEach(d => console.log(`   ${d}`));
    if (daysNoDbMatch.length > 10) console.log(`   ... y ${daysNoDbMatch.length - 10} más`);
  }
  if (daysParseErr.length > 0) {
    console.log(`\n❌ ${daysParseErr.length} PDFs con error de parseo (no se tocarían):`);
    daysParseErr.slice(0, 10).forEach(d => console.log(`   ${d}`));
    if (daysParseErr.length > 10) console.log(`   ... y ${daysParseErr.length - 10} más`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
