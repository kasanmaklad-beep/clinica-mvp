import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const [especialidades, unidades] = await Promise.all([
    prisma.especialidad.findMany({
      where: { activa: true },
      orderBy: { orden: "asc" },
      select: { id: true, codigo: true, nombre: true, honorarioClinica: true },
    }),
    prisma.unidadServicio.findMany({
      where: { activa: true },
      orderBy: { orden: "asc" },
      select: { id: true, codigo: true, nombre: true },
    }),
  ]);

  return NextResponse.json({ especialidades, unidades });
}
