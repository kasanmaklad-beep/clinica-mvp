/**
 * Validación heurística para detectar errores de captura.
 *
 * No bloquea el guardado — solo emite warnings que el form muestra como ⚠
 * inline. La idea es atrapar errores tipo "metieron 100 donde iban 51,518"
 * (caso Cibella, 18-may-2026) sin agregar fricción al flujo normal.
 *
 * Las reglas son intencionalmente generosas (5×, 10×) para evitar falsos
 * positivos. Si hay un edge case real, el capturista puede ignorar el warning
 * y guardar igual.
 */

export interface Warning {
  campo: string;
  mensaje: string;
}

const UMBRAL_DIVISA_ALTA = 5000; // > $5,000 USD en una sola fila es raro
const UMBRAL_BS_BAJO = 100;       // < Bs 100 con divisa alta huele a swap
const UMBRAL_ANUALIDAD_USD = 500; // anualidad típica de doctor es ~$50-300

/**
 * Valida una línea de consulta. Mira que:
 *   - el %clínica concuerde con pacientes × honorario (caso Urología 5 vs 10)
 *   - el totalBs sea consistente con la tasa del día
 */
export function validarConsulta(input: {
  numPacientes: number;
  totalBs: number;
  ingresoDivisa: number;
  efectivoUsd: number;
  porcentajeClinica: number;
  honorarioClinica: number;
  tasa: number;
}): Warning[] {
  const warnings: Warning[] = [];
  const esperadoClinica = input.numPacientes * input.honorarioClinica;
  // Solo alertamos si hay diferencia significativa (>50% y > $5 de diff)
  const diffClinica = Math.abs(input.porcentajeClinica - esperadoClinica);
  if (
    input.numPacientes > 0 &&
    diffClinica > 5 &&
    diffClinica / Math.max(esperadoClinica, 1) > 0.5
  ) {
    warnings.push({
      campo: "porcentajeClinica",
      mensaje: `% Clínica $${input.porcentajeClinica.toFixed(2)} no concuerda con ${input.numPacientes} pac × $${input.honorarioClinica}/pac = $${esperadoClinica.toFixed(2)}`,
    });
  }
  if (input.efectivoUsd > input.ingresoDivisa + 0.01) {
    warnings.push({
      campo: "efectivoUsd",
      mensaje: `Efectivo ($${input.efectivoUsd}) no puede ser mayor a Total $ ($${input.ingresoDivisa})`,
    });
  }
  return warnings;
}

/**
 * Valida una línea de cuenta por cobrar / convenio / anualidad.
 * Reglas para atrapar swaps de columnas (caso Cibella).
 */
export function validarCuenta(input: {
  totalBs: number;
  ingresoDivisa: number;
  efectivoUsd: number;
  tipoConvenio: "SEGURO" | "ANUALIDAD" | "OTRO";
}): Warning[] {
  const warnings: Warning[] = [];

  // Swap clásico: bs pequeño + divisa enorme
  if (input.totalBs > 0 && input.totalBs < UMBRAL_BS_BAJO && input.ingresoDivisa > UMBRAL_DIVISA_ALTA) {
    warnings.push({
      campo: "ingresoDivisa",
      mensaje: `Bs muy bajo (${input.totalBs}) con Divisa alta ($${input.ingresoDivisa}). ¿Se invirtieron las columnas?`,
    });
  }

  // Divisa absurdamente alta
  if (input.ingresoDivisa > UMBRAL_DIVISA_ALTA) {
    warnings.push({
      campo: "ingresoDivisa",
      mensaje: `Monto en Divisa ($${input.ingresoDivisa}) inusualmente alto. Confirma.`,
    });
  }

  // Anualidad fuera de rango
  if (input.tipoConvenio === "ANUALIDAD" && input.ingresoDivisa > UMBRAL_ANUALIDAD_USD) {
    warnings.push({
      campo: "ingresoDivisa",
      mensaje: `Anualidad >$${UMBRAL_ANUALIDAD_USD}. Las anualidades de doctores suelen ser entre $50-$300.`,
    });
  }

  if (input.efectivoUsd > input.ingresoDivisa + 0.01) {
    warnings.push({
      campo: "efectivoUsd",
      mensaje: `Efectivo ($${input.efectivoUsd}) no puede ser mayor al ingreso en divisa ($${input.ingresoDivisa})`,
    });
  }

  return warnings;
}

/**
 * Valida una línea de anticipo. Similar a cuenta pero más simple.
 */
export function validarAnticipo(input: {
  totalBs: number;
  ingresoDivisa: number;
  efectivoUsd: number;
}): Warning[] {
  const warnings: Warning[] = [];
  if (input.totalBs > 0 && input.totalBs < UMBRAL_BS_BAJO && input.ingresoDivisa > UMBRAL_DIVISA_ALTA) {
    warnings.push({
      campo: "ingresoDivisa",
      mensaje: `Bs muy bajo (${input.totalBs}) con Divisa alta ($${input.ingresoDivisa}). ¿Swap?`,
    });
  }
  if (input.ingresoDivisa > UMBRAL_DIVISA_ALTA * 2) {
    warnings.push({
      campo: "ingresoDivisa",
      mensaje: `Anticipo de $${input.ingresoDivisa} es inusualmente alto.`,
    });
  }
  if (input.efectivoUsd > input.ingresoDivisa + 0.01) {
    warnings.push({
      campo: "efectivoUsd",
      mensaje: `Efectivo > divisa`,
    });
  }
  return warnings;
}
