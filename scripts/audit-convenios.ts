/**
 * AUDITORÍA DE CONVENIOS (solo lectura)
 *
 * Escanea todas las CuentaPorCobrar y Anticipo de la DB, lista los nombres
 * únicos y sugiere grupos de duplicados por similitud.
 *
 * Uso:
 *   npx tsx scripts/audit-convenios.ts
 *
 * NO modifica datos.
 */

import { PrismaClient } from "@prisma/client";
import { clasificarConvenio } from "../src/lib/devaluacion";

const prisma = new PrismaClient();

// ── Utilidades de normalización ──────────────────────────────────────────
const normalizar = (s: string): string =>
  s
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[.,;:/\\()&"]/g, " ") // puntuación → espacio
    .replace(/\s+/g, " ") // colapsa espacios
    .trim();

// Distancia de Levenshtein (limitada a 3 para performance)
function distancia(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
      if (dp[i][j] < rowMin) rowMin = dp[i][j];
    }
    if (rowMin > max) return max + 1;
  }
  return dp[m][n];
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n═══ AUDITORÍA DE CONVENIOS ═══\n");

  const cuentas = await prisma.cuentaPorCobrar.findMany({
    select: {
      nombreConvenio: true,
      totalBs: true,
      ingresoDivisa: true,
      reporte: { select: { fecha: true, tasaCambio: true } },
    },
    orderBy: { reporte: { fecha: "asc" } },
  });

  console.log(`Total de registros de cuentas por cobrar: ${cuentas.length}`);
  if (cuentas.length === 0) {
    console.log("No hay datos que auditar.");
    await prisma.$disconnect();
    return;
  }

  // Agrupar por nombre normalizado
  type Stat = {
    nombreOriginal: string;
    variantes: Set<string>;
    apariciones: number;
    primeraFecha: Date;
    ultimaFecha: Date;
    saldoActualBs: number;
    saldoActualUsd: number;
    tipo: "SEGURO" | "ANUALIDAD" | "OTRO";
  };

  const stats = new Map<string, Stat>();

  for (const c of cuentas) {
    const norm = normalizar(c.nombreConvenio);
    const fecha = c.reporte.fecha;
    const tasa = c.reporte.tasaCambio || 1;
    const existing = stats.get(norm);
    if (!existing) {
      stats.set(norm, {
        nombreOriginal: c.nombreConvenio,
        variantes: new Set([c.nombreConvenio]),
        apariciones: 1,
        primeraFecha: fecha,
        ultimaFecha: fecha,
        saldoActualBs: c.totalBs,
        saldoActualUsd: c.totalBs / tasa,
        tipo: clasificarConvenio(c.nombreConvenio),
      });
    } else {
      existing.variantes.add(c.nombreConvenio);
      existing.apariciones += 1;
      if (fecha < existing.primeraFecha) existing.primeraFecha = fecha;
      if (fecha >= existing.ultimaFecha) {
        existing.ultimaFecha = fecha;
        existing.saldoActualBs = c.totalBs;
        existing.saldoActualUsd = c.totalBs / tasa;
      }
    }
  }

  const arr = Array.from(stats.entries())
    .map(([norm, s]) => ({ norm, ...s }))
    .sort((a, b) => b.apariciones - a.apariciones);

  // ── 1. Resumen general ────────────────────────────────────────────────
  console.log(`\n── Convenios únicos (normalizados): ${arr.length} ──`);
  const porTipo = { SEGURO: 0, ANUALIDAD: 0, OTRO: 0 };
  for (const s of arr) porTipo[s.tipo] += 1;
  console.log(`   Seguros:     ${porTipo.SEGURO}`);
  console.log(`   Anualidades: ${porTipo.ANUALIDAD}`);
  console.log(`   Otros:       ${porTipo.OTRO}`);

  // ── 2. Variantes dentro del mismo grupo normalizado ───────────────────
  const conVariantes = arr.filter((s) => s.variantes.size > 1);
  if (conVariantes.length > 0) {
    console.log(`\n── Grupos con variantes ortográficas (${conVariantes.length}) ──`);
    for (const s of conVariantes.slice(0, 20)) {
      console.log(`  ▸ [${s.apariciones}×] ${s.norm}`);
      for (const v of s.variantes) console.log(`      · "${v}"`);
    }
    if (conVariantes.length > 20) {
      console.log(`  ... y ${conVariantes.length - 20} más`);
    }
  } else {
    console.log(`\n✓ Sin variantes ortográficas dentro de grupos normalizados.`);
  }

  // ── 3. Duplicados sospechosos (distancia Levenshtein ≤ 3) ─────────────
  console.log(`\n── Buscando duplicados por similitud (Levenshtein ≤ 3) ──`);
  const sospechosos: Array<{ a: string; b: string; d: number; aparA: number; aparB: number }> = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i].norm;
      const b = arr[j].norm;
      // Descartes rápidos
      if (Math.abs(a.length - b.length) > 3) continue;
      const d = distancia(a, b, 3);
      if (d <= 3) {
        sospechosos.push({
          a, b, d,
          aparA: arr[i].apariciones,
          aparB: arr[j].apariciones,
        });
      }
    }
  }

  if (sospechosos.length > 0) {
    sospechosos.sort((x, y) => x.d - y.d || (y.aparA + y.aparB) - (x.aparA + x.aparB));
    console.log(`  ${sospechosos.length} pares sospechosos encontrados:\n`);
    for (const s of sospechosos.slice(0, 30)) {
      console.log(`  d=${s.d}  "${s.a}" [${s.aparA}×]  ↔  "${s.b}" [${s.aparB}×]`);
    }
    if (sospechosos.length > 30) {
      console.log(`  ... y ${sospechosos.length - 30} pares más`);
    }
  } else {
    console.log(`  ✓ Sin duplicados por similitud.`);
  }

  // ── 4. Convenios con mayor saldo actual ───────────────────────────────
  const topSaldo = [...arr].sort((a, b) => b.saldoActualBs - a.saldoActualBs).slice(0, 15);
  console.log(`\n── Top 15 convenios por saldo actual ──`);
  for (const s of topSaldo) {
    const diasCartera = Math.round(
      (s.ultimaFecha.getTime() - s.primeraFecha.getTime()) / (1000 * 60 * 60 * 24)
    );
    console.log(
      `  [${s.tipo.padEnd(9)}] ${s.nombreOriginal.padEnd(45).slice(0, 45)}  ` +
      `Bs ${s.saldoActualBs.toLocaleString("es-VE", { maximumFractionDigits: 0 }).padStart(14)}  ` +
      `$${s.saldoActualUsd.toFixed(0).padStart(8)}  ` +
      `${s.apariciones}× · ${diasCartera}d`
    );
  }

  // ── 5. Anticipos (complemento) ────────────────────────────────────────
  const anticipos = await prisma.anticipo.findMany({
    select: { pacienteNombre: true, tipo: true },
  });
  const pacientesSet = new Set(anticipos.map((a) => a.pacienteNombre).filter(Boolean));
  console.log(`\n── Anticipos: ${anticipos.length} registros, ${pacientesSet.size} pacientes únicos ──`);

  // ── 6. Aseguradoras ya creadas ────────────────────────────────────────
  const aseguradoras = await prisma.aseguradora.findMany({
    include: {
      _count: { select: { cuentasPorCobrar: true, anticipos: true } },
    },
  });
  console.log(`\n── Aseguradoras registradas en tabla Aseguradora: ${aseguradoras.length} ──`);
  for (const a of aseguradoras) {
    console.log(
      `  ${a.activa ? "●" : "○"} ${a.nombre.padEnd(40)}  ` +
      `CxC: ${a._count.cuentasPorCobrar}  Anticipos: ${a._count.anticipos}`
    );
  }

  const cxcConAseguradora = await prisma.cuentaPorCobrar.count({
    where: { aseguradoraId: { not: null } },
  });
  const cxcSinAseguradora = await prisma.cuentaPorCobrar.count({
    where: { aseguradoraId: null },
  });
  console.log(
    `\n  CxC con aseguradora vinculada:  ${cxcConAseguradora}` +
    `\n  CxC sin aseguradora vinculada:  ${cxcSinAseguradora}`
  );

  console.log("\n═══ FIN AUDITORÍA (sin cambios en DB) ═══\n");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
