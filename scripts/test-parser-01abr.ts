/**
 * Solo-lectura: ejecuta el parser actual contra el PDF del 1-abr-2026
 * para reproducir el bug de truncación.
 */
import { execSync } from "child_process";

function parseNum(s: string): number {
  if (!s) return 0;
  return parseFloat(s.trim().replace(/\./g, "").replace(",", ".")) || 0;
}

function findColPos(lines: string[], fromIdx: number) {
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

const text = execSync(
  `pdftotext -layout "/Users/kasanmaklad/Downloads/Caja del 01-04-26.pdf" -`,
  { encoding: "utf8" }
);
const lines = text.split("\n");

// Encontrar la sección de consultas
const iCons = lines.findIndex((l) => /Unidades de Consulta/i.test(l));
console.log(`Sección Consultas empieza en línea ${iCons}`);

const cols = findColPos(lines, iCons + 1);
console.log("Columnas:", cols);
console.log();

// Mostrar cómo se extraen los valores para cada línea de consultas
console.log("Línea raw → totalBs extraído:");
for (let i = cols!.headerEnd + 1; i < cols!.headerEnd + 20; i++) {
  const line = lines[i];
  if (!line || !line.trim()) continue;
  if (/Totales/i.test(line)) break;
  if (!/^\s*\d+\s/.test(line)) continue;

  const substr = line.substring(cols!.colBs, cols!.colPac - 2);
  const num = parseNum(substr);
  const nombre = line.substring(0, cols!.colDolar > 0 ? cols!.colDolar - 1 : 30).replace(/^\s*\d+\s+/, "").trim();
  console.log(
    `  "${nombre.padEnd(25)}" → substring(${cols!.colBs}, ${cols!.colPac - 2}) = "${substr}" = ${num}`
  );
}

// Ahora probar enfoque por tokens: split(/\s{2,}/)
console.log("\n\n==== CON SPLIT POR 2+ ESPACIOS ====");
for (let i = cols!.headerEnd + 1; i < cols!.headerEnd + 20; i++) {
  const line = lines[i];
  if (!line || !line.trim()) continue;
  if (/Totales/i.test(line)) break;
  if (!/^\s*\d+\s/.test(line)) continue;
  const tokens = line.trim().split(/\s{2,}/);
  console.log(`  tokens = ${JSON.stringify(tokens)}`);
}
