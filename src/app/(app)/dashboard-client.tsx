"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtUsd, fmtBs, fmtInt } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import {
  ChevronLeft, ChevronRight, ClipboardList, Users, DollarSign, Percent,
  ChevronDown, Stethoscope, FlaskConical, HandCoins, Activity, BedDouble, FileText,
  TrendingUp, TrendingDown, Minus, Sparkles, Trophy, Calendar, FileDown,
} from "lucide-react";

export interface DayData {
  fecha: string; // YYYY-MM-DD
  totalBs: number;
  totalDiv: number;
  pacientes: number;
}

export interface MonthData {
  mes: string; // YYYY-MM
  totalBs: number;
  totalDiv: number;
  pacientes: number;
  dias: number;
  clinicaUsd: number; // sum of porcentajeClinica (clinic's actual income in USD)
  clinicaBs: number;  // clinicaUsd converted at each day's rate, summed
  consultasBs: number;
  consultasDiv: number;
  labBs: number;
  labDiv: number;
  imgBs: number;
  imgDiv: number;
  anticiposBs: number;
  anticiposDiv: number;
  cuentasBs: number;
  cuentasDiv: number;
  // Per-area patient counts (for area breakdown on any month)
  pacConsultas: number;
  pacLab: number;
  pacImg: number;
  pacCue: number;
}

export interface AreaBreakdown {
  area: string;
  clinicaUsd: number;
  clinicaBs: number;
  pacientes: number;
  pct: number;
}

export interface TopEspecialidad {
  nombre: string;
  clinicaUsd: number;
  pacientes: number;
  pctChange: number | null;
}

export interface ReporteDashboard {
  id: string;
  fecha: string;
  tasaCambio: number;
  estado: string;
  observaciones: string | null;
  creadoPor: string;
  consultas: { especialidad: string; numPacientes: number; totalBs: number; ingresoDivisa: number; porcentajeClinica: number }[];
  servicios: { unidad: string; categoria: string; numPacientes: number; totalBs: number; ingresoDivisa: number }[];
  pacientesArea: { area: string; numPacientes: number }[];
  anticipos: { tipo: string; pacienteNombre: string; totalBs: number; ingresoDivisa: number; estado: string }[];
  cuentasPorCobrar: { id: string; nombreConvenio: string; totalBs: number; ingresoDivisa: number; numPacientes: number; comentarios: string | null }[];
  aps: { consultas: number; laboratoriosImagenes: number; movimientosDia: number; totalFacturados: number } | null;
}

interface ReporteItem { id: string; fecha: string; estado: string }

interface Props {
  reportesLista: ReporteItem[];
  initialReporte: ReporteDashboard | null;
  canCreate: boolean;
  chartData: DayData[];
  months: MonthData[];
  allTopEspecialidades: Record<string, TopEspecialidad[]>;
}

export function DashboardClient({ reportesLista, initialReporte, canCreate, chartData, months, allTopEspecialidades }: Props) {
  const [idx, setIdx] = useState(0);
  const [reporte, setReporte] = useState<ReporteDashboard | null>(initialReporte);
  const [loading, setLoading] = useState(false);

  async function navegar(nuevoIdx: number) {
    if (nuevoIdx < 0 || nuevoIdx >= reportesLista.length) return;
    setIdx(nuevoIdx);
    setLoading(true);
    const res = await fetch(`/api/reportes/${reportesLista[nuevoIdx].id}`);
    if (res.ok) {
      const data = await res.json();
      const r = data.reporte;
      setReporte({
        id: r.id,
        fecha: r.fecha,
        tasaCambio: r.tasaCambio,
        estado: r.estado,
        observaciones: r.observaciones,
        creadoPor: r.creadoPor?.name ?? "—",
        consultas: (r.consultas || [])
          .filter((c: { numPacientes: number; totalBs: number; ingresoDivisa: number }) => c.numPacientes > 0 || c.totalBs > 0 || c.ingresoDivisa > 0)
          .map((c: { especialidad: { nombre: string }; numPacientes: number; totalBs: number; ingresoDivisa: number; porcentajeClinica: number }) => ({ especialidad: c.especialidad.nombre, numPacientes: c.numPacientes, totalBs: c.totalBs, ingresoDivisa: c.ingresoDivisa, porcentajeClinica: c.porcentajeClinica })),
        servicios: (r.servicios || [])
          .filter((s: { numPacientes: number; totalBs: number; ingresoDivisa: number }) => s.numPacientes > 0 || s.totalBs > 0 || s.ingresoDivisa > 0)
          .map((s: { unidadServicio: { nombre: string; categoria: string }; numPacientes: number; totalBs: number; ingresoDivisa: number }) => ({ unidad: s.unidadServicio.nombre, categoria: s.unidadServicio.categoria, numPacientes: s.numPacientes, totalBs: s.totalBs, ingresoDivisa: s.ingresoDivisa })),
        pacientesArea: (r.pacientesArea || []).map((p: { area: string; numPacientes: number }) => ({ area: p.area, numPacientes: p.numPacientes })),
        anticipos: (r.anticipos || []).map((a: { tipo: string; pacienteNombre: string | null; totalBs: number; ingresoDivisa: number; estado: string }) => ({ tipo: a.tipo, pacienteNombre: a.pacienteNombre ?? "", totalBs: a.totalBs, ingresoDivisa: a.ingresoDivisa, estado: a.estado })),
        cuentasPorCobrar: (r.cuentasPorCobrar || []).map((c: { id: string; nombreConvenio: string; totalBs: number; ingresoDivisa: number; numPacientes: number; comentarios: string | null }) => ({ id: c.id, nombreConvenio: c.nombreConvenio, totalBs: c.totalBs, ingresoDivisa: c.ingresoDivisa, numPacientes: c.numPacientes, comentarios: c.comentarios })),
        aps: r.aps ? { consultas: r.aps.consultas, laboratoriosImagenes: r.aps.laboratoriosImagenes, movimientosDia: r.aps.movimientosDia, totalFacturados: r.aps.totalFacturados } : null,
      });
    }
    setLoading(false);
  }

  if (reportesLista.length === 0 || !reporte) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <Card>
          <CardContent className="py-12 flex flex-col items-center text-center space-y-4">
            <ClipboardList className="h-12 w-12 text-[var(--muted-foreground)]" />
            <div>
              <div className="font-semibold">No hay reportes aún</div>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">Cuando captures tu primer reporte, aparecerá aquí.</p>
            </div>
            {canCreate && (
              <Button asChild>
                <Link href="/reportes/nuevo">Crear primer reporte</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Totales
  const tasa = reporte.tasaCambio || 1;
  const bsToUsd = (bs: number) => bs / tasa;

  const totConsBs = reporte.consultas.reduce((s, c) => s + c.totalBs, 0);
  const totConsDiv = reporte.consultas.reduce((s, c) => s + c.ingresoDivisa, 0);
  const totConsPac = reporte.consultas.reduce((s, c) => s + c.numPacientes, 0);
  const totClinica = reporte.consultas.reduce((s, c) => s + c.porcentajeClinica, 0);

  // Split Lab vs Imágenes
  const laboratorio = reporte.servicios.filter(s => s.categoria === "LABORATORIO" || s.categoria === "SERVICIO" || (!s.categoria));
  const imagenes = reporte.servicios.filter(s => s.categoria === "IMAGENES");

  const totLabBs = laboratorio.reduce((s, c) => s + c.totalBs, 0);
  const totLabDiv = laboratorio.reduce((s, c) => s + c.ingresoDivisa, 0);
  const totLabPac = laboratorio.reduce((s, c) => s + c.numPacientes, 0);
  const totImgBs = imagenes.reduce((s, c) => s + c.totalBs, 0);
  const totImgDiv = imagenes.reduce((s, c) => s + c.ingresoDivisa, 0);
  const totImgPac = imagenes.reduce((s, c) => s + c.numPacientes, 0);

  const totServBs = totLabBs + totImgBs;
  const totServDiv = totLabDiv + totImgDiv;
  const totServPac = totLabPac + totImgPac;

  const totAntBs = reporte.anticipos.reduce((s, a) => s + a.totalBs, 0);
  const totAntDiv = reporte.anticipos.reduce((s, a) => s + a.ingresoDivisa, 0);
  const totCuentasBs = reporte.cuentasPorCobrar.reduce((s, c) => s + c.totalBs, 0);
  const totCuentasDiv = reporte.cuentasPorCobrar.reduce((s, c) => s + c.ingresoDivisa, 0);
  const totCuentasPac = reporte.cuentasPorCobrar.reduce((s, c) => s + c.numPacientes, 0);
  const totalBs = totConsBs + totServBs + totAntBs + totCuentasBs;
  const totalDivisa = totConsDiv + totServDiv + totAntDiv + totCuentasDiv;
  const totalPac = totConsPac + totServPac + totCuentasPac;
  const totPacArea = reporte.pacientesArea.reduce((s, p) => s + p.numPacientes, 0);

  const haySiguiente = idx > 0;
  const hayAnterior = idx < reportesLista.length - 1;

  return (
    <div className="space-y-6 pb-8">
      {/* ═════════ VISTA EJECUTIVA MENSUAL ═════════ */}
      {months.length > 0 && (
        <ExecutiveMonthly
          months={months}
          allTopEspecialidades={allTopEspecialidades}
        />
      )}

      {/* ═════════ DETALLE DIARIO ═════════ */}
      <div className="pt-2 border-t border-[var(--border)]">
        <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mt-4 mb-3">
          Detalle del día
        </div>
      </div>

      {/* Navegación fecha */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" disabled={!hayAnterior || loading} onClick={() => navegar(idx + 1)} aria-label="Día anterior">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 text-center">
          <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">Reporte del día</div>
          <h2 className="text-lg sm:text-2xl font-bold capitalize">
            {format(new Date(reporte.fecha), "EEEE d 'de' MMMM yyyy", { locale: es })}
          </h2>
          <div className="flex items-center justify-center gap-2 mt-1 text-xs text-[var(--muted-foreground)]">
            <Badge tone={reporte.estado === "CERRADO" ? "success" : "warning"}>
              {reporte.estado === "CERRADO" ? "Cerrado" : "Borrador"}
            </Badge>
            <span>Tasa: {reporte.tasaCambio} Bs/$</span>
            <span className="hidden sm:inline">· {reporte.creadoPor}</span>
          </div>
        </div>
        <Button variant="outline" size="icon" disabled={!haySiguiente || loading} onClick={() => navegar(idx - 1)} aria-label="Día siguiente">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* KPIs del día — % Clínica como métrica principal */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={Percent} label="% Clínica $" value={fmtUsd(totClinica)} accent="text-emerald-600" big />
        <KpiCard icon={DollarSign} label="% Clínica Bs." value={fmtBs(totClinica * tasa)} sub={`Tasa: ${tasa.toLocaleString()} Bs/$`} accent="text-amber-600" />
        <KpiCard icon={Users} label="Pacientes" value={fmtInt(totalPac)} accent="text-[var(--primary)]" />
        <KpiCard icon={DollarSign} label="Facturado $" value={fmtUsd(totalDivisa)} accent="text-[var(--muted-foreground)]" />
      </div>

      {/* Secciones plegables */}
      <CollapseSection
        icon={Stethoscope}
        color="bg-blue-500"
        title="Consultas"
        subtitle={`${fmtInt(totConsPac)} pac. · ${fmtBs(totConsBs)} ≈ ${fmtUsd(bsToUsd(totConsBs))}`}
        empty={reporte.consultas.length === 0}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--muted)] text-left">
              <tr>
                <th className="p-2.5 font-medium">Especialidad</th>
                <th className="p-2.5 font-medium text-right">Pac.</th>
                <th className="p-2.5 font-medium text-right">Bs.</th>
                <th className="p-2.5 font-medium text-right">≈ $</th>
                <th className="p-2.5 font-medium text-right">Div.</th>
                <th className="p-2.5 font-medium text-right">% Clín.</th>
              </tr>
            </thead>
            <tbody>
              {reporte.consultas.map((c, i) => (
                <tr key={i} className="border-t border-[var(--border)]">
                  <td className="p-2.5">{c.especialidad}</td>
                  <td className="p-2.5 text-right">{c.numPacientes}</td>
                  <td className="p-2.5 text-right text-xs">{fmtBs(c.totalBs)}</td>
                  <td className="p-2.5 text-right text-amber-600 font-medium">{fmtUsd(bsToUsd(c.totalBs))}</td>
                  <td className="p-2.5 text-right text-sky-600 text-xs">{c.ingresoDivisa > 0 ? fmtUsd(c.ingresoDivisa) : "—"}</td>
                  <td className="p-2.5 text-right text-emerald-600">{fmtUsd(c.porcentajeClinica)}</td>
                </tr>
              ))}
              <tr className="border-t-2 bg-[var(--muted)] font-semibold text-sm">
                <td className="p-2.5" colSpan={2}>Totales</td>
                <td className="p-2.5 text-right text-xs">{fmtBs(totConsBs)}</td>
                <td className="p-2.5 text-right text-amber-600">{fmtUsd(bsToUsd(totConsBs))}</td>
                <td className="p-2.5 text-right text-sky-600 text-xs">{totConsDiv > 0 ? fmtUsd(totConsDiv) : "—"}</td>
                <td className="p-2.5 text-right text-emerald-600">{fmtUsd(totClinica)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CollapseSection>

      <CollapseSection
        icon={FlaskConical}
        color="bg-emerald-500"
        title="Laboratorio"
        subtitle={laboratorio.length > 0 ? `${fmtInt(totLabPac)} pac. · ${fmtBs(totLabBs)} ≈ ${fmtUsd(bsToUsd(totLabBs))}` : "Sin registros"}
        empty={laboratorio.length === 0}
      >
        <ServicioTable rows={laboratorio} bsToUsd={bsToUsd} />
      </CollapseSection>

      <CollapseSection
        icon={Activity}
        color="bg-cyan-500"
        title="Imágenes"
        subtitle={imagenes.length > 0 ? `${fmtInt(totImgPac)} pac. · ${fmtBs(totImgBs)} ≈ ${fmtUsd(bsToUsd(totImgBs))}` : "Sin registros"}
        empty={imagenes.length === 0}
      >
        <ServicioTable rows={imagenes} bsToUsd={bsToUsd} />
      </CollapseSection>

      <CollapseSection
        icon={HandCoins}
        color="bg-orange-500"
        title="Anticipos"
        subtitle={reporte.anticipos.length > 0 ? `${reporte.anticipos.length} anticipos · ${fmtBs(totAntBs)} ≈ ${fmtUsd(bsToUsd(totAntBs))}` : "Sin anticipos"}
        empty={reporte.anticipos.length === 0}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--muted)] text-left">
              <tr>
                <th className="p-2.5 font-medium">Tipo</th>
                <th className="p-2.5 font-medium">Paciente</th>
                <th className="p-2.5 font-medium text-right">Bs.</th>
                <th className="p-2.5 font-medium text-right">≈ $</th>
                <th className="p-2.5 font-medium text-right">Div.</th>
              </tr>
            </thead>
            <tbody>
              {reporte.anticipos.map((a, i) => (
                <tr key={i} className="border-t border-[var(--border)]">
                  <td className="p-2.5 capitalize">{a.tipo.toLowerCase()}</td>
                  <td className="p-2.5">{a.pacienteNombre || "—"}</td>
                  <td className="p-2.5 text-right text-xs">{fmtBs(a.totalBs)}</td>
                  <td className="p-2.5 text-right text-amber-600 font-medium">{fmtUsd(bsToUsd(a.totalBs))}</td>
                  <td className="p-2.5 text-right text-sky-600 text-xs">{a.ingresoDivisa > 0 ? fmtUsd(a.ingresoDivisa) : "—"}</td>
                </tr>
              ))}
              <tr className="border-t-2 bg-[var(--muted)] font-semibold">
                <td className="p-2.5" colSpan={2}>Totales</td>
                <td className="p-2.5 text-right text-xs">{fmtBs(totAntBs)}</td>
                <td className="p-2.5 text-right text-amber-600">{fmtUsd(bsToUsd(totAntBs))}</td>
                <td className="p-2.5 text-right text-sky-600 text-xs">{totAntDiv > 0 ? fmtUsd(totAntDiv) : "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CollapseSection>

      <CollapseSection
        icon={HandCoins}
        color="bg-sky-600"
        title="Cuentas por Cobrar / Convenios"
        subtitle={reporte.cuentasPorCobrar.length > 0 ? `${reporte.cuentasPorCobrar.length} convenios · ${fmtBs(totCuentasBs)} ≈ ${fmtUsd(bsToUsd(totCuentasBs))}` : "Sin cuentas por cobrar"}
        empty={reporte.cuentasPorCobrar.length === 0}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--muted)] text-left">
              <tr>
                <th className="p-2.5 font-medium">Convenio</th>
                <th className="p-2.5 font-medium text-right">Bs.</th>
                <th className="p-2.5 font-medium text-right">≈ $</th>
                <th className="p-2.5 font-medium text-right">Div. $</th>
                <th className="p-2.5 font-medium text-right">Pac.</th>
              </tr>
            </thead>
            <tbody>
              {reporte.cuentasPorCobrar.map((c, i) => (
                <tr key={i} className="border-t border-[var(--border)]">
                  <td className="p-2.5">{c.nombreConvenio}</td>
                  <td className="p-2.5 text-right text-xs">{c.totalBs > 0 ? fmtBs(c.totalBs) : "—"}</td>
                  <td className="p-2.5 text-right text-amber-600 font-medium">{c.totalBs > 0 ? fmtUsd(bsToUsd(c.totalBs)) : "—"}</td>
                  <td className="p-2.5 text-right text-sky-600 text-xs">{c.ingresoDivisa > 0 ? fmtUsd(c.ingresoDivisa) : "—"}</td>
                  <td className="p-2.5 text-right">{c.numPacientes > 0 ? c.numPacientes : "—"}</td>
                </tr>
              ))}
              <tr className="border-t-2 bg-[var(--muted)] font-semibold">
                <td className="p-2.5">Totales</td>
                <td className="p-2.5 text-right text-xs">{fmtBs(totCuentasBs)}</td>
                <td className="p-2.5 text-right text-amber-600">{fmtUsd(bsToUsd(totCuentasBs))}</td>
                <td className="p-2.5 text-right text-sky-600 text-xs">{totCuentasDiv > 0 ? fmtUsd(totCuentasDiv) : "—"}</td>
                <td className="p-2.5 text-right">{totCuentasPac > 0 ? fmtInt(totCuentasPac) : "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CollapseSection>

      <CollapseSection
        icon={BedDouble}
        color="bg-amber-500"
        title="Pacientes por área"
        subtitle={`${fmtInt(totPacArea)} pacientes`}
        empty={totPacArea === 0}
      >
        <div className="grid grid-cols-3 gap-3">
          {reporte.pacientesArea.map((p) => (
            <div key={p.area} className="text-center rounded-lg bg-[var(--muted)] p-4">
              <div className="text-2xl font-bold">{p.numPacientes}</div>
              <div className="text-xs text-[var(--muted-foreground)] capitalize mt-1">{p.area.toLowerCase()}</div>
            </div>
          ))}
        </div>
      </CollapseSection>

      {reporte.aps && (
        <CollapseSection
          icon={Activity}
          color="bg-sky-500"
          title="Unidad de APS"
          subtitle={`${reporte.aps.consultas} consultas · ${reporte.aps.totalFacturados} facturados`}
          empty={false}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><div className="text-[var(--muted-foreground)] text-xs">Consultas</div><div className="font-bold text-lg">{reporte.aps.consultas}</div></div>
            <div><div className="text-[var(--muted-foreground)] text-xs">Lab / Imágenes</div><div className="font-bold text-lg">{reporte.aps.laboratoriosImagenes}</div></div>
            <div><div className="text-[var(--muted-foreground)] text-xs">Movimientos</div><div className="font-bold text-lg">{reporte.aps.movimientosDia}</div></div>
            <div><div className="text-[var(--muted-foreground)] text-xs">Facturados</div><div className="font-bold text-lg">{reporte.aps.totalFacturados}</div></div>
          </div>
        </CollapseSection>
      )}

      {/* Observaciones */}
      {reporte.observaciones && (
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-1">Observaciones</div>
            <p className="text-sm whitespace-pre-wrap">{reporte.observaciones}</p>
          </CardContent>
        </Card>
      )}

      {/* Enlace al reporte completo */}
      <div className="flex justify-center pt-2">
        <Button variant="outline" asChild>
          <Link href={`/reportes/${reporte.id}`}><FileText className="h-4 w-4" /> Ver reporte completo</Link>
        </Button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VISTA EJECUTIVA MENSUAL
// ══════════════════════════════════════════════════════════════

function pct(curr: number, prev: number) {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

function Trend({ curr, prev, size = "sm" }: { curr: number; prev: number; size?: "sm" | "lg" }) {
  const p = pct(curr, prev);
  if (p === null) return null;
  const up = p > 0;
  const flat = Math.abs(p) < 0.5;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const color = flat ? "text-[var(--muted-foreground)]" : up ? "text-emerald-600" : "text-red-500";
  const text = size === "lg" ? "text-sm" : "text-xs";
  const iconSize = size === "lg" ? "h-4 w-4" : "h-3 w-3";
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${text} ${color}`}>
      <Icon className={iconSize} />
      {flat ? "—" : `${up ? "+" : ""}${p.toFixed(0)}%`}
    </span>
  );
}

function fmtMonthLabel(mk: string, short = false) {
  const [y, m] = mk.split("-");
  return format(new Date(Number(y), Number(m) - 1, 1), short ? "MMM yy" : "MMMM yyyy", { locale: es });
}

const AREA_COLORS: Record<string, string> = {
  "Consultas":   "bg-blue-500",
  "Laboratorio": "bg-emerald-500",
  "Imágenes":    "bg-cyan-500",
  "Anticipos":   "bg-orange-500",
  "Convenios":   "bg-sky-600",
};

function ExecutiveMonthly({
  months, allTopEspecialidades,
}: {
  months: MonthData[];
  allTopEspecialidades: Record<string, TopEspecialidad[]>;
}) {
  const [selectedIdx, setSelectedIdx] = useState(months.length - 1);
  const [showExport, setShowExport] = useState(false);
  const [hastaFecha, setHastaFecha] = useState("");

  const safeIdx = Math.max(0, Math.min(selectedIdx, months.length - 1));

  const current  = months[safeIdx];
  const previous = safeIdx > 0 ? months[safeIdx - 1] : null;
  const last12   = months.slice(-12);
  const canGoPrev = safeIdx > 0;
  const canGoNext = safeIdx < months.length - 1;

  // ─── Area breakdown derived from selected month data ───────────────────────
  const totalAreaUsd = current.clinicaUsd || 1;
  const areaBreakdown: AreaBreakdown[] = [
    { area: "Consultas",   clinicaUsd: current.consultasDiv, clinicaBs: current.consultasBs, pacientes: current.pacConsultas, pct: (current.consultasDiv / totalAreaUsd) * 100 },
    { area: "Laboratorio", clinicaUsd: current.labDiv,       clinicaBs: current.labBs,       pacientes: current.pacLab,       pct: (current.labDiv       / totalAreaUsd) * 100 },
    { area: "Imágenes",    clinicaUsd: current.imgDiv,       clinicaBs: current.imgBs,       pacientes: current.pacImg,       pct: (current.imgDiv       / totalAreaUsd) * 100 },
    { area: "Anticipos",   clinicaUsd: current.anticiposDiv, clinicaBs: current.anticiposBs, pacientes: 0,                    pct: (current.anticiposDiv / totalAreaUsd) * 100 },
    { area: "Convenios",   clinicaUsd: current.cuentasDiv,   clinicaBs: current.cuentasBs,   pacientes: current.pacCue,       pct: (current.cuentasDiv   / totalAreaUsd) * 100 },
  ].filter(a => a.clinicaUsd > 0 || a.pacientes > 0);

  const topEspecialidades = allTopEspecialidades[current.mes] ?? [];

  // Bar chart — highlight selected month
  const trendData = last12.map(m => ({
    mes: fmtMonthLabel(m.mes, true),
    clinica: m.clinicaUsd,
    pac: m.pacientes,
    selected: m.mes === current.mes,
  }));

  const today = new Date();
  const [curY, curM] = current.mes.split("-").map(Number);
  const isCurrentLive = today.getUTCFullYear() === curY && today.getUTCMonth() + 1 === curM;

  // Export date range
  const minHasta   = `${curY}-${String(curM).padStart(2, "0")}-01`;
  const lastDay    = new Date(Date.UTC(curY, curM, 0)).toISOString().slice(0, 10);
  const maxHasta   = isCurrentLive ? today.toISOString().slice(0, 10) : lastDay;
  const defaultHasta = maxHasta;
  // activeHasta: reset to default whenever the selected month changes
  const activeHasta = hastaFecha.startsWith(current.mes) ? hastaFecha : defaultHasta;

  function navigate(delta: number) {
    setSelectedIdx(i => i + delta);
    setShowExport(false);
    setHastaFecha("");
  }

  function handleExport() {
    const params = new URLSearchParams({ mes: current.mes, hasta: activeHasta });
    window.location.href = `/api/exportar/mensual?${params}`;
  }

  // Insights
  const insights: { text: string; kind: "up" | "down" | "info" | "star" }[] = [];

  if (previous) {
    const diff = pct(current.clinicaUsd, previous.clinicaUsd);
    if (diff !== null && Math.abs(diff) >= 1) {
      insights.push({
        kind: diff > 0 ? "up" : "down",
        text: `Ingreso clínica ${diff > 0 ? "creció" : "cayó"} ${Math.abs(diff).toFixed(1)}% vs ${fmtMonthLabel(previous.mes)} (${fmtUsd(previous.clinicaUsd)} → ${fmtUsd(current.clinicaUsd)}).`,
      });
    }
    const pacDiff = pct(current.pacientes, previous.pacientes);
    if (pacDiff !== null && Math.abs(pacDiff) >= 1) {
      insights.push({
        kind: pacDiff > 0 ? "up" : "down",
        text: `Pacientes atendidos ${pacDiff > 0 ? "aumentaron" : "disminuyeron"} ${Math.abs(pacDiff).toFixed(0)}% (${fmtInt(previous.pacientes)} → ${fmtInt(current.pacientes)}).`,
      });
    }
    const rppCurr = current.pacientes > 0 ? current.clinicaUsd / current.pacientes : 0;
    const rppPrev = previous.pacientes > 0 ? previous.clinicaUsd / previous.pacientes : 0;
    if (rppCurr > 0 && rppPrev > 0) {
      const rppDiff = pct(rppCurr, rppPrev);
      if (rppDiff !== null && Math.abs(rppDiff) >= 2) {
        insights.push({
          kind: rppDiff > 0 ? "up" : "down",
          text: `Ingreso clínica por paciente: ${fmtUsd(rppCurr)} (${rppDiff > 0 ? "+" : ""}${rppDiff.toFixed(0)}% vs mes anterior).`,
        });
      }
    }
  }

  const bestGrowth = topEspecialidades.find(e => e.pctChange !== null && e.pctChange >= 10);
  if (bestGrowth && bestGrowth.pctChange !== null) {
    insights.push({
      kind: "up",
      text: `${bestGrowth.nombre} aumentó ingresos clínica ${bestGrowth.pctChange.toFixed(0)}% vs mes pasado.`,
    });
  }

  if (isCurrentLive && current.dias >= 3) {
    const daysInMonth = new Date(curY, curM, 0).getDate();
    const projUsd = (current.clinicaUsd / current.dias) * daysInMonth;
    const projBs  = (current.clinicaBs  / current.dias) * daysInMonth;
    insights.push({
      kind: "info",
      text: `Proyección clínica a fin de mes: ${fmtUsd(projUsd)} · ${fmtBs(projBs)} (ritmo: ${current.dias} días reportados).`,
    });
  }

  const rppActual = current.pacientes > 0 ? current.clinicaUsd / current.pacientes : 0;

  return (
    <div className="space-y-4">

      {/* ─── Navegación de mes + Exportar ─── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="icon"
            disabled={!canGoPrev}
            onClick={() => navigate(-1)}
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 text-center">
            <div className="font-bold capitalize text-base">{fmtMonthLabel(current.mes)}</div>
            <div className="flex items-center justify-center gap-2 text-xs text-[var(--muted-foreground)]">
              {isCurrentLive
                ? <Badge tone="warning">En curso</Badge>
                : <span>{current.dias} días reportados</span>
              }
              {months.length > 1 && (
                <span className="opacity-50">· {safeIdx + 1} / {months.length}</span>
              )}
            </div>
          </div>
          <Button
            variant="outline" size="icon"
            disabled={!canGoNext}
            onClick={() => navigate(1)}
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => setShowExport(v => !v)}
            className="shrink-0"
          >
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline">Excel</span>
          </Button>
        </div>

        {/* Panel de exportación */}
        {showExport && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-2 text-sm">
            <span className="text-[var(--muted-foreground)] text-xs font-medium">Exportar hasta el:</span>
            <input
              type="date"
              value={activeHasta}
              min={minHasta}
              max={maxHasta}
              onChange={e => setHastaFecha(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] h-8"
            />
            <Button size="sm" onClick={handleExport}>
              <FileDown className="h-3.5 w-3.5" />
              Descargar Excel
            </Button>
            <span className="text-xs text-[var(--muted-foreground)] hidden sm:inline">
              · 2 hojas: Resumen + Detalle por día
            </span>
          </div>
        )}
      </div>

      {/* ─── HERO del mes: ingreso clínica ─── */}
      <Card className="bg-gradient-to-br from-emerald-500/10 via-amber-500/5 to-transparent border-emerald-500/20">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--muted-foreground)] font-semibold">
                <Calendar className="h-3.5 w-3.5" />
                <span className="capitalize">{fmtMonthLabel(current.mes)}</span>
              </div>
              <div className="mt-2 text-4xl sm:text-5xl font-black text-emerald-600 tracking-tight">
                {fmtUsd(current.clinicaUsd)}
              </div>
              <div className="text-xs text-[var(--muted-foreground)] mt-0.5 font-medium uppercase tracking-wide">
                Ingreso clínica (% honorarios)
              </div>
              <div className="mt-2 text-lg font-bold text-amber-600">
                {fmtBs(current.clinicaBs)}
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-[var(--muted-foreground)]">
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{fmtInt(current.pacientes)} pacientes</span>
                <span>·</span>
                <span>{current.dias} {current.dias === 1 ? "día" : "días"}</span>
                {rppActual > 0 && <><span>·</span><span className="text-emerald-600 font-medium">{fmtUsd(rppActual)}/pac.</span></>}
              </div>
            </div>
            {previous && (
              <div className="text-right">
                <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">vs mes anterior</div>
                <div className="mt-1"><Trend curr={current.clinicaUsd} prev={previous.clinicaUsd} size="lg" /></div>
                <div className="mt-2 text-xs text-[var(--muted-foreground)] capitalize">{fmtMonthLabel(previous.mes)}</div>
                <div className="text-sm font-semibold text-emerald-600">{fmtUsd(previous.clinicaUsd)}</div>
                <div className="text-xs text-[var(--muted-foreground)]">{fmtInt(previous.pacientes)} pac.</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Tendencia 12 meses ─── */}
      {trendData.length >= 2 && (
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-semibold text-sm">Evolución ingreso clínica · {trendData.length} meses</div>
                <div className="text-xs text-[var(--muted-foreground)]">% honorarios médicos en USD · barra resaltada = mes seleccionado</div>
              </div>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trendData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                       tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`} width={48} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v) => [fmtUsd(Number(v)), "% Clínica $"]}
                  cursor={{ fill: "var(--muted)" }}
                />
                <Bar dataKey="clinica" radius={[4, 4, 0, 0]} maxBarSize={36}>
                  {trendData.map((d, i) => (
                    <Cell key={i} fill={d.selected ? "#059669" : "var(--primary)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ─── Rendimiento por área ─── */}
      {areaBreakdown.length > 0 && (
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="font-semibold text-sm mb-1">Ingresos y rendimiento por área · {fmtMonthLabel(current.mes)}</div>
            <div className="text-xs text-[var(--muted-foreground)] mb-4">Consultas: % honorarios clínica · Lab/Imágenes/Anticipos/Convenios: facturación total</div>
            <div className="space-y-4">
              {areaBreakdown.map(a => {
                const color = AREA_COLORS[a.area] ?? "bg-gray-400";
                const rpp = a.pacientes > 0 ? a.clinicaUsd / a.pacientes : 0;
                return (
                  <div key={a.area}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`shrink-0 h-2.5 w-2.5 rounded-full ${color}`} />
                        <span className="font-medium text-sm truncate">{a.area}</span>
                        <span className="text-xs text-[var(--muted-foreground)] font-semibold shrink-0">{a.pct.toFixed(1)}%</span>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-emerald-600 text-sm">{fmtUsd(a.clinicaUsd)}</div>
                        <div className="text-xs text-amber-600">{fmtBs(a.clinicaBs)}</div>
                      </div>
                    </div>
                    <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                      <div className={`h-full ${color}`} style={{ width: `${Math.min(100, a.pct)}%` }} />
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-[var(--muted-foreground)]">
                      <span><Users className="inline h-3 w-3 mr-0.5" />{fmtInt(a.pacientes)} pac.</span>
                      {rpp > 0 && <span>· {fmtUsd(rpp)}/pac.</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Top 5 especialidades + Insights ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {topEspecialidades.length > 0 && (
          <Card>
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-4 w-4 text-emerald-600" />
                <div className="font-semibold text-sm">Top 5 especialidades</div>
                <span className="text-xs text-[var(--muted-foreground)]">por % clínica</span>
              </div>
              <div className="space-y-2">
                {topEspecialidades.map((e, i) => (
                  <div key={e.nombre} className="flex items-center gap-3 py-1.5 border-b last:border-0 border-[var(--border)]">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--muted)] text-xs font-bold text-[var(--muted-foreground)]">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{e.nombre}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">{fmtInt(e.pacientes)} pacientes</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-emerald-600">{fmtUsd(e.clinicaUsd)}</div>
                      {e.pctChange !== null && <Trend curr={100 + e.pctChange} prev={100} />}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {insights.length > 0 && (
          <Card>
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-violet-500" />
                <div className="font-semibold text-sm">Análisis automático</div>
              </div>
              <ul className="space-y-2.5">
                {insights.map((it, i) => {
                  const Icon = it.kind === "up" ? TrendingUp : it.kind === "down" ? TrendingDown : it.kind === "star" ? Trophy : Sparkles;
                  const color = it.kind === "up" ? "text-emerald-600" : it.kind === "down" ? "text-red-500" : it.kind === "star" ? "text-amber-500" : "text-violet-500";
                  return (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                      <span>{it.text}</span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, accent, big }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string; accent: string; big?: boolean }) {
  return (
    <Card className={big ? "ring-1 ring-amber-500/30 bg-amber-500/5" : undefined}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-[var(--muted-foreground)] font-medium">{label}</div>
          <Icon className={`h-4 w-4 ${big ? "text-amber-600" : "text-[var(--muted-foreground)]"}`} />
        </div>
        <div className={`${big ? "text-xl sm:text-2xl" : "text-lg sm:text-xl"} font-bold mt-1 ${accent}`}>{value}</div>
        {sub && <div className="text-xs text-amber-600 mt-0.5 font-medium">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function ServicioTable({ rows, bsToUsd }: {
  rows: { unidad: string; numPacientes: number; totalBs: number; ingresoDivisa: number }[];
  bsToUsd: (bs: number) => number;
}) {
  const totBs = rows.reduce((s, r) => s + r.totalBs, 0);
  const totDiv = rows.reduce((s, r) => s + r.ingresoDivisa, 0);
  const totPac = rows.reduce((s, r) => s + r.numPacientes, 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[var(--muted)] text-left">
          <tr>
            <th className="p-2.5 font-medium">Unidad</th>
            <th className="p-2.5 font-medium text-right">Pac.</th>
            <th className="p-2.5 font-medium text-right">Bs.</th>
            <th className="p-2.5 font-medium text-right">≈ $</th>
            <th className="p-2.5 font-medium text-right">Div.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => (
            <tr key={i} className="border-t border-[var(--border)]">
              <td className="p-2.5">{s.unidad}</td>
              <td className="p-2.5 text-right">{s.numPacientes}</td>
              <td className="p-2.5 text-right text-xs">{fmtBs(s.totalBs)}</td>
              <td className="p-2.5 text-right text-amber-600 font-medium">{fmtUsd(bsToUsd(s.totalBs))}</td>
              <td className="p-2.5 text-right text-sky-600 text-xs">{s.ingresoDivisa > 0 ? fmtUsd(s.ingresoDivisa) : "—"}</td>
            </tr>
          ))}
          {rows.length > 1 && (
            <tr className="border-t-2 bg-[var(--muted)] font-semibold">
              <td className="p-2.5" colSpan={2}>Totales · {fmtInt(totPac)} pac.</td>
              <td className="p-2.5 text-right text-xs">{fmtBs(totBs)}</td>
              <td className="p-2.5 text-right text-amber-600">{fmtUsd(bsToUsd(totBs))}</td>
              <td className="p-2.5 text-right text-sky-600 text-xs">{totDiv > 0 ? fmtUsd(totDiv) : "—"}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CollapseSection({ icon: Icon, color, title, subtitle, empty, children }: {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  title: string;
  subtitle: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (empty) {
    return (
      <Card className="opacity-60">
        <button type="button" className="w-full flex items-center gap-3 p-4 text-left">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color} text-white`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">{title}</div>
            <div className="text-xs text-[var(--muted-foreground)]">{subtitle}</div>
          </div>
        </button>
      </Card>
    );
  }
  return (
    <Card>
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-[var(--muted)]/50 transition-colors">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color} text-white`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="font-semibold">{title}</div>
          <div className="text-xs text-[var(--muted-foreground)]">{subtitle}</div>
        </div>
        <ChevronDown className={`h-5 w-5 text-[var(--muted-foreground)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-[var(--border)] p-3 sm:p-4">{children}</div>}
    </Card>
  );
}
