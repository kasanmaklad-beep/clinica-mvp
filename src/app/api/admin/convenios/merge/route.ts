import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";
import { z } from "zod";

/**
 * POST /api/admin/convenios/merge
 * Body: { canonico: string, variantes: string[] }
 *
 * Renombra todas las filas de CuentaPorCobrar cuyo nombreConvenio esté en
 * `variantes` para que use `canonico`. Transaccional.
 *
 * Solo ADMIN.
 */
export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isAdmin(role)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = z
    .object({
      canonico: z.string().trim().min(1),
      variantes: z.array(z.string().trim().min(1)).min(1),
    })
    .safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { canonico, variantes } = parsed.data;
  // Evitar que incluyan el canónico en la lista de variantes (no-op)
  const aRenombrar = variantes.filter((v) => v !== canonico);

  if (aRenombrar.length === 0) {
    return NextResponse.json({ actualizadas: 0, canonico });
  }

  const res = await prisma.cuentaPorCobrar.updateMany({
    where: { nombreConvenio: { in: aRenombrar } },
    data: { nombreConvenio: canonico },
  });

  return NextResponse.json({ actualizadas: res.count, canonico });
}
