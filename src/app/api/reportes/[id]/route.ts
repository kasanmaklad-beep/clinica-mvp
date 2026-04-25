import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { reporteSchema } from "../route";

type Ctx = { params: Promise<{ id: string }> };

async function requireEditor() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user) return null;
  if (role !== "ADMIN" && role !== "CAPTURISTA") return null;
  return { session, role };
}

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;
  const reporte = await prisma.dailyReport.findUnique({
    where: { id },
    include: {
      consultas: { include: { especialidad: { select: { nombre: true, honorarioClinica: true } } } },
      servicios: { include: { unidadServicio: { select: { nombre: true, categoria: true } } } },
      pacientesArea: true,
      anticipos: true,
      cuentasPorCobrar: true,
      aps: true,
      creadoPor: { select: { name: true, email: true } },
    },
  });

  if (!reporte) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ reporte });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const editor = await requireEditor();
  if (!editor) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { session, role } = editor;

  const { id } = await ctx.params;
  const reporte = await prisma.dailyReport.findUnique({ where: { id } });
  if (!reporte) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (reporte.estado === "CERRADO" && role !== "ADMIN") {
    return NextResponse.json({ error: "Solo el administrador puede editar un reporte cerrado" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = reporteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos inválidos" }, { status: 400 });
  }

  const { fecha, tasaCambio, observaciones, estado, consultas, servicios, pacientesArea, anticipos, cuentasPorCobrar, aps } = parsed.data;
  const userId = (session.user as { id: string }).id;

  // Reemplazar todas las líneas (delete + create en transacción)
  await prisma.$transaction([
    prisma.consultaLinea.deleteMany({ where: { reporteId: id } }),
    prisma.servicioLinea.deleteMany({ where: { reporteId: id } }),
    prisma.pacienteArea.deleteMany({ where: { reporteId: id } }),
    prisma.anticipo.deleteMany({ where: { reporteId: id } }),
    prisma.cuentaPorCobrar.deleteMany({ where: { reporteId: id } }),
    prisma.aPS.deleteMany({ where: { reporteId: id } }),
  ]);

  const updated = await prisma.dailyReport.update({
    where: { id },
    data: {
      fecha: new Date(fecha + "T12:00:00.000Z"),
      tasaCambio,
      observaciones,
      estado,
      cerradoAt: estado === "CERRADO" ? new Date() : null,
      editadoPorId: userId,
      consultas: { create: consultas.filter(c => c.numPacientes > 0 || c.totalBs > 0 || c.ingresoDivisa > 0) },
      servicios: { create: servicios.filter(s => s.numPacientes > 0 || s.totalBs > 0 || s.ingresoDivisa > 0) },
      pacientesArea: { create: pacientesArea.filter(p => p.numPacientes > 0) },
      anticipos: { create: anticipos },
      cuentasPorCobrar: { create: cuentasPorCobrar },
      ...(aps ? { aps: { create: aps } } : {}),
    },
  });

  return NextResponse.json({ reporte: updated });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (role !== "ADMIN")
    return NextResponse.json(
      { error: "Solo el administrador puede eliminar reportes" },
      { status: 403 }
    );

  const { id } = await ctx.params;
  const reporte = await prisma.dailyReport.findUnique({ where: { id } });
  if (!reporte)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Cascade en el schema (consultas, servicios, anticipos, cuentas, pacientesArea, APS)
  // se encarga de borrar las filas hijas automáticamente.
  await prisma.dailyReport.delete({ where: { id } });

  return NextResponse.json({ ok: true, fecha: reporte.fecha });
}
