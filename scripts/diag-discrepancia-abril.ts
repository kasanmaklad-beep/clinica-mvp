/**
 * Diagnóstico: compara qué suma el histórico vs el dashboard para abril.
 * Modo solo-lectura.
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const reportes = await prisma.dailyReport.findMany({
    where: {
      fecha: {
        gte: new Date("2026-04-01T00:00:00Z"),
        lt: new Date("2026-05-01T00:00:00Z"),
      },
    },
    orderBy: { fecha: "asc" },
    include: {
      consultas: true,
      servicios: { include: { unidadServicio: { select: { categoria: true } } } },
      anticipos: true,
      cuentasPorCobrar: true,
    },
  });

  console.log(`\n📅 Reportes en abril 2026: ${reportes.length}`);
  console.log(`Primera fecha: ${reportes[0]?.fecha.toISOString()}`);
  console.log(`Última fecha: ${reportes[reportes.length - 1]?.fecha.toISOString()}\n`);

  // ─── HISTÓRICO: suma ingresoDivisa ─────────────────────────────────────
  let histConsDiv = 0;
  let histServDiv = 0;
  let histAntDiv = 0;
  let histCueDiv = 0;

  // ─── DASHBOARD: criterio mezclado ──────────────────────────────────────
  let dashConsClinicaUsd = 0;
  let dashLabUsd = 0;
  let dashImgUsd = 0;
  let dashAntUsd = 0;
  let dashCueUsd = 0;

  // ─── NUEVO CANDIDATO: todo bruto en USD recalculado con tasa del día ───
  let brutoConsUsd = 0;
  let brutoServUsd = 0;
  let brutoAntUsd = 0;
  let brutoCueUsd = 0;

  for (const r of reportes) {
    const tasa = r.tasaCambio || 1;
    // Histórico
    histConsDiv += r.consultas.reduce((s, x) => s + x.ingresoDivisa, 0);
    histServDiv += r.servicios.reduce((s, x) => s + x.ingresoDivisa, 0);
    histAntDiv  += r.anticipos.reduce((s, x) => s + x.ingresoDivisa, 0);
    histCueDiv  += r.cuentasPorCobrar.reduce((s, x) => s + x.ingresoDivisa, 0);

    // Dashboard
    dashConsClinicaUsd += r.consultas.reduce((s, x) => s + x.porcentajeClinica, 0);
    const labRows = r.servicios.filter((s) => s.unidadServicio.categoria !== "IMAGENES");
    const imgRows = r.servicios.filter((s) => s.unidadServicio.categoria === "IMAGENES");
    dashLabUsd += labRows.reduce((s, x) => s + x.totalBs, 0) / tasa;
    dashImgUsd += imgRows.reduce((s, x) => s + x.totalBs, 0) / tasa;
    dashAntUsd += r.anticipos.reduce((s, x) => s + x.totalBs, 0) / tasa;
    dashCueUsd += r.cuentasPorCobrar.reduce((s, x) => s + x.totalBs, 0) / tasa;

    // Bruto en USD (todo totalBs convertido a la tasa del día)
    brutoConsUsd += r.consultas.reduce((s, x) => s + x.totalBs, 0) / tasa;
    brutoServUsd += r.servicios.reduce((s, x) => s + x.totalBs, 0) / tasa;
    brutoAntUsd  += r.anticipos.reduce((s, x) => s + x.totalBs, 0) / tasa;
    brutoCueUsd  += r.cuentasPorCobrar.reduce((s, x) => s + x.totalBs, 0) / tasa;
  }

  const histTotal = histConsDiv + histServDiv + histAntDiv + histCueDiv;
  const dashTotal = dashConsClinicaUsd + dashLabUsd + dashImgUsd + dashAntUsd + dashCueUsd;
  const brutoTotal = brutoConsUsd + brutoServUsd + brutoAntUsd + brutoCueUsd;

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("📊 HISTÓRICO (lo que suma /reportes)  — campo `ingresoDivisa`");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Consultas.ingresoDivisa : $${fmt(histConsDiv)}`);
  console.log(`  Servicios.ingresoDivisa : $${fmt(histServDiv)}`);
  console.log(`  Anticipos.ingresoDivisa : $${fmt(histAntDiv)}`);
  console.log(`  Cuentas.ingresoDivisa   : $${fmt(histCueDiv)}`);
  console.log(`  ───────────────────────────────────────────`);
  console.log(`  TOTAL HISTÓRICO         : $${fmt(histTotal)}`);

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("📊 DASHBOARD 'mes actual'  — criterio mezclado");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Consultas.porcentajeClinica : $${fmt(dashConsClinicaUsd)}`);
  console.log(`  Lab.totalBs / tasa          : $${fmt(dashLabUsd)}`);
  console.log(`  Img.totalBs / tasa          : $${fmt(dashImgUsd)}`);
  console.log(`  Anticipos.totalBs / tasa    : $${fmt(dashAntUsd)}`);
  console.log(`  Cuentas.totalBs / tasa      : $${fmt(dashCueUsd)}`);
  console.log(`  ─────────────────────────────────────────────`);
  console.log(`  TOTAL DASHBOARD             : $${fmt(dashTotal)}`);

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("📊 CANDIDATO OPCIÓN A  — todo totalBs convertido a USD @ tasa del día");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Consultas (totalBs/tasa) : $${fmt(brutoConsUsd)}`);
  console.log(`  Servicios (totalBs/tasa) : $${fmt(brutoServUsd)}`);
  console.log(`  Anticipos (totalBs/tasa) : $${fmt(brutoAntUsd)}`);
  console.log(`  Cuentas   (totalBs/tasa) : $${fmt(brutoCueUsd)}`);
  console.log(`  ───────────────────────────────────────────`);
  console.log(`  TOTAL BRUTO (Opción A)   : $${fmt(brutoTotal)}`);

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("🔍 ANÁLISIS POR LÍNEA DE CONSULTAS (primeros 3 días)");
  console.log("═══════════════════════════════════════════════════════════════");
  for (const r of reportes.slice(0, 3)) {
    console.log(`\nFecha ${r.fecha.toISOString().slice(0, 10)}  |  tasa ${r.tasaCambio}`);
    const tasa = r.tasaCambio || 1;
    for (const c of r.consultas) {
      if (c.totalBs === 0 && c.ingresoDivisa === 0 && c.porcentajeClinica === 0) continue;
      const brutoUsd = c.totalBs / tasa;
      console.log(
        `  Pac=${String(c.numPacientes).padStart(3)}  ` +
          `totalBs=${c.totalBs.toFixed(0).padStart(10)}  ` +
          `ingDiv=${c.ingresoDivisa.toFixed(2).padStart(8)}  ` +
          `pctClin=${c.porcentajeClinica.toFixed(2).padStart(8)}  ` +
          `(bruto$=${brutoUsd.toFixed(2)})`
      );
    }
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
