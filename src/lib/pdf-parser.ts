/**
 * Parser de PDFs de "Ingresos de Caja Diario" de la Clínica.
 * Extrae fecha, tasa y todas las secciones del reporte.
 */

const MESES: Record<string, number> = {
  ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6,
  JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12,
};

/** Convierte número venezolano "1.234,56" → 1234.56 */
const vzNum = (s: string): number =>
  parseFloat((s || "").replace(/\./g, "").replace(",", ".")) || 0;

export interface PDFReporte {
  fecha: string; // YYYY-MM-DD
  tasaCambio: number;
  consultas: Array<{
    codigo: number;
    nombre: string;
    totalBs: number;
    ingresoDivisa: number;
    numPacientes: number;
    porcentajeClinica: number;
  }>;
  servicios: Array<{
    nombre: string;
    totalBs: number;
    ingresoDivisa: number;
    numPacientes: number;
  }>;
  pacientesArea: Array<{ area: string; numPacientes: number }>;
  anticipos: Array<{
    tipo: string;
    totalBs: number;
    ingresoDivisa: number;
    pacienteNombre?: string;
  }>;
  cuentas: Array<{
    nombreConvenio: string;
    totalBs: number;
    ingresoDivisa: number;
  }>;
  aps: {
    consultas: number;
    laboratoriosImagenes: number;
    movimientosDia: number;
    totalFacturados: number;
  } | null;
}

/**
 * Une líneas "huérfanas" (un número solo) con las siguientes líneas
 * hasta completar la fila de datos (termina en número).
 */
function preprocessLines(rawLines: string[]): string[] {
  const filtered = rawLines
    .map((l) => l.trim())
    .filter((l) => l && !l.match(/^--\s*\d+\s+of\s+\d+\s*--$/));

  const result: string[] = [];
  let i = 0;

  while (i < filtered.length) {
    const line = filtered[i];

    // Línea que es SOLO un número → posible inicio de fila multi-línea
    if (/^\d+$/.test(line)) {
      let combined = line;
      let j = i + 1;
      while (j < filtered.length) {
        const next = filtered[j];
        if (
          /^\d/.test(next) ||
          next.startsWith("N°") ||
          next.startsWith("Totales") ||
          next.startsWith("Total ")
        )
          break;
        combined += " " + next;
        j++;
        // Parar una vez que la línea termine con un número
        if (/[\d.,]+$/.test(combined)) break;
      }
      if (j > i + 1) {
        result.push(combined);
        i = j;
        continue;
      }
    }

    result.push(line);
    i++;
  }

  return result;
}

/** Patrones de líneas a ignorar (títulos de sección, subtotales, encabezados de página) */
const SKIP = [
  /^Totales\b/,
  /^Total General\b/,
  /^GERENCIA/,
  /^Ingresos de Caja/,
  /^Movimientos del d/i,
  /^Tasa del dia/i,
  /^Unidades de/i,
  /^Pacientes:/i,
  /^Anticipos\b/,
  /^Cuentas Por/i,
  /^UNIDAD DE APS/,
  /^Comentarios$/,
  /^No Facturados/,
  /^Facturados de/,
];

export function parsePdfText(text: string): PDFReporte {
  // ── Fecha ──────────────────────────────────────────────────────────────
  const dateMatch = text.match(
    /Movimientos del d[íi]a\s+(\d{1,2})\s+DE\s+(\w+)\s+de\s+(\d{4})/i
  );
  if (!dateMatch) throw new Error("Fecha no encontrada en el PDF");

  const dia = parseInt(dateMatch[1]);
  const mes = MESES[dateMatch[2].toUpperCase()];
  if (!mes) throw new Error(`Mes desconocido: ${dateMatch[2]}`);
  const año = parseInt(dateMatch[3]);
  const fecha = `${año}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

  // ── Tasa ───────────────────────────────────────────────────────────────
  const tasaMatch = text.match(/Tasa del dia:\s*([\d.,]+)/i);
  if (!tasaMatch) throw new Error("Tasa de cambio no encontrada en el PDF");
  const tasaCambio = vzNum(tasaMatch[1]);

  // ── Preprocesar líneas ─────────────────────────────────────────────────
  const lines = preprocessLines(text.split("\n"));

  // ── Estado del parser ──────────────────────────────────────────────────
  type Sec =
    | "consultas"
    | "servicios"
    | "pacientes"
    | "anticipos"
    | "cuentas"
    | "aps"
    | null;
  let sec: Sec = null;
  let serviciosCount = 0; // cuántas veces aparece el header "N° Unidad Total $"

  const consultas: PDFReporte["consultas"] = [];
  const servicios: PDFReporte["servicios"] = [];
  const pacientesArea: PDFReporte["pacientesArea"] = [];
  const anticipos: PDFReporte["anticipos"] = [];
  const cuentas: PDFReporte["cuentas"] = [];
  let apsC = 0,
    apsL = 0,
    apsM = 0,
    apsF = 0,
    apsFound = false;

  for (const line of lines) {
    // ── Detección de sección ─────────────────────────────────────────────
    if (/N° Unidad de Consulta/.test(line) && /Total \$/.test(line)) {
      sec = "consultas";
      continue;
    }
    if (
      /N° Unidad/.test(line) &&
      /Total \$/.test(line) &&
      /Total Bs\./.test(line)
    ) {
      serviciosCount++;
      sec =
        serviciosCount === 1
          ? "servicios"
          : serviciosCount === 2
          ? "anticipos"
          : "cuentas";
      continue;
    }
    if (/N° Unidad/.test(line) && /N° de Pacientes/.test(line)) {
      sec = /% \$/.test(line) ? "pacientes" : "aps";
      continue;
    }

    // ── Saltar líneas no relevantes ──────────────────────────────────────
    if (SKIP.some((p) => p.test(line))) continue;
    if (!sec) continue;

    // La mayoría de filas de datos empiezan con dígito
    if (!/^\d/.test(line) && sec !== "aps") continue;
    if (!/^\d/.test(line) && sec === "aps") continue;

    // ── Parseo por sección ───────────────────────────────────────────────
    switch (sec) {
      case "consultas": {
        // N° NOMBRE  DIVISA  TOTAL_BS  PACIENTES  PCT
        const m = line.match(
          /^(\d+)\s+(.+?)\s+([\d.,]+)\s+([\d.,]+)\s+(\d+)\s+([\d.,]+)/
        );
        if (m)
          consultas.push({
            codigo: parseInt(m[1]),
            nombre: m[2].trim(),
            ingresoDivisa: vzNum(m[3]),
            totalBs: vzNum(m[4]),
            numPacientes: parseInt(m[5]),
            porcentajeClinica: vzNum(m[6]),
          });
        break;
      }

      case "servicios": {
        // N° NOMBRE  DIVISA  TOTAL_BS  PACIENTES
        const m = line.match(
          /^(\d+)\s+(.+?)\s+([\d.,]+)\s+([\d.,]+)\s+(\d+)$/
        );
        if (m)
          servicios.push({
            nombre: m[2].trim(),
            ingresoDivisa: vzNum(m[3]),
            totalBs: vzNum(m[4]),
            numPacientes: parseInt(m[5]),
          });
        break;
      }

      case "pacientes": {
        // N° ÁREA  PACIENTES
        const m = line.match(/^(\d+)\s+(.+?)\s+(\d+)$/);
        if (m && parseInt(m[3]) > 0) {
          let area = m[2].trim();
          if (/hospitalizaci/i.test(area)) area = "Hospitalización";
          else if (/emergencia/i.test(area)) area = "Emergencia";
          else if (/uci/i.test(area)) area = "UCI";
          pacientesArea.push({ area, numPacientes: parseInt(m[3]) });
        }
        break;
      }

      case "anticipos": {
        // N° TIPO  DIVISA  TOTAL_BS  PACIENTES  [NOMBRE_PACIENTE]
        const m = line.match(
          /^(\d+)\s+(HOSPITALIZACION|EMERGENCIA|ESTUDIOS)\s+([\d.,]+)\s+([\d.,]+)\s+\d+(?:\s+(.+))?$/i
        );
        if (m)
          anticipos.push({
            tipo: m[2].toUpperCase(),
            ingresoDivisa: vzNum(m[3]),
            totalBs: vzNum(m[4]),
            pacienteNombre: m[5]?.trim() || undefined,
          });
        break;
      }

      case "cuentas": {
        // [N°] CONVENIO  DIVISA  TOTAL_BS  $  MONTO_USD
        const m = line.match(
          /^(?:\d+\s+)?(.+?)\s+([\d.,]+)\s+([\d.,]+)\s+\$\s+([\d.,]+)/
        );
        if (m)
          cuentas.push({
            nombreConvenio: m[1].trim(),
            totalBs: vzNum(m[3]),
            ingresoDivisa: vzNum(m[4]),
          });
        break;
      }

      case "aps": {
        // N° DESCRIPCIÓN  CANTIDAD
        const m = line.match(/^(?:\d+\s+)?(.+?)\s+(\d+)$/);
        if (m) {
          const k = m[1]
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
          const v = parseInt(m[2]);
          if (k.includes("consultas")) {
            apsC = v;
            apsFound = true;
          } else if (k.includes("laboratorio")) {
            apsL = v;
            apsFound = true;
          } else if (k.includes("movimiento")) {
            apsM = v;
            apsFound = true;
          }
        }
        break;
      }
    }
  }

  // "Total Facturados" no empieza con dígito → buscarlo directamente
  const factMatch = text.match(/Total Facturados al[^0-9]*(\d+)/i);
  if (factMatch) {
    apsF = parseInt(factMatch[1]);
    apsFound = true;
  }

  return {
    fecha,
    tasaCambio,
    consultas,
    servicios,
    pacientesArea,
    anticipos,
    cuentas,
    aps: apsFound
      ? {
          consultas: apsC,
          laboratoriosImagenes: apsL,
          movimientosDia: apsM,
          totalFacturados: apsF,
        }
      : null,
  };
}
