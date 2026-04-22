import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditReports } from "@/lib/roles";
import { DashboardClient, ReporteDashboard, DayData, MonthData, TopEspecialidad } from "./dashboard-client";

export const dynamic = "force-dynamic";

async function cargarReporte(id: string): Promise<ReporteDashboard | null> {
  const r = await prisma.dailyReport.findUnique({
    where: { id },
    include: {
      consultas: { include: { especialidad: { select: { nombre: true } } }, orderBy: { especialidad: { orden: "asc" } } },
      servicios: { include: { unidadServicio: { select: { nombre: true, categoria: true } } }, orderBy: { unidadServicio: { orden: "asc" } } },
      pacientesArea: true,
      anticipos: true,
      cuentasPorCobrar: true,
      aps: true,
      creadoPor: { select: { name: true } },
    },
  });
  if (!r) return null;
  return {
    id: r.id,
    fecha: r.fecha.toISOString(),
    tasaCambio: r.tasaCambio,
    estado: r.estado,
    observaciones: r.observaciones,
    creadoPor: r.creadoPor?.name ?? "—",
    consultas: r.consultas
      .filter(c => c.numPacientes > 0 || c.totalBs > 0 || c.ingresoDivisa > 0)
      .map(c => ({ especialidad: c.especialidad.nombre, numPacientes: c.numPacientes, totalBs: c.totalBs, ingresoDivisa: c.ingresoDivisa, porcentajeClinica: c.porcentajeClinica })),
    servicios: r.servicios
      .filter(s => s.numPacientes > 0 || s.totalBs > 0 || s.ingresoDivisa > 0)
      .map(s => ({ unidad: s.unidadServicio.nombre, categoria: s.unidadServicio.categoria, numPacientes: s.numPacientes, totalBs: s.totalBs, ingresoDivisa: s.ingresoDivisa })),
    pacientesArea: r.pacientesArea.map(p => ({ area: p.area, numPacientes: p.numPacientes })),
    anticipos: r.anticipos.map(a => ({ tipo: a.tipo, pacienteNombre: a.pacienteNombre ?? "", totalBs: a.totalBs, ingresoDivisa: a.ingresoDivisa, estado: a.estado })),
    cuentasPorCobrar: r.cuentasPorCobrar.map(c => ({ id: c.id, nombreConvenio: c.nombreConvenio, totalBs: c.totalBs, ingresoDivisa: c.ingresoDivisa, numPacientes: c.numPacientes, comentarios: c.comentarios })),
    aps: r.aps ? { consultas: r.aps.consultas, laboratoriosImagenes: r.aps.laboratoriosImagenes, movimientosDia: r.aps.movimientosDia, totalFacturados: r.aps.totalFacturados } : null,
  };
}

function monthKey(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default async function DashboardPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  const [reportesLista, allReports] = await Promise.all([
    prisma.dailyReport.findMany({
      orderBy: { fecha: "desc" },
      select: { id: true, fecha: true, estado: true },
    }),
    prisma.dailyReport.findMany({
      orderBy: { fecha: "desc" },
      select: {
        fecha: true,
        tasaCambio: true,
        consultas: {
          select: {
            totalBs: true, ingresoDivisa: true, numPacientes: true,
            porcentajeClinica: true,
            especialidad: { select: { nombre: true } },
          },
        },
        servicios: {
          select: {
            totalBs: true, ingresoDivisa: true, numPacientes: true,
            porcentajeClinica: true,
            unidadServicio: { select: { categoria: true } },
          },
        },
        anticipos: { select: { totalBs: true, ingresoDivisa: true } },
        cuentasPorCobrar: { select: { totalBs: true, ingresoDivisa: true, numPacientes: true } },
      },
    }),
  ]);

  // Per-day data (last 60 days for day bar chart)
  const chartData: DayData[] = allReports
    .slice(0, 60)
    .map(r => {
      const dayTasa = r.tasaCambio || 1;
      const lineas = [...r.consultas, ...r.servicios];
      return {
        fecha: r.fecha.toISOString().slice(0, 10),
        totalBs:
          lineas.reduce((s, x) => s + x.totalBs, 0) +
          r.anticipos.reduce((s, a) => s + a.totalBs, 0) +
          r.cuentasPorCobrar.reduce((s, c) => s + c.totalBs, 0),
        totalDiv:
          lineas.reduce((s, x) => s + x.totalBs / dayTasa, 0) +
          r.anticipos.reduce((s, a) => s + a.totalBs / dayTasa, 0) +
          r.cuentasPorCobrar.reduce((s, c) => s + c.totalBs / dayTasa, 0),
        pacientes:
          lineas.reduce((s, x) => s + x.numPacientes, 0) +
          r.cuentasPorCobrar.reduce((s, c) => s + c.numPacientes, 0),
      };
    })
    .reverse();

  // ─── Monthly aggregation (all months, all areas) ───────────────────────────
  const monthMap = new Map<string, MonthData>();
  for (const r of allReports) {
    const mk  = monthKey(r.fecha);
    const tasa = r.tasaCambio || 1;

    const labRows = r.servicios.filter(s => s.unidadServicio.categoria !== "IMAGENES");
    const imgRows = r.servicios.filter(s => s.unidadServicio.categoria === "IMAGENES");

    // Consultas
    const consBs         = r.consultas.reduce((s, x) => s + x.totalBs, 0);
    const consPac        = r.consultas.reduce((s, x) => s + x.numPacientes, 0);
    const consClinicaUsd = r.consultas.reduce((s, x) => s + x.porcentajeClinica, 0);
    const consClinicaBs  = consClinicaUsd * tasa;

    // Lab / Imágenes
    const labBs  = labRows.reduce((s, x) => s + x.totalBs, 0);
    const labUsd = labBs / tasa;
    const labPac = labRows.reduce((s, x) => s + x.numPacientes, 0);
    const imgBs  = imgRows.reduce((s, x) => s + x.totalBs, 0);
    const imgUsd = imgBs / tasa;
    const imgPac = imgRows.reduce((s, x) => s + x.numPacientes, 0);

    // Anticipos / Convenios
    const antBs  = r.anticipos.reduce((s, a) => s + a.totalBs, 0);
    const antUsd = antBs / tasa;
    const cueBs  = r.cuentasPorCobrar.reduce((s, c) => s + c.totalBs, 0);
    const cueUsd = cueBs / tasa;
    const cuePac = r.cuentasPorCobrar.reduce((s, c) => s + c.numPacientes, 0);

    const dayClinicaUsd = consClinicaUsd + labUsd + imgUsd + antUsd + cueUsd;
    const dayClinicaBs  = consClinicaBs  + labBs  + imgBs  + antBs  + cueBs;

    const existing = monthMap.get(mk) ?? {
      mes: mk,
      totalBs: 0, totalDiv: 0, pacientes: 0, dias: 0,
      clinicaUsd: 0, clinicaBs: 0,
      consultasBs: 0, consultasDiv: 0,
      labBs: 0, labDiv: 0,
      imgBs: 0, imgDiv: 0,
      anticiposBs: 0, anticiposDiv: 0,
      cuentasBs: 0, cuentasDiv: 0,
      pacConsultas: 0, pacLab: 0, pacImg: 0, pacCue: 0,
    };

    existing.totalBs    += consBs + labBs + imgBs + antBs + cueBs;
    existing.totalDiv   += consClinicaUsd + labUsd + imgUsd + antUsd + cueUsd;
    existing.pacientes  += consPac + labPac + imgPac + cuePac;
    existing.dias       += 1;
    existing.clinicaUsd += dayClinicaUsd;
    existing.clinicaBs  += dayClinicaBs;
    existing.consultasBs  += consBs;
    existing.consultasDiv += consClinicaUsd;
    existing.labBs  += labBs;
    existing.labDiv += labUsd;
    existing.imgBs  += imgBs;
    existing.imgDiv += imgUsd;
    existing.anticiposBs  += antBs;
    existing.anticiposDiv += antUsd;
    existing.cuentasBs  += cueBs;
    existing.cuentasDiv += cueUsd;
    existing.pacConsultas += consPac;
    existing.pacLab       += labPac;
    existing.pacImg       += imgPac;
    existing.pacCue       += cuePac;
    monthMap.set(mk, existing);
  }

  const monthsAll = Array.from(monthMap.values()).sort((a, b) => a.mes.localeCompare(b.mes));
  const months    = monthsAll.slice(-13);

  // ─── Top 5 specialties for ALL months (with pctChange vs previous) ─────────
  const monthEspMap = new Map<string, Map<string, { clinica: number; pac: number }>>();
  for (const r of allReports) {
    const mk = monthKey(r.fecha);
    if (!monthEspMap.has(mk)) monthEspMap.set(mk, new Map());
    const espMap = monthEspMap.get(mk)!;
    for (const c of r.consultas) {
      const nombre = c.especialidad.nombre;
      const e = espMap.get(nombre) ?? { clinica: 0, pac: 0 };
      e.clinica += c.porcentajeClinica;
      e.pac     += c.numPacientes;
      espMap.set(nombre, e);
    }
  }

  const allTopEspecialidades: Record<string, TopEspecialidad[]> = {};
  for (let i = 0; i < monthsAll.length; i++) {
    const mk     = monthsAll[i].mes;
    const prevMk = i > 0 ? monthsAll[i - 1].mes : null;
    const espMap     = monthEspMap.get(mk)     ?? new Map();
    const prevEspMap = prevMk ? (monthEspMap.get(prevMk) ?? new Map()) : null;
    allTopEspecialidades[mk] = Array.from(espMap.entries())
      .map(([nombre, v]) => {
        const p = prevEspMap?.get(nombre);
        const pctChange = p && p.clinica > 0 ? ((v.clinica - p.clinica) / p.clinica) * 100 : null;
        return { nombre, clinicaUsd: v.clinica, pacientes: v.pac, pctChange };
      })
      .sort((a, b) => b.clinicaUsd - a.clinicaUsd)
      .slice(0, 5);
  }

  const initialReporte = reportesLista.length > 0 ? await cargarReporte(reportesLista[0].id) : null;

  return (
    <DashboardClient
      reportesLista={reportesLista.map(r => ({ id: r.id, fecha: r.fecha.toISOString(), estado: r.estado }))}
      initialReporte={initialReporte}
      canCreate={canEditReports(role)}
      chartData={chartData}
      months={months}
      allTopEspecialidades={allTopEspecialidades}
    />
  );
}
