import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const aseguradoras = await prisma.aseguradora.findMany({
    where: { activa: true },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  });
  return NextResponse.json({ aseguradoras });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = z.object({ nombre: z.string().trim().min(2) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });

  const aseguradora = await prisma.aseguradora.upsert({
    where: { nombre: parsed.data.nombre },
    update: { activa: true },
    create: { nombre: parsed.data.nombre },
    select: { id: true, nombre: true },
  });
  return NextResponse.json({ aseguradora });
}
