import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const lineaConsultaSchema = z.object({
  especialidadId: z.string(),
  ingresoDivisa: z.number().min(0).default(0),
  totalBs: z.number().min(0).default(0),
  numPacientes: z.number().int().min(0).default(0),
  porcentajeClinica: z.number().min(0).default(0),
  comentarios: z.string().optional(),
});

const lineaServicioSchema = z.object({
  unidadServicioId: z.string(),
  ingresoDivisa: z.number().min(0).default(0),
  totalBs: z.number().min(0).default(0),
  numPacientes: z.number().int().min(0).default(0),
  porcentajeClinica: z.number().min(0).default(0),
  comentarios: z.string().optional(),
});

const pacienteAreaSchema = z.object({
  area: z.enum(["EMERGENCIA", "HOSPITALIZACION", "UCI"]),
  numPacientes: z.number().int().min(0).default(0),
  comentarios: z.string().optional(),
});

const anticipoSchema = z.object({
  tipo: z.enum(["HOSPITALIZACION", "EMERGENCIA", "ESTUDIOS"]),
  ingresoDivisa: z.number().min(0).default(0),
  totalBs: z.number().min(0).default(0),
  numPacientes: z.number().int().min(0).default(1),
  pacienteNombre: z.string().optional(),
  comentarios: z.string().optional(),
  estado: z.enum(["PENDIENTE", "APLICADO"]).default("PENDIENTE"),
  aseguradoraId: z.string().optional().nullable(),
});

const cuentaSchema = z.object({
  nombreConvenio: z.string().min(1),
  ingresoDivisa: z.number().min(0).default(0),
  totalBs: z.number().min(0).default(0),
  numPacientes: z.number().int().min(0).default(0),
  comentarios: z.string().optional(),
  aseguradoraId: z.string().optional().nullable(),
});

const apsSchema = z.object({
  consultas: z.number().int().min(0).default(0),
  laboratoriosImagenes: z.number().int().min(0).default(0),
  movimientosDia: z.number().int().min(0).default(0),
  totalFacturados: z.number().int().min(0).default(0),
  noFacturadosComentarios: z.string().optional(),
  facturadosComentarios: z.string().optional(),
});

export const reporteSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tasaCambio: z.number().positive("La tasa de cambio es requerida"),
  observaciones: z.string().optional(),
  estado: z.enum(["BORRADOR", "CERRADO"]).default("BORRADOR"),
  consultas: z.array(lineaConsultaSchema).default([]),
  servicios: z.array(lineaServicioSchema).default([]),
  pacientesArea: z.array(pacienteAreaSchema).default([]),
  anticipos: z.array(anticipoSchema).default([]),
  cuentasPorCobrar: z.array(cuentaSchema).default([]),
  aps: apsSchema.optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 20;

  const [total, reportes] = await Promise.all([
    prisma.dailyReport.count(),
    prisma.dailyReport.findMany({
      orderBy: { fecha: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        fecha: true,
        tasaCambio: true,
        estado: true,
        observaciones: true,
        createdAt: true,
        creadoPor: { select: { name: true } },
        _count: {
          select: { consultas: true, servicios: true, anticipos: true },
        },
      },
    }),
  ]);

  return NextResponse.json({ reportes, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "CAPTURISTA") {
    return NextResponse.json({ error: "Sin permiso para crear reportes" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = reporteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 },
    );
  }

  const { fecha, tasaCambio, observaciones, estado, consultas, servicios, pacientesArea, anticipos, cuentasPorCobrar, aps } = parsed.data;
  const userId = (session.user as { id: string }).id;
  const fechaDate = new Date(fecha + "T12:00:00.000Z");

  const existing = await prisma.dailyReport.findUnique({ where: { fecha: fechaDate } });
  if (existing) {
    return NextResponse.json({ error: "Ya existe un reporte para esa fecha", id: existing.id }, { status: 409 });
  }

  const reporte = await prisma.dailyReport.create({
    data: {
      fecha: fechaDate,
      tasaCambio,
      observaciones,
      estado,
      cerradoAt: estado === "CERRADO" ? new Date() : null,
      creadoPorId: userId,
      consultas: {
        create: consultas.filter(c => c.numPacientes > 0 || c.totalBs > 0 || c.ingresoDivisa > 0),
      },
      servicios: {
        create: servicios.filter(s => s.numPacientes > 0 || s.totalBs > 0 || s.ingresoDivisa > 0),
      },
      pacientesArea: {
        create: pacientesArea.filter(p => p.numPacientes > 0),
      },
      anticipos: {
        create: anticipos,
      },
      cuentasPorCobrar: {
        create: cuentasPorCobrar,
      },
      ...(aps ? { aps: { create: aps } } : {}),
    },
  });

  return NextResponse.json({ reporte }, { status: 201 });
}
