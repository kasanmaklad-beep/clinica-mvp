/**
 * Carga los reportes del 21 y 22 de abril 2026 en Neon/PostgreSQL.
 * Ejecutar UNA SOLA VEZ:
 *   npx tsx scripts/seed-abril2-2026.ts
 */
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("No se encontró usuario admin");

  const espList = await prisma.especialidad.findMany();
  const espMap: Record<number, string> = {};
  for (const e of espList) espMap[e.codigo] = e.id;
  console.log(`✅ ${espList.length} especialidades`);

  const unidList = await prisma.unidadServicio.findMany();
  const unidByNombre: Record<string, string> = {};
  let maxCodigo = 0;
  for (const u of unidList) {
    unidByNombre[u.nombre.toLowerCase().trim()] = u.id;
    if (u.codigo > maxCodigo) maxCodigo = u.codigo;
  }
  console.log(`✅ ${unidList.length} unidades de servicio`);

  const unid = async (nombre: string): Promise<string> => {
    const key = nombre.toLowerCase().trim();
    if (unidByNombre[key]) return unidByNombre[key];
    maxCodigo += 1;
    const u = await prisma.unidadServicio.create({
      data: { id: randomUUID(), codigo: maxCodigo, nombre, categoria: "SERVICIO", orden: maxCodigo, activa: true },
    });
    unidByNombre[key] = u.id;
    console.log(`  ⚡ Nueva unidad: "${nombre}" (código ${maxCodigo})`);
    return u.id;
  };

  // Helper para especialidades que podrían no existir
  const esp = async (codigo: number, nombre: string): Promise<string> => {
    if (espMap[codigo]) return espMap[codigo];
    const e = await prisma.especialidad.create({
      data: { id: randomUUID(), codigo, nombre, honorarioClinica: 10, modeloNegocio: "Fijo por paciente", orden: codigo, activa: true },
    });
    espMap[codigo] = e.id;
    console.log(`  ⚡ Nueva especialidad: "${nombre}" (código ${codigo})`);
    return e.id;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // 21 DE ABRIL 2026  (tasa 481,70)
  // ══════════════════════════════════════════════════════════════════════════
  const exists21 = await prisma.dailyReport.findUnique({ where: { fecha: new Date("2026-04-21T12:00:00.000Z") } });
  if (exists21) {
    console.log("⚠️  Reporte 21-Apr ya existe — omitido");
  } else {
    console.log("\n📋 Insertando 21 DE ABRIL 2026...");
    const r21 = await prisma.dailyReport.create({
      data: {
        id: randomUUID(),
        fecha: new Date("2026-04-21T12:00:00.000Z"),
        tasaCambio: 481.70,
        estado: "CERRADO",
        creadoPorId: admin.id,
        createdAt: new Date("2026-04-21T12:00:00.000Z"),
        updatedAt: new Date("2026-04-21T12:00:00.000Z"),
      },
    });

    await prisma.consultaLinea.createMany({
      data: [
        { id: randomUUID(), reporteId: r21.id, especialidadId: await esp(2,  "Cardiología"),            numPacientes: 7,  totalBs: 87242.40,  ingresoDivisa: 0,  porcentajeClinica: 70.00  },
        { id: randomUUID(), reporteId: r21.id, especialidadId: await esp(3,  "Cirugía General"),        numPacientes: 10, totalBs: 120425.00, ingresoDivisa: 0,  porcentajeClinica: 50.00  },
        { id: randomUUID(), reporteId: r21.id, especialidadId: await esp(8,  "Fisiatría"),              numPacientes: 9,  totalBs: 178229.09, ingresoDivisa: 0,  porcentajeClinica: 90.00  },
        { id: randomUUID(), reporteId: r21.id, especialidadId: await esp(9,  "Gastroenterología"),      numPacientes: 2,  totalBs: 9634.00,   ingresoDivisa: 0,  porcentajeClinica: 20.00  },
        { id: randomUUID(), reporteId: r21.id, especialidadId: await esp(10, "Ginecología"),            numPacientes: 9,  totalBs: 33719.00,  ingresoDivisa: 0,  porcentajeClinica: 45.00  },
        { id: randomUUID(), reporteId: r21.id, especialidadId: await esp(11, "Ginecología 2"),          numPacientes: 3,  totalBs: 14451.00,  ingresoDivisa: 0,  porcentajeClinica: 15.00  },
        { id: randomUUID(), reporteId: r21.id, especialidadId: await esp(12, "Ginecologia Regenertiva"),numPacientes: 7,  totalBs: 23121.60,  ingresoDivisa: 0,  porcentajeClinica: 70.00  },
        { id: randomUUID(), reporteId: r21.id, especialidadId: await esp(13, "Medicina Interna"),       numPacientes: 13, totalBs: 216765.00, ingresoDivisa: 0,  porcentajeClinica: 130.00 },
        { id: randomUUID(), reporteId: r21.id, especialidadId: await esp(18, "Oftamología"),            numPacientes: 8,  totalBs: 590082.50, ingresoDivisa: 20, porcentajeClinica: 60.00  },
        { id: randomUUID(), reporteId: r21.id, especialidadId: await esp(20, "Otorrinolaringología"),   numPacientes: 9,  totalBs: 60694.20,  ingresoDivisa: 0,  porcentajeClinica: 90.00  },
        { id: randomUUID(), reporteId: r21.id, especialidadId: await esp(21, "Pediatría"),              numPacientes: 9,  totalBs: 43353.00,  ingresoDivisa: 0,  porcentajeClinica: 90.00  },
        { id: randomUUID(), reporteId: r21.id, especialidadId: await esp(22, "Psiquiatría"),            numPacientes: 4,  totalBs: 19268.00,  ingresoDivisa: 0,  porcentajeClinica: 40.00  },
        { id: randomUUID(), reporteId: r21.id, especialidadId: await esp(24, "Traumatología"),          numPacientes: 14, totalBs: 89432.63,  ingresoDivisa: 0,  porcentajeClinica: 70.00  },
        { id: randomUUID(), reporteId: r21.id, especialidadId: await esp(25, "Urología"),               numPacientes: 2,  totalBs: 11792.02,  ingresoDivisa: 0,  porcentajeClinica: 10.00  },
      ],
    });

    await prisma.servicioLinea.createMany({
      data: [
        { id: randomUUID(), reporteId: r21.id, unidadServicioId: await unid("Anatomía Patológica"),    numPacientes: 4,  totalBs: 96340.00,    ingresoDivisa: 0,  porcentajeClinica: 0 },
        { id: randomUUID(), reporteId: r21.id, unidadServicioId: await unid("Emergencia"),             numPacientes: 2,  totalBs: 39173.20,    ingresoDivisa: 0,  porcentajeClinica: 0 },
        { id: randomUUID(), reporteId: r21.id, unidadServicioId: await unid("Imágenes"),               numPacientes: 27, totalBs: 1391968.49,  ingresoDivisa: 0,  porcentajeClinica: 0 },
        { id: randomUUID(), reporteId: r21.id, unidadServicioId: await unid("Imágenes/Emergencia"),    numPacientes: 1,  totalBs: 14436.60,    ingresoDivisa: 0,  porcentajeClinica: 0 },
        { id: randomUUID(), reporteId: r21.id, unidadServicioId: await unid("Laboratorio"),            numPacientes: 38, totalBs: 1350554.59,  ingresoDivisa: 62, porcentajeClinica: 0 },
        { id: randomUUID(), reporteId: r21.id, unidadServicioId: await unid("Laboratorio/Emergencia"), numPacientes: 7,  totalBs: 110367.82,   ingresoDivisa: 0,  porcentajeClinica: 0 },
      ],
    });

    await prisma.pacienteArea.createMany({
      data: [
        { id: randomUUID(), reporteId: r21.id, area: "Emergencia",     numPacientes: 14 },
        { id: randomUUID(), reporteId: r21.id, area: "Hospitalización", numPacientes: 16 },
        { id: randomUUID(), reporteId: r21.id, area: "UCI",             numPacientes: 0  },
      ],
    });

    await prisma.anticipo.createMany({
      data: [
        { id: randomUUID(), reporteId: r21.id, tipo: "HOSPITALIZACION", totalBs: 339260.10,  ingresoDivisa: 0, numPacientes: 1, pacienteNombre: "DARIN KASSEM",    estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r21.id, tipo: "HOSPITALIZACION", totalBs: 1290956.00, ingresoDivisa: 0, numPacientes: 1, pacienteNombre: "MONICA GUARINO",  estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r21.id, tipo: "HOSPITALIZACION", totalBs: 734858.45,  ingresoDivisa: 0, numPacientes: 1, pacienteNombre: "MARLENE ESSER",   estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r21.id, tipo: "HOSPITALIZACION", totalBs: 714651.30,  ingresoDivisa: 0, numPacientes: 1, pacienteNombre: "ANGELICA VIDAL",  estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r21.id, tipo: "HOSPITALIZACION", totalBs: 235532.05,  ingresoDivisa: 0, numPacientes: 1, pacienteNombre: "CARMEN COVA",     estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r21.id, tipo: "HOSPITALIZACION", totalBs: 149420.00,  ingresoDivisa: 0, numPacientes: 1, pacienteNombre: "HANNIEL VIÑA",    estado: "PENDIENTE" },
      ],
    });

    await prisma.cuentaPorCobrar.createMany({
      data: [
        { id: randomUUID(), reporteId: r21.id, nombreConvenio: "LA INTERNACIONAL",  totalBs: 9482010.67, ingresoDivisa: 19641.25, numPacientes: 0 },
        { id: randomUUID(), reporteId: r21.id, nombreConvenio: "MIRANDA (20-04-26)", totalBs: 3050504.48, ingresoDivisa: 6339.11,  numPacientes: 0 },
      ],
    });

    await prisma.aPS.create({
      data: {
        id: randomUUID(), reporteId: r21.id,
        consultas: 36, laboratoriosImagenes: 39, movimientosDia: 75, totalFacturados: 74,
        noFacturadosComentarios: "No Facturados dependen de resultados",
        facturadosComentarios: "Facturados de servicios anteriores",
      },
    });
    console.log("✅ Reporte 21-Apr insertado");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 22 DE ABRIL 2026  (tasa 482,76)
  // ══════════════════════════════════════════════════════════════════════════
  const exists22 = await prisma.dailyReport.findUnique({ where: { fecha: new Date("2026-04-22T12:00:00.000Z") } });
  if (exists22) {
    console.log("⚠️  Reporte 22-Apr ya existe — omitido");
  } else {
    console.log("\n📋 Insertando 22 DE ABRIL 2026...");
    const r22 = await prisma.dailyReport.create({
      data: {
        id: randomUUID(),
        fecha: new Date("2026-04-22T12:00:00.000Z"),
        tasaCambio: 482.76,
        estado: "CERRADO",
        creadoPorId: admin.id,
        createdAt: new Date("2026-04-22T12:00:00.000Z"),
        updatedAt: new Date("2026-04-22T12:00:00.000Z"),
      },
    });

    await prisma.consultaLinea.createMany({
      data: [
        { id: randomUUID(), reporteId: r22.id, especialidadId: await esp(2,  "Cardiología"),            numPacientes: 8,  totalBs: 73379.52,  ingresoDivisa: 0,  porcentajeClinica: 80.00  },
        { id: randomUUID(), reporteId: r22.id, especialidadId: await esp(3,  "Cirugía General"),        numPacientes: 2,  totalBs: 6526.91,   ingresoDivisa: 0,  porcentajeClinica: 10.00  },
        { id: randomUUID(), reporteId: r22.id, especialidadId: await esp(4,  "Cirugía Plástica"),       numPacientes: 2,  totalBs: 20193.86,  ingresoDivisa: 0,  porcentajeClinica: 20.00  },
        { id: randomUUID(), reporteId: r22.id, especialidadId: await esp(8,  "Fisiatría"),              numPacientes: 9,  totalBs: 125517.60, ingresoDivisa: 0,  porcentajeClinica: 90.00  },
        { id: randomUUID(), reporteId: r22.id, especialidadId: await esp(9,  "Gastroenterología"),      numPacientes: 3,  totalBs: 38620.80,  ingresoDivisa: 0,  porcentajeClinica: 30.00  },
        { id: randomUUID(), reporteId: r22.id, especialidadId: await esp(10, "Ginecología"),            numPacientes: 14, totalBs: 82991.27,  ingresoDivisa: 0,  porcentajeClinica: 70.00  },
        { id: randomUUID(), reporteId: r22.id, especialidadId: await esp(11, "Ginecología 2"),          numPacientes: 4,  totalBs: 16896.60,  ingresoDivisa: 0,  porcentajeClinica: 20.00  },
        { id: randomUUID(), reporteId: r22.id, especialidadId: await esp(12, "Ginecologia Regenertiva"),numPacientes: 1,  totalBs: 4827.60,   ingresoDivisa: 0,  porcentajeClinica: 10.00  },
        { id: randomUUID(), reporteId: r22.id, especialidadId: await esp(13, "Medicina Interna"),       numPacientes: 13, totalBs: 300276.71, ingresoDivisa: 0,  porcentajeClinica: 130.00 },
        { id: randomUUID(), reporteId: r22.id, especialidadId: await esp(18, "Oftamología"),            numPacientes: 13, totalBs: 646898.40, ingresoDivisa: 0,  porcentajeClinica: 97.50  },
        { id: randomUUID(), reporteId: r22.id, especialidadId: await esp(19, "Hemato-Oncología"),       numPacientes: 7,  totalBs: 251175.21, ingresoDivisa: 10, porcentajeClinica: 70.00  },
        { id: randomUUID(), reporteId: r22.id, especialidadId: await esp(20, "Otorrinolaringología"),   numPacientes: 17, totalBs: 80620.90,  ingresoDivisa: 0,  porcentajeClinica: 170.00 },
        { id: randomUUID(), reporteId: r22.id, especialidadId: await esp(21, "Pediatría"),              numPacientes: 11, totalBs: 54069.11,  ingresoDivisa: 0,  porcentajeClinica: 110.00 },
        { id: randomUUID(), reporteId: r22.id, especialidadId: await esp(22, "Psiquiatría"),            numPacientes: 2,  totalBs: 9655.20,   ingresoDivisa: 0,  porcentajeClinica: 20.00  },
        { id: randomUUID(), reporteId: r22.id, especialidadId: await esp(24, "Traumatología"),          numPacientes: 9,  totalBs: 157675.30, ingresoDivisa: 0,  porcentajeClinica: 45.00  },
        { id: randomUUID(), reporteId: r22.id, especialidadId: await esp(25, "Urología"),               numPacientes: 5,  totalBs: 24138.00,  ingresoDivisa: 0,  porcentajeClinica: 25.00  },
      ],
    });

    await prisma.servicioLinea.createMany({
      data: [
        { id: randomUUID(), reporteId: r22.id, unidadServicioId: await unid("Anatomía Patológica"),    numPacientes: 4,  totalBs: 106207.20,  ingresoDivisa: 0,  porcentajeClinica: 0 },
        { id: randomUUID(), reporteId: r22.id, unidadServicioId: await unid("Banco de Sangre"),        numPacientes: 1,  totalBs: 12069.00,   ingresoDivisa: 0,  porcentajeClinica: 0 },
        { id: randomUUID(), reporteId: r22.id, unidadServicioId: await unid("Emergencia"),             numPacientes: 3,  totalBs: 627269.62,  ingresoDivisa: 0,  porcentajeClinica: 0 },
        { id: randomUUID(), reporteId: r22.id, unidadServicioId: await unid("Imágenes"),               numPacientes: 78, totalBs: 2058488.64, ingresoDivisa: 20, porcentajeClinica: 0 },
        { id: randomUUID(), reporteId: r22.id, unidadServicioId: await unid("Laboratorio"),            numPacientes: 57, totalBs: 1141341.09, ingresoDivisa: 0,  porcentajeClinica: 0 },
        { id: randomUUID(), reporteId: r22.id, unidadServicioId: await unid("Laboratorio/Emergencia"), numPacientes: 2,  totalBs: 110237.30,  ingresoDivisa: 0,  porcentajeClinica: 0 },
      ],
    });

    await prisma.pacienteArea.createMany({
      data: [
        { id: randomUUID(), reporteId: r22.id, area: "Emergencia",     numPacientes: 10 },
        { id: randomUUID(), reporteId: r22.id, area: "Hospitalización", numPacientes: 15 },
        { id: randomUUID(), reporteId: r22.id, area: "UCI",             numPacientes: 0  },
      ],
    });

    await prisma.anticipo.createMany({
      data: [
        { id: randomUUID(), reporteId: r22.id, tipo: "HOSPITALIZACION", totalBs: 113240.50,   ingresoDivisa: 0, numPacientes: 1, pacienteNombre: "NATALIE MARCANO", estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r22.id, tipo: "HOSPITALIZACION", totalBs: 2848275.74,  ingresoDivisa: 0, numPacientes: 1, pacienteNombre: "MARIA TURBAY",    estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r22.id, tipo: "ESTUDIOS",        totalBs: 14118.05,    ingresoDivisa: 0, numPacientes: 1, pacienteNombre: "CLETA FERRER",    estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r22.id, tipo: "HOSPITALIZACION", totalBs: 648234.33,   ingresoDivisa: 0, numPacientes: 1, pacienteNombre: "MARLENE ESSER",   estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r22.id, tipo: "HOSPITALIZACION", totalBs: 162394.20,   ingresoDivisa: 0, numPacientes: 1, pacienteNombre: "AILYN BONILLO",   estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r22.id, tipo: "ESTUDIOS",        totalBs: 68734.35,    ingresoDivisa: 0, numPacientes: 1, pacienteNombre: "CLETA FERRER",    estado: "PENDIENTE" },
      ],
    });

    await prisma.cuentaPorCobrar.createMany({
      data: [
        { id: randomUUID(), reporteId: r22.id, nombreConvenio: "MAPFRED",                                  totalBs: 581985.69,    ingresoDivisa: 1205.54,  numPacientes: 0 },
        { id: randomUUID(), reporteId: r22.id, nombreConvenio: "HISPANA",                                  totalBs: 3792298.51,   ingresoDivisa: 7855.45,  numPacientes: 0 },
        { id: randomUUID(), reporteId: r22.id, nombreConvenio: "CARACAS",                                  totalBs: 7680204.33,   ingresoDivisa: 15908.95, numPacientes: 0 },
        { id: randomUUID(), reporteId: r22.id, nombreConvenio: "HORIZONTE",                                totalBs: 11750975.13,  ingresoDivisa: 24341.24, numPacientes: 0 },
        { id: randomUUID(), reporteId: r22.id, nombreConvenio: "Dr. HECTOR MARCANO / ANUALIDAD",           totalBs: 241380.00,    ingresoDivisa: 500.00,   numPacientes: 0 },
        { id: randomUUID(), reporteId: r22.id, nombreConvenio: "Dr. JOSE ANDREY RODRIGUEZ / ANUALIDAD",    totalBs: 144828.00,    ingresoDivisa: 300.00,   numPacientes: 0 },
      ],
    });

    await prisma.aPS.create({
      data: {
        id: randomUUID(), reporteId: r22.id,
        consultas: 0, laboratoriosImagenes: 36, movimientosDia: 36, totalFacturados: 1,
        noFacturadosComentarios: "No Facturados dependen de resultados",
        facturadosComentarios: "Facturados de servicios anteriores",
      },
    });
    console.log("✅ Reporte 22-Apr insertado");
  }

  console.log("\n✅ Carga 21-22 abril 2026 completada.");
}

main()
  .catch(e => { console.error("❌ Error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
