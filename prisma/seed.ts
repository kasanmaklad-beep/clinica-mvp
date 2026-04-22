import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Especialidades extraídas de reportes reales de Hospital Clínicas del Este.
// Los códigos (N°) corresponden al catálogo original. Honorario por defecto $10/paciente.
const ESPECIALIDADES = [
  { codigo: 1, nombre: "Anestesiología", honorario: 10 },
  { codigo: 2, nombre: "Cardiología", honorario: 10 },
  { codigo: 3, nombre: "Cirugía General", honorario: 5 },
  { codigo: 4, nombre: "Cirugía Plástica", honorario: 10 },
  { codigo: 5, nombre: "Dermatología", honorario: 10 },
  { codigo: 6, nombre: "Endocrinología", honorario: 10 },
  { codigo: 7, nombre: "Endoscopia", honorario: 10 },
  { codigo: 8, nombre: "Fisiatría", honorario: 10 },
  { codigo: 9, nombre: "Gastroenterología", honorario: 10 },
  { codigo: 10, nombre: "Ginecología", honorario: 5 },
  { codigo: 11, nombre: "Ginecología 2", honorario: 5 },
  { codigo: 12, nombre: "Ginecología Regenerativa", honorario: 10 },
  { codigo: 13, nombre: "Medicina Interna", honorario: 10 },
  { codigo: 14, nombre: "Nefrología", honorario: 10 },
  { codigo: 15, nombre: "Neumología", honorario: 10 },
  { codigo: 16, nombre: "Neurología", honorario: 10 },
  { codigo: 17, nombre: "Nutrición", honorario: 7.5 },
  { codigo: 18, nombre: "Oftalmología", honorario: 7.5 },
  { codigo: 19, nombre: "Oncología", honorario: 10 },
  { codigo: 20, nombre: "Otorrinolaringología", honorario: 10 },
  { codigo: 21, nombre: "Pediatría", honorario: 10 },
  { codigo: 22, nombre: "Psiquiatría", honorario: 10 },
  { codigo: 23, nombre: "Psicología", honorario: 10 },
  { codigo: 24, nombre: "Traumatología", honorario: 5 },
  { codigo: 25, nombre: "Urología", honorario: 5 },
];

const UNIDADES_SERVICIO = [
  { codigo: 2, nombre: "Laboratorio" },
  { codigo: 3, nombre: "Laboratorio/Emergencia" },
  { codigo: 4, nombre: "Imágenes/Emergencia" },
  { codigo: 5, nombre: "Imágenes" },
  { codigo: 6, nombre: "Emergencia" },
  { codigo: 7, nombre: "Anatomía Patológica" },
];

async function main() {
  console.log("🌱 Seeding...");

  for (const e of ESPECIALIDADES) {
    await prisma.especialidad.upsert({
      where: { codigo: e.codigo },
      update: { nombre: e.nombre, honorarioClinica: e.honorario, orden: e.codigo },
      create: {
        codigo: e.codigo,
        nombre: e.nombre,
        honorarioClinica: e.honorario,
        orden: e.codigo,
      },
    });
  }
  console.log(`  ✔ ${ESPECIALIDADES.length} especialidades`);

  for (const u of UNIDADES_SERVICIO) {
    await prisma.unidadServicio.upsert({
      where: { codigo: u.codigo },
      update: { nombre: u.nombre, orden: u.codigo },
      create: { codigo: u.codigo, nombre: u.nombre, orden: u.codigo },
    });
  }
  console.log(`  ✔ ${UNIDADES_SERVICIO.length} unidades de servicio`);

  const adminEmail = "admin@clinica.local";
  const adminPassword = "Admin123!";
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const hash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: "Administrador",
        passwordHash: hash,
        role: "ADMIN",
      },
    });
    console.log(`  ✔ Usuario admin creado`);
    console.log(`\n  📧 Correo:     ${adminEmail}`);
    console.log(`  🔑 Contraseña: ${adminPassword}\n`);
  } else {
    console.log(`  ⏭  Admin ya existe (${adminEmail})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
