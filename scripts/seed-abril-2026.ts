/**
 * Carga los reportes del 17, 18 y 20 de abril 2026 en Neon/PostgreSQL.
 * Ejecutar UNA SOLA VEZ:
 *   npx tsx scripts/seed-abril-2026.ts
 */
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

async function main() {
  // ── Lookups ────────────────────────────────────────────────────────────────
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

  /** Busca unidad por nombre exacto (case-insensitive); si no existe la crea */
  const unid = async (nombre: string): Promise<string> => {
    const key = nombre.toLowerCase().trim();
    if (unidByNombre[key]) return unidByNombre[key];
    maxCodigo += 1;
    const u = await prisma.unidadServicio.create({
      data: {
        id: randomUUID(),
        codigo: maxCodigo,
        nombre,
        categoria: "SERVICIO",
        orden: maxCodigo,
        activa: true,
      },
    });
    unidByNombre[key] = u.id;
    console.log(`  ⚡ Nueva unidad creada: "${nombre}" (código ${maxCodigo})`);
    return u.id;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // 17 DE ABRIL 2026  (tasa 480,26)
  // ══════════════════════════════════════════════════════════════════════════
  const exists17 = await prisma.dailyReport.findUnique({
    where: { fecha: new Date("2026-04-17T12:00:00.000Z") },
  });
  if (exists17) {
    console.log("⚠️  Reporte 17-Apr ya existe — omitido");
  } else {
    console.log("\n📋 Insertando 17 DE ABRIL 2026...");
    const r17 = await prisma.dailyReport.create({
      data: {
        id: randomUUID(),
        fecha: new Date("2026-04-17T12:00:00.000Z"),
        tasaCambio: 480.26,
        estado: "CERRADO",
        creadoPorId: admin.id,
        createdAt: new Date("2026-04-17T12:00:00.000Z"),
        updatedAt: new Date("2026-04-17T12:00:00.000Z"),
      },
    });

    await prisma.consultaLinea.createMany({
      data: [
        { id: randomUUID(), reporteId: r17.id, especialidadId: espMap[2],  numPacientes: 17, totalBs: 239608.23,  ingresoDivisa: 0,  porcentajeClinica: 170.00 },
        { id: randomUUID(), reporteId: r17.id, especialidadId: espMap[3],  numPacientes: 5,  totalBs: 74363.56,   ingresoDivisa: 0,  porcentajeClinica: 25.00  },
        { id: randomUUID(), reporteId: r17.id, especialidadId: espMap[8],  numPacientes: 14, totalBs: 283353.48,  ingresoDivisa: 0,  porcentajeClinica: 140.00 },
        { id: randomUUID(), reporteId: r17.id, especialidadId: espMap[9],  numPacientes: 3,  totalBs: 14407.80,   ingresoDivisa: 0,  porcentajeClinica: 30.00  },
        { id: randomUUID(), reporteId: r17.id, especialidadId: espMap[10], numPacientes: 13, totalBs: 92475.44,   ingresoDivisa: 0,  porcentajeClinica: 65.00  },
        { id: randomUUID(), reporteId: r17.id, especialidadId: espMap[11], numPacientes: 2,  totalBs: 9605.20,    ingresoDivisa: 0,  porcentajeClinica: 10.00  },
        { id: randomUUID(), reporteId: r17.id, especialidadId: espMap[12], numPacientes: 9,  totalBs: 24013.00,   ingresoDivisa: 0,  porcentajeClinica: 90.00  },
        { id: randomUUID(), reporteId: r17.id, especialidadId: espMap[13], numPacientes: 13, totalBs: 252030.87,  ingresoDivisa: 0,  porcentajeClinica: 130.00 },
        { id: randomUUID(), reporteId: r17.id, especialidadId: espMap[18], numPacientes: 19, totalBs: 1031598.48, ingresoDivisa: 20, porcentajeClinica: 142.50 },
        { id: randomUUID(), reporteId: r17.id, especialidadId: espMap[20], numPacientes: 4,  totalBs: 19210.40,   ingresoDivisa: 0,  porcentajeClinica: 40.00  },
        { id: randomUUID(), reporteId: r17.id, especialidadId: espMap[21], numPacientes: 8,  totalBs: 36787.92,   ingresoDivisa: 0,  porcentajeClinica: 80.00  },
        { id: randomUUID(), reporteId: r17.id, especialidadId: espMap[22], numPacientes: 3,  totalBs: 48026.00,   ingresoDivisa: 0,  porcentajeClinica: 30.00  },
        { id: randomUUID(), reporteId: r17.id, especialidadId: espMap[24], numPacientes: 16, totalBs: 67159.61,   ingresoDivisa: 0,  porcentajeClinica: 80.00  },
        { id: randomUUID(), reporteId: r17.id, especialidadId: espMap[25], numPacientes: 3,  totalBs: 17282.12,   ingresoDivisa: 0,  porcentajeClinica: 15.00  },
      ],
    });

    await prisma.servicioLinea.createMany({
      data: [
        { id: randomUUID(), reporteId: r17.id, unidadServicioId: await unid("Anatomía Patológica"), numPacientes: 3,  totalBs: 72039.00,    ingresoDivisa: 0,  porcentajeClinica: 0 },
        { id: randomUUID(), reporteId: r17.id, unidadServicioId: await unid("Emergencia"),          numPacientes: 2,  totalBs: 148640.73,   ingresoDivisa: 19, porcentajeClinica: 0 },
        { id: randomUUID(), reporteId: r17.id, unidadServicioId: await unid("Imágenes"),            numPacientes: 33, totalBs: 1079528.42,  ingresoDivisa: 0,  porcentajeClinica: 0 },
        { id: randomUUID(), reporteId: r17.id, unidadServicioId: await unid("Laboratorio"),         numPacientes: 47, totalBs: 639673.60,   ingresoDivisa: 5,  porcentajeClinica: 0 },
      ],
    });

    await prisma.pacienteArea.createMany({
      data: [
        { id: randomUUID(), reporteId: r17.id, area: "Emergencia",     numPacientes: 11 },
        { id: randomUUID(), reporteId: r17.id, area: "Hospitalización", numPacientes: 15 },
        { id: randomUUID(), reporteId: r17.id, area: "UCI",             numPacientes: 2  },
      ],
    });

    await prisma.anticipo.createMany({
      data: [
        { id: randomUUID(), reporteId: r17.id, tipo: "HOSPITALIZACION", totalBs: 0,          ingresoDivisa: 250,  numPacientes: 1, pacienteNombre: "GAZALI, JANON",      estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r17.id, tipo: "HOSPITALIZACION", totalBs: 0,          ingresoDivisa: 750,  numPacientes: 3, pacienteNombre: null,                  estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r17.id, tipo: "HOSPITALIZACION", totalBs: 0,          ingresoDivisa: 2000, numPacientes: 8, pacienteNombre: null,                  estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r17.id, tipo: "ESTUDIOS",        totalBs: 8806.00,    ingresoDivisa: 0,   numPacientes: 1, pacienteNombre: "GIL, HEYEN",          estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r17.id, tipo: "ESTUDIOS",        totalBs: 58430.40,   ingresoDivisa: 0,   numPacientes: 1, pacienteNombre: "GIL, HEYEN",          estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r17.id, tipo: "ESTUDIOS",        totalBs: 3245.20,    ingresoDivisa: 0,   numPacientes: 1, pacienteNombre: "PETRA, BELLO",        estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r17.id, tipo: "ESTUDIOS",        totalBs: 72039.00,   ingresoDivisa: 0,   numPacientes: 1, pacienteNombre: "JIMENEZ, RICARDO",    estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r17.id, tipo: "HOSPITALIZACION", totalBs: 741616.07,  ingresoDivisa: 0,   numPacientes: 1, pacienteNombre: "BARGIELA, SALVADOR",  estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r17.id, tipo: "HOSPITALIZACION", totalBs: 817939.08,  ingresoDivisa: 0,   numPacientes: 1, pacienteNombre: "BARGIELA, MAURICIO",  estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r17.id, tipo: "HOSPITALIZACION", totalBs: 451444.40,  ingresoDivisa: 0,   numPacientes: 1, pacienteNombre: "ORCHIDEA CICERO",     estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r17.id, tipo: "HOSPITALIZACION", totalBs: 677166.60,  ingresoDivisa: 0,   numPacientes: 1, pacienteNombre: "YENNY CHENG",         estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r17.id, tipo: "HOSPITALIZACION", totalBs: 196906.60,  ingresoDivisa: 0,   numPacientes: 1, pacienteNombre: "BARBARA ROJAS",       estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r17.id, tipo: "HOSPITALIZACION", totalBs: 719666.25,  ingresoDivisa: 0,   numPacientes: 1, pacienteNombre: "ANGELICA VIDAL",      estado: "PENDIENTE" },
      ],
    });

    await prisma.cuentaPorCobrar.createMany({
      data: [
        { id: randomUUID(), reporteId: r17.id, nombreConvenio: "MAFRED",                                totalBs: 543247.50,   ingresoDivisa: 1131.15,  numPacientes: 0 },
        { id: randomUUID(), reporteId: r17.id, nombreConvenio: "SENIAT",                                totalBs: 1580989.80,  ingresoDivisa: 3291.95,  numPacientes: 0 },
        { id: randomUUID(), reporteId: r17.id, nombreConvenio: "CARACAS",                               totalBs: 260254.18,   ingresoDivisa: 541.90,   numPacientes: 0 },
        { id: randomUUID(), reporteId: r17.id, nombreConvenio: "MIRANDA",                               totalBs: 657362.20,   ingresoDivisa: 1368.76,  numPacientes: 0 },
        { id: randomUUID(), reporteId: r17.id, nombreConvenio: "MIRANDA (2)",                           totalBs: 35056.40,    ingresoDivisa: 72.99,    numPacientes: 0 },
        { id: randomUUID(), reporteId: r17.id, nombreConvenio: "LA MUNDIAL",                            totalBs: 17337284.92, ingresoDivisa: 36099.79, numPacientes: 0 },
        { id: randomUUID(), reporteId: r17.id, nombreConvenio: "Dra. GREYSI QUIJADA / ABONO ANUALIDAD", totalBs: 192104.00,   ingresoDivisa: 400.00,   numPacientes: 0 },
        { id: randomUUID(), reporteId: r17.id, nombreConvenio: "Dr. MIGUEL MORENO / ABONO ANUALIDAD",   totalBs: 24013.00,    ingresoDivisa: 50.00,    numPacientes: 0 },
        { id: randomUUID(), reporteId: r17.id, nombreConvenio: "Dr. VICTOR SALAZAR / ABONO ANUALIDAD",  totalBs: 144078.00,   ingresoDivisa: 300.00,   numPacientes: 0 },
        { id: randomUUID(), reporteId: r17.id, nombreConvenio: "Dr. MARIA AMPARAN / ABONO ANUALIDAD",   totalBs: 120065.00,   ingresoDivisa: 250.00,   numPacientes: 0 },
      ],
    });

    await prisma.aPS.create({
      data: {
        id: randomUUID(),
        reporteId: r17.id,
        consultas: 23,
        laboratoriosImagenes: 21,
        movimientosDia: 44,
        totalFacturados: 55,
        noFacturadosComentarios: "No Facturados dependen de resultados",
        facturadosComentarios: "Facturados de servicios anteriores",
      },
    });
    console.log("✅ Reporte 17-Apr insertado");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 18 DE ABRIL 2026  (tasa 480,26)
  // ══════════════════════════════════════════════════════════════════════════
  const exists18 = await prisma.dailyReport.findUnique({
    where: { fecha: new Date("2026-04-18T12:00:00.000Z") },
  });
  if (exists18) {
    console.log("⚠️  Reporte 18-Apr ya existe — omitido");
  } else {
    console.log("\n📋 Insertando 18 DE ABRIL 2026...");
    const r18 = await prisma.dailyReport.create({
      data: {
        id: randomUUID(),
        fecha: new Date("2026-04-18T12:00:00.000Z"),
        tasaCambio: 480.26,
        estado: "CERRADO",
        creadoPorId: admin.id,
        createdAt: new Date("2026-04-18T12:00:00.000Z"),
        updatedAt: new Date("2026-04-18T12:00:00.000Z"),
      },
    });

    await prisma.consultaLinea.createMany({
      data: [
        { id: randomUUID(), reporteId: r18.id, especialidadId: espMap[3],  numPacientes: 2, totalBs: 8664.08, ingresoDivisa: 0, porcentajeClinica: 10.00 },
        { id: randomUUID(), reporteId: r18.id, especialidadId: espMap[10], numPacientes: 1, totalBs: 7203.90, ingresoDivisa: 0, porcentajeClinica: 5.00  },
        { id: randomUUID(), reporteId: r18.id, especialidadId: espMap[13], numPacientes: 1, totalBs: 4802.06, ingresoDivisa: 0, porcentajeClinica: 10.00 },
        { id: randomUUID(), reporteId: r18.id, especialidadId: espMap[20], numPacientes: 1, totalBs: 4802.60, ingresoDivisa: 0, porcentajeClinica: 10.00 },
        { id: randomUUID(), reporteId: r18.id, especialidadId: espMap[25], numPacientes: 1, totalBs: 2401.30, ingresoDivisa: 0, porcentajeClinica: 5.00  },
      ],
    });

    await prisma.servicioLinea.createMany({
      data: [
        { id: randomUUID(), reporteId: r18.id, unidadServicioId: await unid("Imágenes"),    numPacientes: 5,  totalBs: 214195.96, ingresoDivisa: 0,  porcentajeClinica: 0 },
        { id: randomUUID(), reporteId: r18.id, unidadServicioId: await unid("Laboratorio"), numPacientes: 12, totalBs: 246066.03, ingresoDivisa: 34, porcentajeClinica: 0 },
      ],
    });

    await prisma.pacienteArea.createMany({
      data: [
        { id: randomUUID(), reporteId: r18.id, area: "Emergencia",     numPacientes: 8  },
        { id: randomUUID(), reporteId: r18.id, area: "Hospitalización", numPacientes: 12 },
        { id: randomUUID(), reporteId: r18.id, area: "UCI",             numPacientes: 2  },
      ],
    });

    await prisma.anticipo.create({
      data: {
        id: randomUUID(),
        reporteId: r18.id,
        tipo: "HOSPITALIZACION",
        totalBs: 576300.00,
        ingresoDivisa: 0,
        numPacientes: 1,
        pacienteNombre: "ESSER, MARLENE",
        estado: "PENDIENTE",
      },
    });

    await prisma.aPS.create({
      data: {
        id: randomUUID(),
        reporteId: r18.id,
        consultas: 0,
        laboratoriosImagenes: 8,
        movimientosDia: 8,
        totalFacturados: 0,
        noFacturadosComentarios: "No Facturados dependen de resultados",
        facturadosComentarios: "Facturados de servicios anteriores",
      },
    });
    console.log("✅ Reporte 18-Apr insertado");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 20 DE ABRIL 2026  (tasa 481,22)
  // ══════════════════════════════════════════════════════════════════════════
  const exists20 = await prisma.dailyReport.findUnique({
    where: { fecha: new Date("2026-04-20T12:00:00.000Z") },
  });
  if (exists20) {
    console.log("⚠️  Reporte 20-Apr ya existe — omitido");
  } else {
    console.log("\n📋 Insertando 20 DE ABRIL 2026...");
    const r20 = await prisma.dailyReport.create({
      data: {
        id: randomUUID(),
        fecha: new Date("2026-04-20T12:00:00.000Z"),
        tasaCambio: 481.22,
        estado: "CERRADO",
        creadoPorId: admin.id,
        createdAt: new Date("2026-04-20T12:00:00.000Z"),
        updatedAt: new Date("2026-04-20T12:00:00.000Z"),
      },
    });

    await prisma.consultaLinea.createMany({
      data: [
        { id: randomUUID(), reporteId: r20.id, especialidadId: espMap[2],  numPacientes: 20, totalBs: 365800.42, ingresoDivisa: 0, porcentajeClinica: 200.00 },
        { id: randomUUID(), reporteId: r20.id, especialidadId: espMap[3],  numPacientes: 6,  totalBs: 54146.88,  ingresoDivisa: 0, porcentajeClinica: 30.00  },
        { id: randomUUID(), reporteId: r20.id, especialidadId: espMap[8],  numPacientes: 9,  totalBs: 204518.50, ingresoDivisa: 0, porcentajeClinica: 90.00  },
        { id: randomUUID(), reporteId: r20.id, especialidadId: espMap[9],  numPacientes: 8,  totalBs: 139553.80, ingresoDivisa: 0, porcentajeClinica: 80.00  },
        { id: randomUUID(), reporteId: r20.id, especialidadId: espMap[10], numPacientes: 17, totalBs: 90642.60,  ingresoDivisa: 0, porcentajeClinica: 85.00  },
        { id: randomUUID(), reporteId: r20.id, especialidadId: espMap[11], numPacientes: 5,  totalBs: 24061.00,  ingresoDivisa: 0, porcentajeClinica: 25.00  },
        { id: randomUUID(), reporteId: r20.id, especialidadId: espMap[13], numPacientes: 15, totalBs: 192488.00, ingresoDivisa: 0, porcentajeClinica: 150.00 },
        { id: randomUUID(), reporteId: r20.id, especialidadId: espMap[18], numPacientes: 5,  totalBs: 230985.60, ingresoDivisa: 0, porcentajeClinica: 37.50  },
        { id: randomUUID(), reporteId: r20.id, especialidadId: espMap[20], numPacientes: 4,  totalBs: 19248.80,  ingresoDivisa: 0, porcentajeClinica: 40.00  },
        { id: randomUUID(), reporteId: r20.id, especialidadId: espMap[22], numPacientes: 3,  totalBs: 14436.60,  ingresoDivisa: 0, porcentajeClinica: 30.00  },
        { id: randomUUID(), reporteId: r20.id, especialidadId: espMap[24], numPacientes: 25, totalBs: 107355.59, ingresoDivisa: 0, porcentajeClinica: 125.00 },
        { id: randomUUID(), reporteId: r20.id, especialidadId: espMap[25], numPacientes: 5,  totalBs: 52934.20,  ingresoDivisa: 0, porcentajeClinica: 25.00  },
      ],
    });

    await prisma.servicioLinea.createMany({
      data: [
        { id: randomUUID(), reporteId: r20.id, unidadServicioId: await unid("Anatomía Patológica"),   numPacientes: 2,  totalBs: 55340.30,    ingresoDivisa: 0,   porcentajeClinica: 0 },
        { id: randomUUID(), reporteId: r20.id, unidadServicioId: await unid("Emergencia"),            numPacientes: 6,  totalBs: 1659261.33,  ingresoDivisa: 0,   porcentajeClinica: 0 },
        { id: randomUUID(), reporteId: r20.id, unidadServicioId: await unid("Imágenes"),              numPacientes: 31, totalBs: 1881628.94,  ingresoDivisa: 154, porcentajeClinica: 0 },
        { id: randomUUID(), reporteId: r20.id, unidadServicioId: await unid("Imágenes/Emergencia"),   numPacientes: 3,  totalBs: 96052.00,    ingresoDivisa: 0,   porcentajeClinica: 0 },
        { id: randomUUID(), reporteId: r20.id, unidadServicioId: await unid("Laboratorio"),           numPacientes: 16, totalBs: 678063.05,   ingresoDivisa: 166, porcentajeClinica: 0 },
        { id: randomUUID(), reporteId: r20.id, unidadServicioId: await unid("Laboratorio/Emergencia"),numPacientes: 27, totalBs: 306333.76,   ingresoDivisa: 0,   porcentajeClinica: 0 },
      ],
    });

    await prisma.pacienteArea.createMany({
      data: [
        { id: randomUUID(), reporteId: r20.id, area: "Emergencia",     numPacientes: 10 },
        { id: randomUUID(), reporteId: r20.id, area: "Hospitalización", numPacientes: 11 },
        { id: randomUUID(), reporteId: r20.id, area: "UCI",             numPacientes: 1  },
      ],
    });

    await prisma.anticipo.createMany({
      data: [
        { id: randomUUID(), reporteId: r20.id, tipo: "HOSPITALIZACION", totalBs: 1390725.80, ingresoDivisa: 0,   numPacientes: 1, pacienteNombre: "CAROLE GAGNON",     estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r20.id, tipo: "HOSPITALIZACION", totalBs: 3700.89,    ingresoDivisa: 0,   numPacientes: 1, pacienteNombre: "GLADYS RODRIGUEZ",   estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r20.id, tipo: "HOSPITALIZACION", totalBs: 21790.75,   ingresoDivisa: 0,   numPacientes: 1, pacienteNombre: "CARMEN COVA",        estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r20.id, tipo: "HOSPITALIZACION", totalBs: 0,          ingresoDivisa: 500, numPacientes: 1, pacienteNombre: "ALIRANGEL QUINTERO", estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r20.id, tipo: "HOSPITALIZACION", totalBs: 136121.70,  ingresoDivisa: 0,   numPacientes: 1, pacienteNombre: "RAMON RAMOS",        estado: "PENDIENTE" },
        { id: randomUUID(), reporteId: r20.id, tipo: "HOSPITALIZACION", totalBs: 62771.80,   ingresoDivisa: 0,   numPacientes: 1, pacienteNombre: "LUISA VILLARROEL",   estado: "PENDIENTE" },
      ],
    });

    await prisma.aPS.create({
      data: {
        id: randomUUID(),
        reporteId: r20.id,
        consultas: 26,
        laboratoriosImagenes: 50,
        movimientosDia: 76,
        totalFacturados: 66,
        noFacturadosComentarios: "No Facturados dependen de resultados",
        facturadosComentarios: "Facturados de servicios anteriores",
      },
    });
    console.log("✅ Reporte 20-Apr insertado");
  }

  console.log("\n✅ Carga de abril 2026 completada.");
}

main()
  .catch(e => { console.error("❌ Error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
