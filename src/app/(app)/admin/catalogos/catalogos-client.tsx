"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, Plus, Trash2, Building2, Stethoscope, FlaskConical } from "lucide-react";

interface Especialidad {
  id: string;
  codigo: number;
  nombre: string;
  honorarioClinica: number;
  modeloNegocio: string;
  activa: boolean;
}

interface UnidadServicio {
  id: string;
  codigo: number;
  nombre: string;
  categoria: string;
  orden: number;
  activa: boolean;
}

interface Aseguradora {
  id: string;
  nombre: string;
  activa: boolean;
  createdAt: string;
}

export function CatalogosClient({
  data,
}: {
  data: { especialidades: Especialidad[]; unidades: UnidadServicio[]; aseguradoras: Aseguradora[] };
}) {
  const [especialidades, setEspecialidades] = useState<Especialidad[]>(data.especialidades);
  const [unidades, setUnidades] = useState<UnidadServicio[]>(data.unidades);
  const [aseguradoras, setAseguradoras] = useState<Aseguradora[]>(data.aseguradoras);
  const [newUnidad, setNewUnidad] = useState("");
  const [newUnidadCat, setNewUnidadCat] = useState<"LABORATORIO" | "IMAGENES" | "SERVICIO">("LABORATORIO");
  const [addingUnidad, setAddingUnidad] = useState(false);
  const [savingUnidad, setSavingUnidad] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [newAseg, setNewAseg] = useState("");
  const [addingAseg, setAddingAseg] = useState(false);

  async function saveEspecialidad(e: Especialidad) {
    setSaving(e.id);
    const res = await fetch("/api/admin/catalogos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: e.id,
        honorarioClinica: e.honorarioClinica,
        modeloNegocio: e.modeloNegocio,
        activa: e.activa,
      }),
    });
    setSaving(null);
    if (res.ok) {
      const data = await res.json();
      setEspecialidades((prev) => prev.map((x) => (x.id === e.id ? data.especialidad : x)));
    }
  }

  function updateEspecialidad(id: string, field: keyof Especialidad, value: unknown) {
    setEspecialidades((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  }

  async function addUnidad(e: React.FormEvent) {
    e.preventDefault();
    if (!newUnidad.trim()) return;
    setAddingUnidad(true);
    const res = await fetch("/api/admin/catalogos/unidades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: newUnidad.trim(), categoria: newUnidadCat }),
    });
    setAddingUnidad(false);
    if (res.ok) {
      const d = await res.json();
      setUnidades((prev) => [...prev, d.unidad].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setNewUnidad("");
    }
  }

  async function toggleUnidad(u: UnidadServicio) {
    setSavingUnidad(u.id);
    const res = await fetch("/api/admin/catalogos/unidades", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, activa: !u.activa }),
    });
    setSavingUnidad(null);
    if (res.ok) {
      setUnidades((prev) => prev.map((x) => (x.id === u.id ? { ...x, activa: !x.activa } : x)));
    }
  }

  async function addAseguradora(e: React.FormEvent) {
    e.preventDefault();
    if (!newAseg.trim()) return;
    setAddingAseg(true);
    const res = await fetch("/api/aseguradoras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: newAseg.trim() }),
    });
    setAddingAseg(false);
    if (res.ok) {
      const data = await res.json();
      setAseguradoras((prev) => {
        const exists = prev.find((a) => a.id === data.aseguradora.id);
        if (exists) return prev;
        return [...prev, { ...data.aseguradora, createdAt: new Date().toISOString() }].sort((a, b) =>
          a.nombre.localeCompare(b.nombre)
        );
      });
      setNewAseg("");
    }
  }

  async function toggleAseguradora(a: Aseguradora) {
    const res = await fetch(`/api/aseguradoras/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activa: !a.activa }),
    });
    if (res.ok) {
      setAseguradoras((prev) => prev.map((x) => (x.id === a.id ? { ...x, activa: !x.activa } : x)));
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Catálogos</h1>
        <p className="text-[var(--muted-foreground)] mt-1">
          Modelo de negocio por especialidad y catálogo de aseguradoras
        </p>
      </div>

      {/* ── Especialidades */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-[var(--primary)]" />
            <div>
              <CardTitle>Especialidades</CardTitle>
              <CardDescription>
                Configura el honorario y el modelo de negocio de cada especialidad
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--muted)] text-left">
                <tr>
                  <th className="p-3 font-medium w-8">#</th>
                  <th className="p-3 font-medium">Especialidad</th>
                  <th className="p-3 font-medium w-36">Honorario ($/pac)</th>
                  <th className="p-3 font-medium">Modelo de negocio</th>
                  <th className="p-3 font-medium w-24 text-center">Activa</th>
                  <th className="p-3 font-medium w-20"></th>
                </tr>
              </thead>
              <tbody>
                {especialidades.map((e) => (
                  <tr key={e.id} className={`border-t border-[var(--border)] ${!e.activa ? "opacity-50" : ""}`}>
                    <td className="p-3 text-[var(--muted-foreground)]">{e.codigo}</td>
                    <td className="p-3 font-medium">{e.nombre}</td>
                    <td className="p-3">
                      <Input
                        type="number"
                        min={0}
                        step="0.5"
                        value={e.honorarioClinica}
                        onChange={(ev) => updateEspecialidad(e.id, "honorarioClinica", parseFloat(ev.target.value) || 0)}
                        className="h-8 text-right"
                      />
                    </td>
                    <td className="p-3">
                      <Input
                        value={e.modeloNegocio}
                        onChange={(ev) => updateEspecialidad(e.id, "modeloNegocio", ev.target.value)}
                        className="h-8"
                        placeholder="Ej: Fijo por paciente"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={e.activa}
                        onChange={(ev) => updateEspecialidad(e.id, "activa", ev.target.checked)}
                        className="h-4 w-4 rounded"
                      />
                    </td>
                    <td className="p-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveEspecialidad(e)}
                        disabled={saving === e.id}
                      >
                        <Save className="h-3.5 w-3.5" />
                        {saving === e.id ? "..." : "Guardar"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-[var(--border)]">
            {especialidades.map((e) => (
              <div key={e.id} className={`p-4 space-y-3 ${!e.activa ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="font-medium">{e.nombre}</div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Activa</Label>
                    <input
                      type="checkbox"
                      checked={e.activa}
                      onChange={(ev) => updateEspecialidad(e.id, "activa", ev.target.checked)}
                      className="h-4 w-4"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Honorario ($/pac)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.5"
                      value={e.honorarioClinica}
                      onChange={(ev) => updateEspecialidad(e.id, "honorarioClinica", parseFloat(ev.target.value) || 0)}
                      className="h-8 text-right"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Modelo</Label>
                    <Input
                      value={e.modeloNegocio}
                      onChange={(ev) => updateEspecialidad(e.id, "modeloNegocio", ev.target.value)}
                      className="h-8"
                    />
                  </div>
                </div>
                <Button size="sm" onClick={() => saveEspecialidad(e)} disabled={saving === e.id} className="w-full">
                  <Save className="h-3.5 w-3.5" />
                  {saving === e.id ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Unidades de Servicio */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-[var(--primary)]" />
            <div>
              <CardTitle>Unidades de Servicio</CardTitle>
              <CardDescription>Laboratorio, Imágenes y otros servicios de apoyo diagnóstico</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={addUnidad} className="flex flex-wrap gap-2">
            <Input
              value={newUnidad}
              onChange={(e) => setNewUnidad(e.target.value)}
              placeholder="Ej: Resonancia Magnética"
              className="flex-1 min-w-0"
            />
            <select
              value={newUnidadCat}
              onChange={(e) => setNewUnidadCat(e.target.value as "LABORATORIO" | "IMAGENES" | "SERVICIO")}
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              <option value="LABORATORIO">Laboratorio</option>
              <option value="IMAGENES">Imágenes</option>
              <option value="SERVICIO">Servicio</option>
            </select>
            <Button type="submit" disabled={addingUnidad || !newUnidad.trim()}>
              <Plus className="h-4 w-4" />
              {addingUnidad ? "..." : "Agregar"}
            </Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {unidades.map((u) => {
              const catLabel = u.categoria === "IMAGENES" ? "Img" : u.categoria === "SERVICIO" ? "Serv" : "Lab";
              const catColor = u.categoria === "IMAGENES" ? "bg-cyan-500/20 text-cyan-700" : u.categoria === "SERVICIO" ? "bg-orange-500/20 text-orange-700" : "bg-emerald-500/20 text-emerald-700";
              return (
              <div
                key={u.id}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-opacity ${
                  u.activa ? "border-[var(--border)]" : "border-[var(--border)] opacity-40"
                }`}
              >
                <span className={`text-xs font-semibold rounded-full px-1.5 py-0.5 ${catColor}`}>{catLabel}</span>
                <span>{u.nombre}</span>
                <button
                  onClick={() => toggleUnidad(u)}
                  disabled={savingUnidad === u.id}
                  className="ml-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors disabled:opacity-50"
                  title={u.activa ? "Desactivar" : "Activar"}
                >
                  {u.activa ? <Trash2 className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                </button>
              </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Aseguradoras */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[var(--primary)]" />
            <div>
              <CardTitle>Aseguradoras / Seguros</CardTitle>
              <CardDescription>
                El catálogo también crece automáticamente cuando registras un pago en el formulario diario
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={addAseguradora} className="flex gap-2">
            <Input
              value={newAseg}
              onChange={(e) => setNewAseg(e.target.value)}
              placeholder="Nombre de la aseguradora..."
              className="flex-1"
            />
            <Button type="submit" disabled={addingAseg || !newAseg.trim()}>
              <Plus className="h-4 w-4" />
              {addingAseg ? "..." : "Agregar"}
            </Button>
          </form>

          {aseguradoras.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] text-center py-4">
              Sin aseguradoras aún. Se agregan aquí o desde el formulario diario.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {aseguradoras.map((a) => (
                <div
                  key={a.id}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-opacity ${
                    a.activa ? "border-[var(--border)]" : "border-[var(--border)] opacity-50"
                  }`}
                >
                  <span>{a.nombre}</span>
                  <button
                    onClick={() => toggleAseguradora(a)}
                    className="ml-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors"
                    title={a.activa ? "Desactivar" : "Activar"}
                  >
                    {a.activa ? <Trash2 className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
