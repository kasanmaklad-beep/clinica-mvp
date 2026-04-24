/**
 * MERGE AUTOMÁTICO DE VARIANTES ORTOGRÁFICAS EN NOMBRES DE CONVENIO.
 *
 * Une SOLO variantes que coinciden al normalizar (espacios, puntuación,
 * acentos y mayúsculas). No toca duplicados por similitud (Levenshtein) —
 * esos se resuelven manualmente en la UI admin.
 *
 * Uso:
 *   npx tsx scripts/merge-convenios-ortografia.ts          # dry-run (no modifica nada)
 *   npx tsx scripts/merge-convenios-ortografia.ts --apply  # aplica los cambios
 *
 * Para cada grupo de variantes, elige como canónico el nombre con MÁS
 * apariciones; en empate, el más corto; en empate, el primero alfabético.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// ── Normalización ───────────────────────────────────────────────────────
const normalizar = (s: string): string =>
  s
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:/\\()&"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Elegir canónico: el más frecuente; empate → más corto; empate → alfabético
function elegirCanonico(variantes: Map<string, number>): string {
  const arr = Array.from(variantes.entries());
  arr.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]; // más frecuente primero
    if (a[0].length !== b[0].length) return a[0].length - b[0].length; // más corto
    return a[0].localeCompare(b[0]); // alfabético
  });
  return arr[0][0];
}

async function main() {
  console.log(`\n═══ MERGE ORTOGRÁFICO DE CONVENIOS ${APPLY ? "(APPLY)" : "(DRY-RUN)"} ═══\n`);

  const cuentas = await prisma.cuentaPorCobrar.findMany({
    select: { id: true, nombreConvenio: true },
  });

  // Agrupar por normalizado → { variante: count }
  const grupos = new Map<string, Map<string, number>>();
  for (const c of cuentas) {
    const norm = normalizar(c.nombreConvenio);
    if (!grupos.has(norm)) grupos.set(norm, new Map());
    const g = grupos.get(norm)!;
    g.set(c.nombreConvenio, (g.get(c.nombreConvenio) ?? 0) + 1);
  }

  // Filtrar solo grupos con >1 variante
  const aProcesar = Array.from(grupos.entries()).filter(([, v]) => v.size > 1);

  if (aProcesar.length === 0) {
    console.log("✓ No hay variantes ortográficas que unificar. Base limpia.\n");
    await prisma.$disconnect();
    return;
  }

  console.log(`Grupos con variantes a unificar: ${aProcesar.length}\n`);

  let totalRegistrosAfectados = 0;
  const plan: Array<{ canonico: string; renombrar: string[]; rows: number }> = [];

  for (const [norm, variantes] of aProcesar) {
    const canonico = elegirCanonico(variantes);
    const renombrar = Array.from(variantes.keys()).filter((v) => v !== canonico);
    const rowsARenombrar = renombrar.reduce(
      (sum, v) => sum + (variantes.get(v) ?? 0),
      0
    );

    console.log(`▸ [${norm}]`);
    console.log(`    canónico:    "${canonico}"  (${variantes.get(canonico)} filas)`);
    for (const r of renombrar) {
      console.log(`    → renombrar: "${r}"  (${variantes.get(r)} filas) → "${canonico}"`);
    }
    plan.push({ canonico, renombrar, rows: rowsARenombrar });
    totalRegistrosAfectados += rowsARenombrar;
  }

  console.log(`\n── Resumen ──`);
  console.log(`   Grupos a unificar:         ${plan.length}`);
  console.log(`   Registros a renombrar:     ${totalRegistrosAfectados}`);
  console.log(`   Registros sin cambios:     ${cuentas.length - totalRegistrosAfectados}`);

  if (!APPLY) {
    console.log(`\n⚠ DRY-RUN: no se modificó la base de datos.`);
    console.log(`   Para aplicar los cambios ejecuta:`);
    console.log(`     npx tsx scripts/merge-convenios-ortografia.ts --apply\n`);
    await prisma.$disconnect();
    return;
  }

  // ── APPLY ────────────────────────────────────────────────────────────
  console.log(`\n─ Aplicando cambios… ─\n`);

  let filasActualizadas = 0;
  // Transacción: si algo falla, se revierte todo
  await prisma.$transaction(async (tx) => {
    for (const { canonico, renombrar } of plan) {
      for (const variante of renombrar) {
        const res = await tx.cuentaPorCobrar.updateMany({
          where: { nombreConvenio: variante },
          data: { nombreConvenio: canonico },
        });
        filasActualizadas += res.count;
        console.log(`   ✓ "${variante}" → "${canonico}"  (${res.count} filas)`);
      }
    }
  });

  console.log(`\n✓ Completado. Filas actualizadas: ${filasActualizadas}\n`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("\n✗ Error:", e);
  await prisma.$disconnect();
  process.exit(1);
});
