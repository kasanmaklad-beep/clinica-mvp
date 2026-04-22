import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const updated = await prisma.aseguradora.update({
    where: { id },
    data: { activa: body.activa },
    select: { id: true, nombre: true, activa: true },
  });
  return NextResponse.json({ aseguradora: updated });
}
