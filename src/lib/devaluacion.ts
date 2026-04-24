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
