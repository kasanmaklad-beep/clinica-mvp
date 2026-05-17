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
    efectivoUsd: number;
    numPacientes: number;
    porcentajeClinica: number;
  }>;
  servicios: Array<{
    nombre: string;
    totalBs: number;
    ingresoDivisa: number;
    efectivoUsd: number;
    numPacientes: number;
  }>;
  pacientesArea: Array<{ area: string; numPacientes: number }>;
  anticipos: Array<{
    tipo: string;
    totalBs: number;
    ingresoDivisa: number;
    efectivoUsd: number;
    pacienteNombre?: string;
  }>;
  cuentas: Array<{
    nombreConvenio: string;
    totalBs: number;
    ingresoDivisa: number;
    efectivoUsd: number;
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
  // En el formato nuevo del PDF el header de cada tabla se reparte en varias
  // líneas (la columna "EFECTIVO $ ENTREGADO A HCDE" añadida en mayo 2026 hace
  // wrap del header). Antes una sola línea contenía "N° Unidad ... Total $".
  // Ahora "N° Unidad" queda solo en una línea y los demás keywords aparecen
  // después. Usamos "N° Unidad" como pivote único y contamos el orden de
  // aparición para inferir la sección.
  //   1ª "N° Unidad de Consulta" → consultas (kw distinto)
  //   1ª "N° Unidad"             → servicios
  //   2ª "N° Unidad"             → pacientes (área)
  //   3ª "N° Unidad"             → anticipos
  //   4ª "N° Unidad"             → cuentas
  //   5ª "N° Unidad"             → aps
  let nUnidadCount = 0;

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
    if (/^N° Unidad de Consulta/.test(line)) {
      sec = "consultas";
      continue;
    }
    if (/^N° Unidad/.test(line)) {
      nUnidadCount++;
      sec =
        nUnidadCount === 1 ? "servicios"
        : nUnidadCount === 2 ? "pacientes"
        : nUnidadCount === 3 ? "anticipos"
        : nUnidadCount === 4 ? "cuentas"
        : "aps";
      continue;
    }

    // ── Saltar líneas no relevantes ──────────────────────────────────────
    if (SKIP.some((p) => p.test(line))) continue;
    if (!sec) continue;

    // Toda fila de datos arranca con dígito
    if (!/^\d/.test(line)) continue;

    // ── Parseo por sección ───────────────────────────────────────────────
    switch (sec) {
      case "consultas": {
        // Dos formatos posibles:
        //   antiguo (4 nums): codigo NOMBRE TOTAL$ TOTAL_BS PAC %CLIN
        //   nuevo   (5 nums): codigo NOMBRE EFECTIVO TOTAL$ TOTAL_BS PAC %CLIN
        // Probamos 5-num primero. Heurística: EFECTIVO ≤ TOTAL$ y TOTAL_BS > 100
        // (los Bs son siempre miles o más). Si falla la sanidad, asumimos
        // formato antiguo. Esto también evita que nombres con números (ej.
        // "Ginecología 2") se interpreten mal.
        const m5 = line.match(
          /^(\d+)\s+(.+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+(\d+)\s+([\d.,]+)/
        );
        if (m5) {
          const efectivo = vzNum(m5[3]);
          const totalDolar = vzNum(m5[4]);
          const totalBs = vzNum(m5[5]);
          if (efectivo <= totalDolar + 0.01 && totalBs > 100) {
            consultas.push({
              codigo: parseInt(m5[1]),
              nombre: m5[2].trim(),
              efectivoUsd: efectivo,
              ingresoDivisa: totalDolar,
              totalBs,
              numPacientes: parseInt(m5[6]),
              porcentajeClinica: vzNum(m5[7]),
            });
            break;
          }
        }
        const m = line.match(
          /^(\d+)\s+(.+?)\s+([\d.,]+)\s+([\d.,]+)\s+(\d+)\s+([\d.,]+)/
        );
        if (m)
          consultas.push({
            codigo: parseInt(m[1]),
            nombre: m[2].trim(),
            efectivoUsd: 0,
            ingresoDivisa: vzNum(m[3]),
            totalBs: vzNum(m[4]),
            numPacientes: parseInt(m[5]),
            porcentajeClinica: vzNum(m[6]),
          });
        break;
      }

      case "servicios": {
        // Dos formatos:
        //   antiguo (3 nums): codigo NOMBRE TOTAL$ TOTAL_BS PAC
        //   nuevo   (4 nums): codigo NOMBRE EFECTIVO TOTAL$ TOTAL_BS PAC
        const m4 = line.match(
          /^(\d+)\s+(.+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+(\d+)\s*$/
        );
        if (m4) {
          const efectivo = vzNum(m4[3]);
          const totalDolar = vzNum(m4[4]);
          const totalBs = vzNum(m4[5]);
          if (efectivo <= totalDolar + 0.01 && totalBs > 100) {
            servicios.push({
              nombre: m4[2].trim(),
              efectivoUsd: efectivo,
              ingresoDivisa: totalDolar,
              totalBs,
              numPacientes: parseInt(m4[6]),
            });
            break;
          }
        }
        const m = line.match(
          /^(\d+)\s+(.+?)\s+([\d.,]+)\s+([\d.,]+)\s+(\d+)$/
        );
        if (m)
          servicios.push({
            nombre: m[2].trim(),
            efectivoUsd: 0,
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
        // Dos formatos:
        //   antiguo (3 nums): codigo TIPO TOTAL$ TOTAL_BS PAC [NOMBRE]
        //   nuevo   (4 nums): codigo TIPO EFECTIVO TOTAL$ TOTAL_BS PAC [NOMBRE]
        const m4 = line.match(
          /^(\d+)\s+(HOSPITALIZACION|EMERGENCIA|ESTUDIOS)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+\d+(?:\s+(.+))?$/i
        );
        if (m4) {
          anticipos.push({
            tipo: m4[2].toUpperCase(),
            efectivoUsd: vzNum(m4[3]),
            ingresoDivisa: vzNum(m4[4]),
            totalBs: vzNum(m4[5]),
            pacienteNombre: m4[6]?.trim() || undefined,
          });
          break;
        }
        const m = line.match(
          /^(\d+)\s+(HOSPITALIZACION|EMERGENCIA|ESTUDIOS)\s+([\d.,]+)\s+([\d.,]+)\s+\d+(?:\s+(.+))?$/i
        );
        if (m)
          anticipos.push({
            tipo: m[2].toUpperCase(),
            efectivoUsd: 0,
            ingresoDivisa: vzNum(m[3]),
            totalBs: vzNum(m[4]),
            pacienteNombre: m[5]?.trim() || undefined,
          });
        break;
      }

      case "cuentas": {
        // Formato real (antiguo): [N°] CONVENIO TOTAL$ TOTAL_BS [PAC] [%] [$comentario]
        // Formato real (nuevo):   [N°] CONVENIO EFECTIVO TOTAL$ TOTAL_BS [PAC] [%] [$comentario]
        // - PAC y % suelen venir vacíos en convenios.
        // - El "$X,XX" del comentario puede venir pegado al $ o con espacio.
        // Para decidir formato contamos cuántos números trae la línea (sin
        // contar el código líder).
        const allNums = line.match(/[\d.,]+/g) || [];
        const leadingCode = /^\d+\s/.test(line) ? 1 : 0;
        const numCount = allNums.length - leadingCode;
        const isNuevo = numCount >= 5;
        // Filtro: descartamos filas placeholder (nombre puramente numérico o
        // valores en cero). El PDF a veces deja filas vacías como "1 0,00 0,00".
        const pushIfReal = (row: PDFReporte["cuentas"][number]) => {
          const nombreEsNumero = /^\d+$/.test(row.nombreConvenio);
          const todoCero =
            row.totalBs === 0 &&
            row.ingresoDivisa === 0 &&
            row.efectivoUsd === 0;
          if (nombreEsNumero && todoCero) return;
          cuentas.push(row);
        };
        if (isNuevo) {
          const m = line.match(
            /^(?:\d+\s+)?(.+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)(?:\s+\d+)?(?:\s+[\d.,]+)?(?:\s+\$\s*([\d.,]+))?/
          );
          if (m)
            pushIfReal({
              nombreConvenio: m[1].trim(),
              efectivoUsd: vzNum(m[2]),
              // Si el comentario trae "$X,XX" lo usamos como ingreso divisa
              // canónico; si no, Total $ (m[3]).
              ingresoDivisa: vzNum(m[5] || m[3]),
              totalBs: vzNum(m[4]),
            });
        } else {
          const m = line.match(
            /^(?:\d+\s+)?(.+?)\s+([\d.,]+)\s+([\d.,]+)(?:\s+\d+)?(?:\s+[\d.,]+)?(?:\s+\$\s*([\d.,]+))?/
          );
          if (m)
            pushIfReal({
              nombreConvenio: m[1].trim(),
              efectivoUsd: 0,
              ingresoDivisa: vzNum(m[4] || m[2]),
              totalBs: vzNum(m[3]),
            });
        }
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

  // "Total Facturados" no empieza con dígito → buscarlo directamente.
  // En el formato "Total Facturados al DD/MM/YYYY NN" tomamos el ÚLTIMO entero
  // de la línea (NN), no el primero (que sería el "DD" de la fecha).
  const factMatch = text.match(/Total Facturados al[^\n]*?(\d+)\s*$/im);
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
