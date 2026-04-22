import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canEditReports } from "@/lib/roles";
import { ReporteForm } from "./reporte-form";

export const dynamic = "force-dynamic";

export default async function NuevoReportePage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!canEditReports(role)) redirect("/");

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

  return (
    <ReporteForm
      especialidades={especialidades}
      unidades={unidades}
    />
  );
}
