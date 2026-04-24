/**
 * Prueba el parser ARREGLADO contra el PDF del 1-abr-2026.
 * Solo-lectura: no toca la base de datos.
 * Compara los totales extraídos contra los totales declarados en el PDF.
 */
import { execSync } from "child_process";

function parseNum(s: string): number {
  if (!s) return 0;
  return parseFloat(s.trim().replace(/\./g, "").replace(",", ".")) || 0;
}

interface DataRow {
  name: string;
  totalDolar: number;
  totalBs: number;
  numPac: number;
  porcClinica: number;
  comentarios: string;
}

function findHeaderEnd(lines: string[], fromIdx: number): number | null {
  for (let i = fromIdx; i < Math.min(fromIdx + 6, lines.length); i++) {
    if (lines[i].includes("Total Bs.")) return i;
  }
  return null;
}

function parseRowTokens(tokens: string[]): DataRow | null {
  if (tokens.length < 4) return null;
  const code = tokens[0];
  if (!/^\d+$/.test(code)) return null;
  const isInteger = (s: string) => /^\d+$/.test(s);
  const isMoney = (s: string) => /^[\d.,]+$/.test(s) && /[.,]/.test(s);
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
  const nombre = tokens.slice(1, numPacIdx - 2).join(" ").trim();
  const totalDolar = parseNum(tokens[numPacIdx - 2]);
  const totalBs = parseNum(tokens[numPacIdx - 1]);
  const numPac = parseInt(tokens[numPacIdx]) || 0;
  let porcClinica = 0, comentarios = "";
  const rest = tokens.slice(numPacIdx + 1);
  if (rest.length > 0) {
    if (isMoney(rest[0])) {
      porcClinica = parseNum(rest[0]);
      comentarios = rest.slice(1).join(" ").trim();
    } else {
      comentarios = rest.join(" ").trim();
    }
  }
  if (!nombre || nombre.length < 2) return null;
  return { name: nombre, totalDolar, totalBs, numPac, porcClinica, comentarios };
}

function extractDataRows(lines: string[], sectionStart: number, sectionEnd: number): DataRow[] {
  const headerEnd = findHeaderEnd(lines, sectionStart + 1);
  if (headerEnd === null) return [];
  const rows: DataRow[] = [];
  for (let i = headerEnd + 1; i < sectionEnd; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    if (/Totales|Total General/i.test(line)) continue;
    if (/^[\s═─]+$/.test(line)) continue;
    if (!/^\s*\d+\s/.test(line)) continue;
    const tokens = line.trim().split(/\s{2,}/);
    const row = parseRowTokens(tokens);
    if (row) rows.push(row);
  }
  return rows;
}

const text = execSync(
  `pdftotext -layout "/Users/kasanmaklad/Downloads/Caja del 01-04-26.pdf" -`,
  { encoding: "utf8" }
);
const lines = text.split("\n");

const findSection = (pat: RegExp, from = 0) => {
  for (let i = from; i < lines.length; i++) if (pat.test(lines[i])) return i;
  return -1;
};

const iCons = findSection(/Unidades de Consulta/i);
const iLab = findSection(/Unidades de Servicios.*Laborator/i);
const iPac = findSection(/Pacientes.*Emergencia.*Hospitaliz/i);
const iAnt = findSection(/^[\s]*Anticipos/i);
const iCue = findSection(/Cuentas Por Cobrar.*Convenios/i);
const iAps = findSection(/UNIDAD DE APS/i);

const cons = extractDataRows(lines, iCons, iLab);
const serv = extractDataRows(lines, iLab, iPac);
const ant = extractDataRows(lines, iAnt, iCue);
const cue = extractDataRows(lines, iCue, iAps);

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

console.log("═══════════════ CONSULTAS ═══════════════");
for (const r of cons) {
  console.log(`  ${r.name.padEnd(30)} pac=${String(r.numPac).padStart(3)}  Bs ${fmt(r.totalBs).padStart(14)}  $${fmt(r.totalDolar).padStart(8)}  pct=${fmt(r.porcClinica)}`);
}
const cBs = cons.reduce((s, x) => s + x.totalBs, 0);
const cPac = cons.reduce((s, x) => s + x.numPac, 0);
const cDol = cons.reduce((s, x) => s + x.totalDolar, 0);
const cPct = cons.reduce((s, x) => s + x.porcClinica, 0);
console.log(`  TOTAL: pac=${cPac}  Bs ${fmt(cBs)}  $${fmt(cDol)}  pct=${fmt(cPct)}`);
console.log(`  PDF dice: pac=76  Bs 766.883,24  $40,00  pct=655,00`);
console.log(`  ${cBs === 766883.24 && cPac === 76 && cDol === 40 && cPct === 655 ? "✅ MATCH" : "❌ NO MATCH"}`);

console.log("\n═══════════════ SERVICIOS ═══════════════");
for (const r of serv) {
  console.log(`  ${r.name.padEnd(30)} pac=${String(r.numPac).padStart(3)}  Bs ${fmt(r.totalBs).padStart(14)}  $${fmt(r.totalDolar).padStart(8)}`);
}
const sBs = serv.reduce((s, x) => s + x.totalBs, 0);
const sPac = serv.reduce((s, x) => s + x.numPac, 0);
const sDol = serv.reduce((s, x) => s + x.totalDolar, 0);
console.log(`  TOTAL: pac=${sPac}  Bs ${fmt(sBs)}  $${fmt(sDol)}`);
console.log(`  PDF dice: pac=95  Bs 3.340.182,82  $106,00`);
console.log(`  ${sBs === 3340182.82 && sPac === 95 && sDol === 106 ? "✅ MATCH" : "❌ NO MATCH"}`);

console.log("\n═══════════════ ANTICIPOS ═══════════════");
for (const r of ant) {
  console.log(`  ${r.name.padEnd(20)} Bs ${fmt(r.totalBs).padStart(14)}  $${fmt(r.totalDolar).padStart(8)}  | ${r.comentarios}`);
}
const aBs = ant.reduce((s, x) => s + x.totalBs, 0);
const aDol = ant.reduce((s, x) => s + x.totalDolar, 0);
console.log(`  TOTAL: Bs ${fmt(aBs)}  $${fmt(aDol)}`);
console.log(`  PDF dice: Bs 1.684.984,64  $0,00`);
console.log(`  ${aBs === 1684984.64 && aDol === 0 ? "✅ MATCH" : "❌ NO MATCH"}`);

console.log("\n═══════════════ CUENTAS POR COBRAR ═══════════════");
console.log(`  ${cue.length} filas parseadas (PDF tiene 0 convenios ese día)`);
