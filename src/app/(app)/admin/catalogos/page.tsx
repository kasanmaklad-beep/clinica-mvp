import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/roles";
import { CatalogosClient } from "./catalogos-client";

export const dynamic = "force-dynamic";

export default async function CatalogosPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isAdmin(role)) redirect("/");
  const [especialidades, unidades, aseguradoras] = await Promise.all([
    prisma.especialidad.findMany({ orderBy: { orden: "asc" } }),
    prisma.unidadServicio.findMany({ orderBy: { orden: "asc" } }),
    prisma.aseguradora.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  const serialized = {
    especialidades: especialidades.map((e) => ({ ...e })),
    unidades: unidades.map((u) => ({ ...u })),
    aseguradoras: aseguradoras.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
  };

  return <CatalogosClient data={serialized} />;
}
