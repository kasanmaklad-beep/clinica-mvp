import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

async function requireAdmin() {
  const session = await auth();
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN" ? session : null;
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = z.object({
    nombre: z.string().trim().min(2),
    categoria: z.enum(["LABORATORIO", "IMAGENES", "SERVICIO"]).default("LABORATORIO"),
  }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  // Assign next available codigo and orden
  const last = await prisma.unidadServicio.findFirst({ orderBy: { codigo: "desc" } });
  const nextCodigo = (last?.codigo ?? 0) + 1;
  const nextOrden = (last?.orden ?? 0) + 1;

  const unidad = await prisma.unidadServicio.create({
    data: { nombre: parsed.data.nombre, categoria: parsed.data.categoria, codigo: nextCodigo, orden: nextOrden },
  });
  return NextResponse.json({ unidad });
}

export async function PATCH(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = z.object({ id: z.string(), activa: z.boolean() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const unidad = await prisma.unidadServicio.update({
    where: { id: parsed.data.id },
    data: { activa: parsed.data.activa },
  });
  return NextResponse.json({ unidad });
}
