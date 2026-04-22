import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

async function requireAdmin() {
  const session = await auth();
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN" ? session : null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const [especialidades, aseguradoras] = await Promise.all([
    prisma.especialidad.findMany({ orderBy: { orden: "asc" } }),
    prisma.aseguradora.findMany({ orderBy: { nombre: "asc" } }),
  ]);
  return NextResponse.json({ especialidades, aseguradoras });
}

const especialidadSchema = z.object({
  id: z.string(),
  honorarioClinica: z.number().min(0),
  modeloNegocio: z.string().trim().min(1),
  activa: z.boolean(),
});

export async function PATCH(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = especialidadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const { id, honorarioClinica, modeloNegocio, activa } = parsed.data;
  const updated = await prisma.especialidad.update({
    where: { id },
    data: { honorarioClinica, modeloNegocio, activa },
  });
  return NextResponse.json({ especialidad: updated });
}
