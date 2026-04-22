/**
 * Exporta todos los datos del SQLite local a prisma/data-export.json
 * Ejecutar ANTES de cambiar el schema a PostgreSQL:
 *   npx tsx scripts/export-sqlite.ts
 */
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("📦 Exportando datos de SQLite...\n");

  const [
    users, especialidades, unidadesServicio, aseguradoras,
    dailyReports, consultaLineas, servicioLineas,
    pacientesArea, anticipos, cuentasPorCobrar, aps,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.especialidad.findMany(),
    prisma.unidadServicio.findMany(),
    prisma.aseguradora.findMany(),
    prisma.dailyReport.findMany(),
    prisma.consultaLinea.findMany(),
    prisma.servicioLinea.findMany(),
    prisma.pacienteArea.findMany(),
    prisma.anticipo.findMany(),
    prisma.cuentaPorCobrar.findMany(),
    prisma.aPS.findMany(),
  ]);

  const data = {
    users, especialidades, unidadesServicio, aseguradoras,
    dailyReports, consultaLineas, servicioLineas,
    pacientesArea, anticipos, cuentasPorCobrar, aps,
  };

  const outputPath = path.join(__dirname, "../prisma/data-export.json");
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

  console.log("✅ Exportado en prisma/data-export.json\n");
  console.log("Registros:");
  for (const [table, rows] of Object.entries(data)) {
    console.log(`  ${table.padEnd(20)} ${(rows as unknown[]).length}`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
