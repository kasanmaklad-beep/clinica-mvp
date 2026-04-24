/**
 * Cálculos relacionados con devaluación del bolívar y pérdida cambiaria.
 */

export interface TasaHistorica {
  fecha: string; // YYYY-MM-DD
  tasa: number;
}

/**
 * Devaluación porcentual entre dos tasas.
 * Si tasa subió (más Bs por $), el Bs perdió valor → devaluación positiva.
 */
export const devaluacionPct = (tasaAnterior: number, tasaActual: number): number => {
  if (!tasaAnterior || tasaAnterior <= 0) return 0;
  return ((tasaActual - tasaAnterior) / tasaAnterior) * 100;
};

/**
 * Pérdida en USD al mantener un saldo en Bs entre dos tasas.
 * Ejemplo: Bs 1M con tasa_origen 480 = $2,083. Si hoy tasa=500 = $2,000. Pérdida=$83.
 */
export const perdidaCambiariaUsd = (
  saldoBs: number,
  tasaOrigen: number,
  tasaActual: number
): number => {
  if (!tasaOrigen || !tasaActual || tasaOrigen <= 0 || tasaActual <= 0) return 0;
  return saldoBs / tasaOrigen - saldoBs / tasaActual;
};

/**
 * Busca la tasa más cercana (pero no posterior) a una fecha objetivo.
 * Útil para calcular "devaluación de los últimos 7 días".
 */
export const tasaEnFecha = (
  tasas: TasaHistorica[],
  fechaObjetivo: Date
): number | null => {
  const target = fechaObjetivo.toISOString().slice(0, 10);
  // tasas asumidas ordenadas desc (más reciente primero)
  for (const t of tasas) {
    if (t.fecha <= target) return t.tasa;
  }
  return null;
};

/**
 * Anualiza una tasa diaria de devaluación asumiendo composición.
 * Si por día se devalúa 0.15%, anualizado ≈ 72% (compound).
 */
export const anualizarDevaluacion = (pctDiario: number): number => {
  const r = pctDiario / 100;
  return (Math.pow(1 + r, 365) - 1) * 100;
};

/**
 * Clasifica un convenio como SEGURO, ANUALIDAD u OTRO
 * basado en palabras clave del nombre. Rule-based para Fase 1.
 */
export const clasificarConvenio = (
  nombre: string
): "SEGURO" | "ANUALIDAD" | "OTRO" => {
  const n = nombre.toUpperCase();
  if (n.includes("ANUALIDAD") || n.includes("MEMBRES") || n.startsWith("DR.") || n.startsWith("DRA."))
    return "ANUALIDAD";

  const SEGUROS_KEYWORDS = [
    "MAPFRE", "MAPFRED", "HISPANA", "CARACAS", "HORIZONTE",
    "INTERNACIONAL", "MIRANDA", "SEGURO", "ZURICH", "UNIVERSAL",
    "MERCANTIL", "PROVINCIAL", "BANESCO", "LA VENEZOLANA", "ORIENTE",
    "ESTAR", "HUMANA", "HEALTH", "VITAL", "PANAMERICAN",
  ];
  if (SEGUROS_KEYWORDS.some((k) => n.includes(k))) return "SEGURO";
  return "OTRO";
};

/**
 * Formatea un porcentaje con signo y 2 decimales.
 * +0.45% / -0.12% / 0.00%
 */
export const fmtPct = (pct: number): string => {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
};

// ═══════════════════════════════════════════════════════════════════════
// PROYECCIÓN DE DEVALUACIÓN Y PÉRDIDA FUTURA
// ═══════════════════════════════════════════════════════════════════════

/**
 * Calcula la tasa de devaluación diaria efectiva (compound) observada entre
 * dos puntos en el tiempo. Si la tasa subió de 400 a 480 en 30 días,
 * devuelve la r tal que 400 * (1+r)^30 = 480.
 *
 * Retorna la tasa como decimal (0.006 = 0.6%/día), NO como porcentaje.
 */
export const tasaDiariaCompound = (
  tasaAnterior: number,
  tasaActual: number,
  dias: number
): number => {
  if (!tasaAnterior || tasaAnterior <= 0 || !tasaActual || tasaActual <= 0 || dias <= 0) {
    return 0;
  }
  return Math.pow(tasaActual / tasaAnterior, 1 / dias) - 1;
};

/**
 * Proyecta la tasa del bolívar N días en el futuro asumiendo que la
 * devaluación diaria compuesta continúa igual.
 */
export const proyectarTasa = (
  tasaHoy: number,
  diasAdelante: number,
  tasaDiariaDecimal: number
): number => {
  if (!tasaHoy || tasaHoy <= 0) return 0;
  return tasaHoy * Math.pow(1 + tasaDiariaDecimal, diasAdelante);
};

/**
 * Pérdida en USD adicional si un saldo en Bs se mantiene sin cobrar durante
 * N días más (desde hoy). Asume que la tasa de devaluación se mantiene.
 *
 * Ejemplo: Bs 1M, tasa hoy 500, devaluación 0.5%/día.
 * En 30 días: tasa ≈ 580, el saldo vale $1724 en vez de $2000 → pérdida $276.
 */
export const perdidaProyectadaUsd = (
  saldoBs: number,
  tasaHoy: number,
  diasAdelante: number,
  tasaDiariaDecimal: number
): number => {
  const tasaFutura = proyectarTasa(tasaHoy, diasAdelante, tasaDiariaDecimal);
  if (!tasaHoy || !tasaFutura || tasaHoy <= 0 || tasaFutura <= 0) return 0;
  return saldoBs / tasaHoy - saldoBs / tasaFutura;
};
