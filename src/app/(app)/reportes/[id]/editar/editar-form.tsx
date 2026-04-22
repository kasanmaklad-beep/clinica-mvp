"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AccordionSection } from "@/components/ui/accordion";
import { fmtUsd, fmtBs, fmtInt } from "@/lib/utils";
import { Save, CheckCircle, Plus, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Especialidad { id: string; codigo: number; nombre: string; honorarioClinica: number }
interface UnidadServicio { id: string; codigo: number; nombre: string }
interface Aseguradora { id: string; nombre: string }

interface ConsultaRow { especialidadId: string; numPacientes: number; totalBs: number; ingresoDivisa: number; porcentajeClinica: number }
interface ServicioRow { unidadServicioId: string; numPacientes: number; totalBs: number; ingresoDivisa: number; porcentajeClinica: number }
interface PacienteAreaRow { area: "EMERGENCIA" | "HOSPITALIZACION" | "UCI"; numPacientes: number }
interface AnticipoRow { tipo: "HOSPITALIZACION" | "EMERGENCIA" | "ESTUDIOS"; totalBs: number; ingresoDivisa: number; numPacientes: number; pacienteNombre: string; estado: "PENDIENTE" | "APLICADO"; aseguradoraId: string; _nuevaAseg: string }
interface CuentaRow { nombreConvenio: string; totalBs: number; ingresoDivisa: number; numPacientes: number; comentarios: string; aseguradoraId: string; _nuevaAseg: string }

function NumInput({ value, onChange, decimal = false }: { value: number; onChange: (n: number) => void; decimal?: boolean }) {
  return (
    <input
      type="number"
      inputMode={decimal ? "decimal" : "numeric"}
      min={0}
      step={decimal ? "0.01" : "1"}
      value={value || ""}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-sm text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"
      placeholder="0"
    />
  );
}

function AseguradoraSelect({ value, onChange, aseguradoras, onNew, placeholder = "Sin aseguradora" }: {
  value: string; onChange: (id: string) => void;
  aseguradoras: Aseguradora[]; onNew: (nombre: string) => Promise<Aseguradora | null>;
  placeholder?: string;
}) {
  const [nombre, setNombre] = useState("");
  const [creando, setCreando] = useState(false);

  async function handleNew(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setCreando(true);
    const nueva = await onNew(nombre.trim());
    setCreando(false);
    if (nueva) { onChange(nueva.id); setNombre(""); }
  }

  return (
    <div className="space-y-1.5">
      <select
        value={value}
        onChange={(e) => { if (e.target.value !== "__nueva__") onChange(e.target.value); else setNombre(""); }}
        className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-sm focus-visible:outline-none">
        <option value="">{placeholder}</option>
        {aseguradoras.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        <option value="__nueva__">+ Agregar nueva aseguradora…</option>
      </select>
      {(value === "__nueva__" || (nombre && !value)) && (
        <form onSubmit={handleNew} className="flex gap-1.5">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la aseguradora" className="h-8 text-sm" autoFocus />
          <Button type="submit" size="sm" disabled={creando || !nombre.trim()}>{creando ? "..." : "Crear"}</Button>
        </form>
      )}
    </div>
  );
}

interface Props {
  id: string;
  especialidades: Especialidad[];
  unidades: UnidadServicio[];
  initialFecha: string;
  initialTasa: number;
  initialObservaciones: string;
  initialEstado: "BORRADOR" | "CERRADO";
  initialConsultas: ConsultaRow[];
  initialServicios: ServicioRow[];
  initialPacientesArea: PacienteAreaRow[];
  initialAnticipos: AnticipoRow[];
  initialCuentas: CuentaRow[];
  initialAps: { consultas: number; laboratoriosImagenes: number; movimientosDia: number; totalFacturados: number; noFacturadosComentarios: string; facturadosComentarios: string };
  isAdmin: boolean;
}

export function EditarReporteForm({
  id, especialidades, unidades,
  initialFecha, initialTasa, initialObservaciones, initialEstado,
  initialConsultas, initialServicios, initialPacientesArea,
  initialAnticipos, initialCuentas, initialAps, isAdmin,
}: Props) {
  const router = useRouter();
  const [fecha, setFecha] = useState(initialFecha);
  const [tasa, setTasa] = useState(initialTasa);
  const [observaciones, setObservaciones] = useState(initialObservaciones);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aseguradoras, setAseguradoras] = useState<Aseguradora[]>([]);

  useEffect(() => {
    fetch("/api/aseguradoras")
      .then(r => r.ok ? r.json() : { aseguradoras: [] })
      .then(d => setAseguradoras(d.aseguradoras || []))
      .catch(() => {});
  }, []);

  async function crearAseguradora(nombre: string): Promise<Aseguradora | null> {
    const res = await fetch("/api/aseguradoras", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre }) });
    if (!res.ok) return null;
    const data = await res.json();
    setAseguradoras(prev => prev.find(a => a.id === data.aseguradora.id) ? prev : [...prev, data.aseguradora].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    return data.aseguradora;
  }

  const [consultas, setConsultas] = useState<ConsultaRow[]>(initialConsultas);
  const [servicios, setServicios] = useState<ServicioRow[]>(initialServicios);
  const [pacsArea, setPacsArea] = useState<PacienteAreaRow[]>(initialPacientesArea);
  const [anticipos, setAnticipos] = useState<AnticipoRow[]>(initialAnticipos);
  const [cuentas, setCuentas] = useState<CuentaRow[]>(initialCuentas);
  const [aps, setAps] = useState(initialAps);

  function updateConsulta(idx: number, field: keyof ConsultaRow, val: number) {
    setConsultas(prev => {
      const next = [...prev];
      const row = { ...next[idx], [field]: val };
      if (field === "numPacientes") {
        row.porcentajeClinica = val * especialidades[idx].honorarioClinica;
        if (tasa > 0) row.totalBs = parseFloat((row.porcentajeClinica * tasa).toFixed(2));
      }
      next[idx] = row;
      return next;
    });
  }

  function updateServicio(idx: number, field: keyof ServicioRow, val: number) {
    setServicios(prev => { const next = [...prev]; next[idx] = { ...next[idx], [field]: val }; return next; });
  }

  const totConsultasBs = consultas.reduce((s, c) => s + c.totalBs, 0);
  const totConsultasDivisa = consultas.reduce((s, c) => s + c.ingresoDivisa, 0);
  const totConsultasPac = consultas.reduce((s, c) => s + c.numPacientes, 0);
  const totConsultasClinica = consultas.reduce((s, c) => s + c.porcentajeClinica, 0);
  const totServiciosBs = servicios.reduce((s, c) => s + c.totalBs, 0);
  const totServiciosDivisa = servicios.reduce((s, c) => s + c.ingresoDivisa, 0);
  const totServiciosPac = servicios.reduce((s, c) => s + c.numPacientes, 0);
  const totAnticiposBs = anticipos.reduce((s, a) => s + a.totalBs, 0);
  const totAnticiposDivisa = anticipos.reduce((s, a) => s + a.ingresoDivisa, 0);
  const totCuentasBs = cuentas.reduce((s, c) => s + c.totalBs, 0);
  const totalBs = totConsultasBs + totServiciosBs + totAnticiposBs + totCuentasBs;
  const totalDivisa = totConsultasDivisa + totServiciosDivisa + totAnticiposDivisa;
  const totalPac = totConsultasPac + totServiciosPac;

  async function guardar(estado: "BORRADOR" | "CERRADO") {
    if (!fecha) { setError("La fecha es requerida"); return; }
    if (!tasa || tasa <= 0) { setError("La tasa de cambio es requerida"); return; }
    setSaving(true); setError(null);

    const anticiposClean = anticipos.map(({ _nuevaAseg: _, ...a }) => a);
    const cuentasClean = cuentas.map(({ _nuevaAseg: _, ...c }) => c);

    const res = await fetch(`/api/reportes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha, tasaCambio: tasa, observaciones, estado, consultas, servicios, pacientesArea: pacsArea, anticipos: anticiposClean, cuentasPorCobrar: cuentasClean, aps }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error || "Error al guardar"); return; }
    router.push(`/reportes/${id}`);
    router.refresh();
  }

  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/reportes/${id}`}><ArrowLeft className="h-4 w-4" /> Ver reporte</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Editar reporte</h1>
          <p className="text-[var(--muted-foreground)] text-sm">{initialFecha} · Hospital Clínicas del Este</p>
        </div>
        {initialEstado === "CERRADO" && (
          <Badge tone="warning" className="ml-auto">Reporte cerrado — editando como administrador</Badge>
        )}
      </div>

      {error && <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 p-3 text-sm text-[var(--destructive)]">{error}</div>}

      {/* Datos generales */}
      <AccordionSection title="Datos generales" defaultOpen colorClass="bg-blue-500"
        badge={tasa > 0 ? <Badge tone="info">Tasa: {tasa}</Badge> : <Badge tone="warning">Sin tasa</Badge>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fecha">Fecha</Label>
            <Input id="fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tasa">Tasa del día (Bs. por $1)</Label>
            <Input id="tasa" type="number" inputMode="decimal" min={0} step="0.01" value={tasa || ""} onChange={e => setTasa(parseFloat(e.target.value) || 0)} placeholder="Ej: 92.50" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="obs">Observaciones</Label>
            <Input id="obs" value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Notas del día..." />
          </div>
        </div>
      </AccordionSection>

      {/* Unidades de Consulta */}
      <AccordionSection title="Unidades de Consulta" defaultOpen colorClass="bg-blue-600"
        subtitle={`${fmtInt(totConsultasPac)} pacientes · ${fmtBs(totConsultasBs)}`}
        badge={totConsultasPac > 0 ? <Badge tone="info">{fmtInt(totConsultasPac)} pac.</Badge> : undefined}>
        <div className="space-y-2">
          <div className="hidden sm:grid sm:grid-cols-[2.5fr_1fr_1.2fr_1fr_1fr] gap-2 px-1 text-xs text-[var(--muted-foreground)] font-medium">
            <div>Especialidad</div>
            <div className="text-right">Pacientes</div>
            <div className="text-right">Total Bs.</div>
            <div className="text-right">Divisa ($)</div>
            <div className="text-right">Ingreso Clínica $</div>
          </div>
          {especialidades.map((esp, idx) => {
            const row = consultas[idx];
            const hasData = row.numPacientes > 0 || row.totalBs > 0;
            return (
              <div key={esp.id} className={`rounded-lg border p-3 transition-colors ${hasData ? "border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20" : "border-[var(--border)]"}`}>
                <div className="sm:hidden text-sm font-medium mb-2">{esp.nombre}<span className="ml-2 text-xs text-[var(--muted-foreground)]">hon: ${esp.honorarioClinica}/pac</span></div>
                <div className="grid grid-cols-2 sm:grid-cols-[2.5fr_1fr_1.2fr_1fr_1fr] gap-2 items-center">
                  <div className="hidden sm:block text-sm">{esp.nombre}<div className="text-xs text-[var(--muted-foreground)]">${esp.honorarioClinica}/pac</div></div>
                  <div className="space-y-1"><Label className="sm:hidden text-xs">Pacientes</Label><NumInput value={row.numPacientes} onChange={v => updateConsulta(idx, "numPacientes", v)} /></div>
                  <div className="space-y-1"><Label className="sm:hidden text-xs">Total Bs.</Label><NumInput value={row.totalBs} onChange={v => updateConsulta(idx, "totalBs", v)} decimal /></div>
                  <div className="space-y-1"><Label className="sm:hidden text-xs">Divisa ($)</Label><NumInput value={row.ingresoDivisa} onChange={v => updateConsulta(idx, "ingresoDivisa", v)} decimal /></div>
                  <div className="h-9 flex items-center justify-end text-sm font-medium text-[var(--primary)]">{row.porcentajeClinica > 0 ? fmtUsd(row.porcentajeClinica) : "—"}</div>
                </div>
              </div>
            );
          })}
          <div className="rounded-lg bg-[var(--muted)] p-3 grid grid-cols-2 sm:grid-cols-[2.5fr_1fr_1.2fr_1fr_1fr] gap-2 text-sm font-semibold">
            <div className="hidden sm:block">Totales</div>
            <div className="col-span-2 sm:hidden">Totales</div>
            <div className="text-right">{fmtInt(totConsultasPac)}</div>
            <div className="text-right">{fmtBs(totConsultasBs)}</div>
            <div className="text-right text-amber-600">{fmtUsd(totConsultasDivisa)}</div>
            <div className="text-right text-[var(--primary)]">{fmtUsd(totConsultasClinica)}</div>
          </div>
        </div>
      </AccordionSection>

      {/* Laboratorio / Imágenes */}
      <AccordionSection title="Laboratorio / Imágenes" colorClass="bg-emerald-500"
        subtitle={`${fmtInt(totServiciosPac)} pacientes · ${fmtBs(totServiciosBs)}`}
        badge={totServiciosPac > 0 ? <Badge tone="success">{fmtInt(totServiciosPac)} pac.</Badge> : undefined}>
        <div className="space-y-2">
          <div className="hidden sm:grid sm:grid-cols-[2.5fr_1fr_1.2fr_1fr] gap-2 px-1 text-xs text-[var(--muted-foreground)] font-medium">
            <div>Unidad</div><div className="text-right">Pacientes</div><div className="text-right">Total Bs.</div><div className="text-right">Divisa ($)</div>
          </div>
          {unidades.map((uni, idx) => {
            const row = servicios[idx];
            const hasData = row.numPacientes > 0 || row.totalBs > 0;
            return (
              <div key={uni.id} className={`rounded-lg border p-3 ${hasData ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20" : "border-[var(--border)]"}`}>
                <div className="sm:hidden text-sm font-medium mb-2">{uni.nombre}</div>
                <div className="grid grid-cols-2 sm:grid-cols-[2.5fr_1fr_1.2fr_1fr] gap-2 items-center">
                  <div className="hidden sm:block text-sm">{uni.nombre}</div>
                  <div className="space-y-1"><Label className="sm:hidden text-xs">Pacientes</Label><NumInput value={row.numPacientes} onChange={v => updateServicio(idx, "numPacientes", v)} /></div>
                  <div className="space-y-1"><Label className="sm:hidden text-xs">Total Bs.</Label><NumInput value={row.totalBs} onChange={v => updateServicio(idx, "totalBs", v)} decimal /></div>
                  <div className="space-y-1"><Label className="sm:hidden text-xs">Divisa ($)</Label><NumInput value={row.ingresoDivisa} onChange={v => updateServicio(idx, "ingresoDivisa", v)} decimal /></div>
                </div>
              </div>
            );
          })}
          <div className="rounded-lg bg-[var(--muted)] p-3 grid grid-cols-2 sm:grid-cols-[2.5fr_1fr_1.2fr_1fr] gap-2 text-sm font-semibold">
            <div className="hidden sm:block">Totales</div>
            <div className="col-span-2 sm:hidden">Totales</div>
            <div className="text-right">{fmtInt(totServiciosPac)}</div>
            <div className="text-right">{fmtBs(totServiciosBs)}</div>
            <div className="text-right text-amber-600">{fmtUsd(totServiciosDivisa)}</div>
          </div>
        </div>
      </AccordionSection>

      {/* Pacientes por área */}
      <AccordionSection title="Pacientes — Emergencia / Hospitalización / UCI" colorClass="bg-amber-500"
        badge={pacsArea.reduce((s, p) => s + p.numPacientes, 0) > 0 ? <Badge tone="warning">{fmtInt(pacsArea.reduce((s, p) => s + p.numPacientes, 0))} pac.</Badge> : undefined}>
        <div className="grid gap-3 sm:grid-cols-3">
          {pacsArea.map((row, idx) => (
            <div key={row.area} className="space-y-1.5">
              <Label>{row.area.charAt(0) + row.area.slice(1).toLowerCase()}</Label>
              <NumInput value={row.numPacientes} onChange={v => setPacsArea(prev => { const n = [...prev]; n[idx] = { ...n[idx], numPacientes: v }; return n; })} />
            </div>
          ))}
        </div>
      </AccordionSection>

      {/* Anticipos */}
      <AccordionSection title="Anticipos — Intervenciones / Hospitalización" colorClass="bg-orange-500"
        subtitle={anticipos.length > 0 ? `${anticipos.length} anticipos · ${fmtBs(totAnticiposBs)}` : "Sin anticipos"}
        badge={anticipos.length > 0 ? <Badge tone="warning">{anticipos.length}</Badge> : undefined}>
        <div className="space-y-3">
          {anticipos.map((ant, idx) => (
            <div key={idx} className="rounded-lg border border-[var(--border)] p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Anticipo #{idx + 1}</span>
                <Button type="button" size="icon" variant="ghost" onClick={() => setAnticipos(prev => prev.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-4 w-4 text-[var(--destructive)]" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo</Label>
                  <select value={ant.tipo} onChange={e => setAnticipos(prev => { const n = [...prev]; n[idx] = { ...n[idx], tipo: e.target.value as AnticipoRow["tipo"] }; return n; })} className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-sm focus-visible:outline-none">
                    <option value="HOSPITALIZACION">Hospitalización</option>
                    <option value="EMERGENCIA">Emergencia</option>
                    <option value="ESTUDIOS">Estudios</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nombre del paciente</Label>
                  <Input value={ant.pacienteNombre} onChange={e => setAnticipos(prev => { const n = [...prev]; n[idx] = { ...n[idx], pacienteNombre: e.target.value }; return n; })} placeholder="Apellido, Nombre" />
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Total Bs.</Label><NumInput value={ant.totalBs} decimal onChange={v => setAnticipos(prev => { const n = [...prev]; n[idx] = { ...n[idx], totalBs: v }; return n; })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Ingreso en Divisa ($)</Label><NumInput value={ant.ingresoDivisa} decimal onChange={v => setAnticipos(prev => { const n = [...prev]; n[idx] = { ...n[idx], ingresoDivisa: v }; return n; })} /></div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs">Aseguradora (opcional)</Label>
                  <AseguradoraSelect value={ant.aseguradoraId} onChange={id => setAnticipos(prev => { const n = [...prev]; n[idx] = { ...n[idx], aseguradoraId: id }; return n; })} aseguradoras={aseguradoras} onNew={crearAseguradora} />
                </div>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={() => setAnticipos(prev => [...prev, { tipo: "HOSPITALIZACION", totalBs: 0, ingresoDivisa: 0, numPacientes: 1, pacienteNombre: "", estado: "PENDIENTE", aseguradoraId: "", _nuevaAseg: "" }])}>
            <Plus className="h-4 w-4" /> Agregar anticipo
          </Button>
          {anticipos.length > 0 && (
            <div className="rounded-lg bg-[var(--muted)] p-3 flex justify-between text-sm font-semibold">
              <span>Total anticipos</span>
              <div className="text-right">
                <div>{fmtBs(totAnticiposBs)}</div>
                {totAnticiposDivisa > 0 && <div className="text-xs text-amber-600">{fmtUsd(totAnticiposDivisa)} en divisa</div>}
              </div>
            </div>
          )}
        </div>
      </AccordionSection>

      {/* Cuentas por cobrar */}
      <AccordionSection title="Cuentas por Cobrar / Convenios" colorClass="bg-purple-500"
        subtitle={cuentas.length > 0 ? `${cuentas.length} convenios · ${fmtBs(totCuentasBs)}` : "Sin cuentas"}
        badge={cuentas.length > 0 ? <Badge>{cuentas.length}</Badge> : undefined}>
        <div className="space-y-3">
          {cuentas.map((c, idx) => (
            <div key={idx} className="rounded-lg border border-[var(--border)] p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Convenio #{idx + 1}</span>
                <Button type="button" size="icon" variant="ghost" onClick={() => setCuentas(prev => prev.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-4 w-4 text-[var(--destructive)]" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs">Aseguradora / Convenio</Label>
                  <AseguradoraSelect value={c.aseguradoraId}
                    onChange={asegId => { const aseg = aseguradoras.find(a => a.id === asegId); setCuentas(prev => { const n = [...prev]; n[idx] = { ...n[idx], aseguradoraId: asegId, nombreConvenio: aseg?.nombre || n[idx].nombreConvenio }; return n; }); }}
                    aseguradoras={aseguradoras}
                    onNew={async (nombre) => { const nueva = await crearAseguradora(nombre); if (nueva) setCuentas(prev => { const n = [...prev]; n[idx] = { ...n[idx], aseguradoraId: nueva.id, nombreConvenio: nueva.nombre }; return n; }); return nueva; }}
                    placeholder="Seleccionar o crear aseguradora…" />
                </div>
                {!c.aseguradoraId && (
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-xs">Nombre del convenio</Label>
                    <Input value={c.nombreConvenio} onChange={e => setCuentas(prev => { const n = [...prev]; n[idx] = { ...n[idx], nombreConvenio: e.target.value }; return n; })} placeholder="Empresa, institución..." />
                  </div>
                )}
                <div className="space-y-1.5"><Label className="text-xs">Total Bs.</Label><NumInput value={c.totalBs} decimal onChange={v => setCuentas(prev => { const n = [...prev]; n[idx] = { ...n[idx], totalBs: v }; return n; })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Ingreso Divisa ($)</Label><NumInput value={c.ingresoDivisa} decimal onChange={v => setCuentas(prev => { const n = [...prev]; n[idx] = { ...n[idx], ingresoDivisa: v }; return n; })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Nº Pacientes</Label><NumInput value={c.numPacientes} onChange={v => setCuentas(prev => { const n = [...prev]; n[idx] = { ...n[idx], numPacientes: v }; return n; })} /></div>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={() => setCuentas(prev => [...prev, { nombreConvenio: "", totalBs: 0, ingresoDivisa: 0, numPacientes: 0, comentarios: "", aseguradoraId: "", _nuevaAseg: "" }])}>
            <Plus className="h-4 w-4" /> Agregar convenio
          </Button>
        </div>
      </AccordionSection>

      {/* APS */}
      <AccordionSection title="Unidad de APS" colorClass="bg-sky-500">
        <div className="grid gap-4 sm:grid-cols-2">
          {(["consultas", "laboratoriosImagenes", "movimientosDia", "totalFacturados"] as const).map(field => (
            <div key={field} className="space-y-1.5">
              <Label className="text-xs">{field === "consultas" ? "Consultas" : field === "laboratoriosImagenes" ? "Laboratorios / Imágenes" : field === "movimientosDia" ? "Movimientos del día" : "Total facturados"}</Label>
              <NumInput value={aps[field]} onChange={v => setAps(prev => ({ ...prev, [field]: v }))} />
            </div>
          ))}
        </div>
      </AccordionSection>

      {/* Total general */}
      <div className="rounded-xl border-2 border-[var(--primary)] bg-[var(--card)] p-4 shadow-sm">
        <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-3">Total General</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div><div className="text-xs text-[var(--muted-foreground)]">Total Bs.</div><div className="text-xl font-bold">{fmtBs(totalBs)}</div></div>
          <div><div className="text-xs text-[var(--muted-foreground)]">Ingreso Divisa</div><div className="text-xl font-bold text-amber-600">{fmtUsd(totalDivisa)}</div></div>
          <div><div className="text-xs text-[var(--muted-foreground)]">Pacientes</div><div className="text-xl font-bold">{fmtInt(totalPac)}</div></div>
          <div><div className="text-xs text-[var(--muted-foreground)]">Ingreso Clínica $</div><div className="text-xl font-bold text-emerald-600">{fmtUsd(totConsultasClinica)}</div></div>
        </div>
      </div>

      {/* Botones fijos */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-20 bg-[var(--card)]/95 backdrop-blur border-t border-[var(--border)] p-3 flex gap-2 justify-end">
        <Button variant="outline" onClick={() => guardar("BORRADOR")} disabled={saving}>
          <Save className="h-4 w-4" />{saving ? "..." : "Guardar borrador"}
        </Button>
        <Button onClick={() => guardar("CERRADO")} disabled={saving}>
          <CheckCircle className="h-4 w-4" />{saving ? "..." : "Cerrar reporte"}
        </Button>
      </div>
    </div>
  );
}
