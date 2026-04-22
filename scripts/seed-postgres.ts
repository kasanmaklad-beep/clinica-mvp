/**
 * Carga los datos exportados de SQLite en la base PostgreSQL (Neon).
 * Ejecutar UNA SOLA VEZ después de configurar DATABASE_URL con la URL de Neon:
 *   npx tsx scripts/seed-postgres.ts
 *
 * Prerequisito: la tabla ya debe existir (ejecutar `npx prisma db push` primero).
 */
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

interface ExportData {
  users:            Record<string, unknown>[];
  especialidades:   Record<string, unknown>[];
  unidadesServicio: Record<string, unknown>[];
  aseguradoras:     Record<string, unknown>[];
  dailyReports:     Record<string, unknown>[];
  consultaLineas:   Record<string, unknown>[];
  servicioLineas:   Record<string, unknown>[];
  pacientesArea:    Record<string, unknown>[];
  anticipos:        Record<string, unknown>[];
  cuentasPorCobrar: Record<string, unknown>[];
  aps:              Record<string, unknown>[];
}

async function main() {
  const exportPath = path.join(__dirname, "../prisma/data-export.json");
  if (!fs.existsSync(exportPath)) {
    console.error("❌ No se encontró prisma/data-export.json. Ejecuta export-sqlite.ts primero.");
    process.exit(1);
  }

  const data: ExportData = JSON.parse(fs.readFileSync(exportPath, "utf-8"));
  console.log("🚀 Cargando datos en PostgreSQL...\n");

  // Helpers
  const d = (v: unknown) => (v ? new Date(v as string) : null);
  const dn = (v: unknown) => new Date(v as string);

  // 1. Usuarios
  console.log(`👤 Usuarios (${data.users.length})...`);
  for (const u of data.users) {
    await prisma.user.upsert({
      where: { id: u.id as string },
      update: {},
      create: {
        id: u.id as string,
        email: u.email as string,
        name: u.name as string,
        passwordHash: u.passwordHash as string,
        role: u.role as string,
        activo: u.activo as boolean,
        createdAt: dn(u.createdAt),
        updatedAt: dn(u.updatedAt),
      },
    });
  }

  // 2. Especialidades
  console.log(`🩺 Especialidades (${data.especialidades.length})...`);
  for (const e of data.especialidades) {
    await prisma.especialidad.upsert({
      where: { id: e.id as string },
      update: {},
      create: {
        id: e.id as string,
        codigo: e.codigo as number,
        nombre: e.nombre as string,
        honorarioClinica: e.honorarioClinica as number,
        modeloNegocio: e.modeloNegocio as string,
        orden: e.orden as number,
        activa: e.activa as boolean,
      },
    });
  }

  // 3. Unidades de servicio
  console.log(`🔬 Unidades de servicio (${data.unidadesServicio.length})...`);
  for (const u of data.unidadesServicio) {
    await prisma.unidadServicio.upsert({
      where: { id: u.id as string },
      update: {},
      create: {
        id: u.id as string,
        codigo: u.codigo as number,
        nombre: u.nombre as string,
        categoria: u.categoria as string,
        orden: u.orden as number,
        activa: u.activa as boolean,
      },
    });
  }

  // 4. Aseguradoras
  if (data.aseguradoras.length > 0) {
    console.log(`🏥 Aseguradoras (${data.aseguradoras.length})...`);
    for (const a of data.aseguradoras) {
      await prisma.aseguradora.upsert({
        where: { id: a.id as string },
        update: {},
        create: {
          id: a.id as string,
          nombre: a.nombre as string,
          activa: a.activa as boolean,
          createdAt: dn(a.createdAt),
        },
      });
    }
  }

  // 5. Reportes diarios
  console.log(`📋 Reportes (${data.dailyReports.length})...`);
  const CHUNK = 50;
  for (let i = 0; i < data.dailyReports.length; i += CHUNK) {
    const chunk = data.dailyReports.slice(i, i + CHUNK);
    for (const r of chunk) {
      await prisma.dailyReport.upsert({
        where: { id: r.id as string },
        update: {},
        create: {
          id: r.id as string,
          fecha: dn(r.fecha),
          tasaCambio: r.tasaCambio as number,
          estado: r.estado as string,
          observaciones: r.observaciones as string | null,
          createdAt: dn(r.createdAt),
          updatedAt: dn(r.updatedAt),
          cerradoAt: d(r.cerradoAt),
          creadoPorId: r.creadoPorId as string,
          editadoPorId: r.editadoPorId as string | null,
        },
      });
    }
    process.stdout.write(`  ${Math.min(i + CHUNK, data.dailyReports.length)}/${data.dailyReports.length}\r`);
  }
  console.log();

  // 6. Líneas de consultas
  console.log(`📝 Consultas (${data.consultaLineas.length})...`);
  for (let i = 0; i < data.consultaLineas.length; i += CHUNK) {
    const chunk = data.consultaLineas.slice(i, i + CHUNK);
    await prisma.consultaLinea.createMany({
      data: chunk.map(c => ({
        id: c.id as string,
        reporteId: c.reporteId as string,
        especialidadId: c.especialidadId as string,
        numPacientes: c.numPacientes as number,
        totalBs: c.totalBs as number,
        ingresoDivisa: c.ingresoDivisa as number,
        porcentajeClinica: c.porcentajeClinica as number,
        comentarios: c.comentarios as string | null,
      })),
      skipDuplicates: true,
    });
    process.stdout.write(`  ${Math.min(i + CHUNK, data.consultaLineas.length)}/${data.consultaLineas.length}\r`);
  }
  console.log();

  // 7. Líneas de servicios
  console.log(`🧪 Servicios (${data.servicioLineas.length})...`);
  for (let i = 0; i < data.servicioLineas.length; i += CHUNK) {
    const chunk = data.servicioLineas.slice(i, i + CHUNK);
    await prisma.servicioLinea.createMany({
      data: chunk.map(s => ({
        id: s.id as string,
        reporteId: s.reporteId as string,
        unidadServicioId: s.unidadServicioId as string,
        numPacientes: s.numPacientes as number,
        totalBs: s.totalBs as number,
        ingresoDivisa: s.ingresoDivisa as number,
        porcentajeClinica: s.porcentajeClinica as number,
        comentarios: s.comentarios as string | null,
      })),
      skipDuplicates: true,
    });
    process.stdout.write(`  ${Math.min(i + CHUNK, data.servicioLineas.length)}/${data.servicioLineas.length}\r`);
  }
  console.log();

  // 8. Pacientes por área
  console.log(`🛏️  Pacientes área (${data.pacientesArea.length})...`);
  for (let i = 0; i < data.pacientesArea.length; i += CHUNK) {
    const chunk = data.pacientesArea.slice(i, i + CHUNK);
    await prisma.pacienteArea.createMany({
      data: chunk.map(p => ({
        id: p.id as string,
        reporteId: p.reporteId as string,
        area: p.area as string,
        numPacientes: p.numPacientes as number,
        comentarios: p.comentarios as string | null,
      })),
      skipDuplicates: true,
    });
  }

  // 9. Anticipos
  console.log(`💰 Anticipos (${data.anticipos.length})...`);
  for (let i = 0; i < data.anticipos.length; i += CHUNK) {
    const chunk = data.anticipos.slice(i, i + CHUNK);
    await prisma.anticipo.createMany({
      data: chunk.map(a => ({
        id: a.id as string,
        reporteId: a.reporteId as string,
        tipo: a.tipo as string,
        totalBs: a.totalBs as number,
        ingresoDivisa: a.ingresoDivisa as number,
        numPacientes: a.numPacientes as number,
        pacienteNombre: a.pacienteNombre as string | null,
        comentarios: a.comentarios as string | null,
        estado: a.estado as string,
        aseguradoraId: a.aseguradoraId as string | null,
      })),
      skipDuplicates: true,
    });
  }

  // 10. Cuentas por cobrar
  console.log(`📄 Cuentas por cobrar (${data.cuentasPorCobrar.length})...`);
  for (let i = 0; i < data.cuentasPorCobrar.length; i += CHUNK) {
    const chunk = data.cuentasPorCobrar.slice(i, i + CHUNK);
    await prisma.cuentaPorCobrar.createMany({
      data: chunk.map(c => ({
        id: c.id as string,
        reporteId: c.reporteId as string,
        nombreConvenio: c.nombreConvenio as string,
        totalBs: c.totalBs as number,
        ingresoDivisa: c.ingresoDivisa as number,
        numPacientes: c.numPacientes as number,
        comentarios: c.comentarios as string | null,
        aseguradoraId: c.aseguradoraId as string | null,
      })),
      skipDuplicates: true,
    });
  }

  // 11. APS
  if (data.aps.length > 0) {
    console.log(`🏨 APS (${data.aps.length})...`);
    for (const a of data.aps) {
      await prisma.aPS.upsert({
        where: { id: a.id as string },
        update: {},
        create: {
          id: a.id as string,
          reporteId: a.reporteId as string,
          consultas: a.consultas as number,
          laboratoriosImagenes: a.laboratoriosImagenes as number,
          movimientosDia: a.movimientosDia as number,
          totalFacturados: a.totalFacturados as number,
          noFacturadosComentarios: a.noFacturadosComentarios as string | null,
          facturadosComentarios: a.facturadosComentarios as string | null,
        },
      });
    }
  }

  console.log("\n✅ Migración completa.");
}

main()
  .catch(e => { console.error("❌ Error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
