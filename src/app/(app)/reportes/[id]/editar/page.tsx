import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { canEditReports, isAdmin } from "@/lib/roles";
import { EditarReporteForm } from "./editar-form";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function EditarReportePage({ params }: Params) {
  const { id } = await params;
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!canEditReports(role)) redirect("/");

  const [especialidades, unidades, reporte] = await Promise.all([
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
    prisma.dailyReport.findUnique({
      where: { id },
      include: {
        consultas: true,
        servicios: true,
        pacientesArea: true,
        anticipos: true,
        cuentasPorCobrar: true,
        aps: true,
      },
    }),
  ]);

  if (!reporte) notFound();
  if (reporte.estado === "CERRADO" && !isAdmin(role)) redirect(`/reportes/${id}`);

  // Map consultas/servicios back to full rows aligned with catalogs
  const consultasInit = especialidades.map(esp => {
    const s = reporte.consultas.find(c => c.especialidadId === esp.id);
    return {
      especialidadId: esp.id,
      numPacientes: s?.numPacientes ?? 0,
      totalBs: s?.totalBs ?? 0,
      ingresoDivisa: s?.ingresoDivisa ?? 0,
      porcentajeClinica: s?.porcentajeClinica ?? 0,
    };
  });

  const serviciosInit = unidades.map(uni => {
    const s = reporte.servicios.find(sv => sv.unidadServicioId === uni.id);
    return {
      unidadServicioId: uni.id,
      numPacientes: s?.numPacientes ?? 0,
      totalBs: s?.totalBs ?? 0,
      ingresoDivisa: s?.ingresoDivisa ?? 0,
      porcentajeClinica: 0,
    };
  });

  const pacientesAreaInit = (["EMERGENCIA", "HOSPITALIZACION", "UCI"] as const).map(area => {
    const p = reporte.pacientesArea.find(x => x.area === area);
    return { area, numPacientes: p?.numPacientes ?? 0 };
  });

  const anticiposInit = reporte.anticipos.map(a => ({
    tipo: a.tipo as "HOSPITALIZACION" | "EMERGENCIA" | "ESTUDIOS",
    totalBs: a.totalBs,
    ingresoDivisa: a.ingresoDivisa,
    numPacientes: a.numPacientes,
    pacienteNombre: a.pacienteNombre ?? "",
    estado: a.estado as "PENDIENTE" | "APLICADO",
    aseguradoraId: a.aseguradoraId ?? "",
    _nuevaAseg: "",
  }));

  const cuentasInit = reporte.cuentasPorCobrar.map(c => ({
    nombreConvenio: c.nombreConvenio,
    totalBs: c.totalBs,
    ingresoDivisa: c.ingresoDivisa,
    numPacientes: c.numPacientes,
    comentarios: c.comentarios ?? "",
    aseguradoraId: c.aseguradoraId ?? "",
    _nuevaAseg: "",
  }));

  const apsInit = reporte.aps
    ? {
        consultas: reporte.aps.consultas,
        laboratoriosImagenes: reporte.aps.laboratoriosImagenes,
        movimientosDia: reporte.aps.movimientosDia,
        totalFacturados: reporte.aps.totalFacturados,
        noFacturadosComentarios: reporte.aps.noFacturadosComentarios ?? "",
        facturadosComentarios: reporte.aps.facturadosComentarios ?? "",
      }
    : { consultas: 0, laboratoriosImagenes: 0, movimientosDia: 0, totalFacturados: 0, noFacturadosComentarios: "", facturadosComentarios: "" };

  const fechaStr = reporte.fecha.toISOString().split("T")[0];

  return (
    <EditarReporteForm
      id={id}
      especialidades={especialidades}
      unidades={unidades}
      initialFecha={fechaStr}
      initialTasa={reporte.tasaCambio}
      initialObservaciones={reporte.observaciones ?? ""}
      initialEstado={reporte.estado as "BORRADOR" | "CERRADO"}
      initialConsultas={consultasInit}
      initialServicios={serviciosInit}
      initialPacientesArea={pacientesAreaInit}
      initialAnticipos={anticiposInit}
      initialCuentas={cuentasInit}
      initialAps={apsInit}
      isAdmin={isAdmin(role)}
    />
  );
}
