"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtUsd, fmtBs, fmtInt } from "@/lib/utils";
import { fmtPct } from "@/lib/devaluacion";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Wallet,
  AlertTriangle,
  TrendingDown,
  Clock,
  Shield,
  Stethoscope,
  Users,
  Calendar,
  Zap,
} from "lucide-react";

export interface ConvenioAging {
  nombre: string;
  tipo: "SEGURO" | "ANUALIDAD" | "OTRO";
  primeraFecha: string;
  ultimaFecha: string;
  diasCartera: number;
  tasaOrigen: number;
  tasaHoy: number;
  saldoActualBs: number;
  saldoActualDivisa: number;
  saldoOrigenUsd: number;
  saldoActualUsd: number;
  perdidaUsd: number;
  perdidaPct: number;
  perdidaProyectada30: number;
  perdidaProyectada60: number;
  perdidaProyectada90: number;
  apariciones: number;
}

export interface ProyeccionData {
  tasaDiariaPct: number;
  ventanaBaseDias: number;
  tasaProy30: number;
  tasaProy60: number;
  tasaProy90: number;
}

interface Props {
  convenios: ConvenioAging[];
  tasaHoy: number;
  fechaHoy: string;
  proyeccion: ProyeccionData;
}

type Filtro = "TODOS" | "SEGURO" | "ANUALIDAD" | "OTRO";
type OrdenBy = "perdida" | "proy30" | "saldo" | "dias" | "nombre";

const BUCKETS = [
  { label: "0–7 días", min: 0, max: 7, color: "bg-emerald-500" },
  { label: "8–30 días", min: 8, max: 30, color: "bg-yellow-500" },
  { label: "31–60 días", min: 31, max: 60, color: "bg-amber-500" },
  { label: "61–90 días", min: 61, max: 90, color: "bg-orange-500" },
  { label: "90+ días", min: 91, max: Infinity, color: "bg-red-500" },
];

export function CarteraClient({ convenios, tasaHoy, fechaHoy, proyeccion }: Props) {
  const [filtro, setFiltro] = useState<Filtro>("TODOS");
  const [orden, setOrden] = useState<OrdenBy>("perdida");

  const visibles = useMemo(() => {
    const filtrados =
      filtro === "TODOS"
        ? convenios
        : convenios.filter((c) => c.tipo === filtro);
    const sorted = [...filtrados];
    switch (orden) {
      case "perdida":
        sorted.sort((a, b) => b.perdidaUsd - a.perdidaUsd);
        break;
      case "proy30":
        sorted.sort((a, b) => b.perdidaProyectada30 - a.perdidaProyectada30);
        break;
      case "saldo":
        sorted.sort((a, b) => b.saldoActualBs - a.saldoActualBs);
        break;
      case "dias":
        sorted.sort((a, b) => b.diasCartera - a.diasCartera);
        break;
      case "nombre":
        sorted.sort((a, b) => a.nombre.localeCompare(b.nombre));
        break;
    }
    return sorted;
  }, [convenios, filtro, orden]);

  // KPIs
  const totalSaldoBs = visibles.reduce((s, c) => s + c.saldoActualBs, 0);
  const totalSaldoUsd = visibles.reduce((s, c) => s + c.saldoActualUsd, 0);
  const totalPerdidaUsd = visibles.reduce((s, c) => s + c.perdidaUsd, 0);
  const totalOrigenUsd = visibles.reduce((s, c) => s + c.saldoOrigenUsd, 0);
  const perdidaPctTotal = totalOrigenUsd > 0 ? (totalPerdidaUsd / totalOrigenUsd) * 100 : 0;

  // Proyección: pérdida adicional si la cartera no se cobra en 30/60/90 días
  const totalProy30 = visibles.reduce((s, c) => s + c.perdidaProyectada30, 0);
  const totalProy60 = visibles.reduce((s, c) => s + c.perdidaProyectada60, 0);
  const totalProy90 = visibles.reduce((s, c) => s + c.perdidaProyectada90, 0);

  // Conteos por tipo
  const contadores = useMemo(() => {
    const c = { TODOS: convenios.length, SEGURO: 0, ANUALIDAD: 0, OTRO: 0 };
    for (const x of convenios) c[x.tipo] += 1;
    return c;
  }, [convenios]);

  // Distribución por bucket de aging (sobre los visibles)
  const buckets = useMemo(() => {
    return BUCKETS.map((b) => {
      const items = visibles.filter(
        (c) => c.diasCartera >= b.min && c.diasCartera <= b.max
      );
      return {
        ...b,
        count: items.length,
        saldoBs: items.reduce((s, c) => s + c.saldoActualBs, 0),
        saldoUsd: items.reduce((s, c) => s + c.saldoActualUsd, 0),
        perdidaUsd: items.reduce((s, c) => s + c.perdidaUsd, 0),
      };
    });
  }, [visibles]);

  const totalVisibles = visibles.length;

  if (convenios.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cartera</h1>
          <p className="text-[var(--muted-foreground)] mt-1 text-sm">
            Aging y pérdida cambiaria por convenio
          </p>
        </div>
        <Card>
          <CardContent className="py-12 flex flex-col items-center text-center space-y-3">
            <Wallet className="h-12 w-12 text-[var(--muted-foreground)]" />
            <div className="font-semibold">No hay cuentas por cobrar registradas</div>
            <p className="text-sm text-[var(--muted-foreground)] max-w-md">
              Cuando captures reportes con convenios en cuentas por cobrar, verás
              aquí el análisis de antigüedad y pérdida por devaluación.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cartera</h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">
          Aging y pérdida cambiaria por convenio · tasa hoy{" "}
          <strong>{tasaHoy.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> Bs/$
          {" · "}
          {format(new Date(fechaHoy), "d 'de' MMMM yyyy", { locale: es })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-[var(--muted-foreground)] font-medium">Saldo total</div>
              <Wallet className="h-4 w-4 text-[var(--muted-foreground)]" />
            </div>
            <div className="text-xl font-bold mt-1 text-amber-600">{fmtBs(totalSaldoBs)}</div>
            <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
              ≈ {fmtUsd(totalSaldoUsd)}
            </div>
          </CardContent>
        </Card>

        <Card className="ring-1 ring-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-[var(--muted-foreground)] font-medium">Pérdida cambiaria</div>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>
            <div className="text-xl font-bold mt-1 text-red-600">
              {fmtUsd(totalPerdidaUsd)}
            </div>
            <div className="text-xs text-red-600/80 mt-0.5 font-medium">
              {fmtPct(perdidaPctTotal)} vs valor origen
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-[var(--muted-foreground)] font-medium">Convenios</div>
              <Users className="h-4 w-4 text-[var(--muted-foreground)]" />
            </div>
            <div className="text-xl font-bold mt-1">{fmtInt(totalVisibles)}</div>
            <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
              {filtro === "TODOS" ? "total" : filtro.toLowerCase()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-[var(--muted-foreground)] font-medium">Días promedio</div>
              <Clock className="h-4 w-4 text-[var(--muted-foreground)]" />
            </div>
            <div className="text-xl font-bold mt-1">
              {visibles.length > 0
                ? Math.round(
                    visibles.reduce((s, c) => s + c.diasCartera, 0) / visibles.length
                  )
                : 0}
            </div>
            <div className="text-xs text-[var(--muted-foreground)] mt-0.5">días en cartera</div>
          </CardContent>
        </Card>
      </div>

      {/* Aging buckets */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <div className="font-semibold text-sm">Distribución por antigüedad</div>
          </div>
          <div className="space-y-3">
            {buckets.map((b) => {
              const pct = totalVisibles > 0 ? (b.count / totalVisibles) * 100 : 0;
              return (
                <div key={b.label}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`shrink-0 h-2.5 w-2.5 rounded-full ${b.color}`} />
                      <span className="font-medium text-sm">{b.label}</span>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {b.count} {b.count === 1 ? "convenio" : "convenios"}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold">{fmtBs(b.saldoBs)}</div>
                      <div className="text-xs text-red-500 font-medium">
                        −{fmtUsd(b.perdidaUsd)}
                      </div>
                    </div>
                  </div>
                  <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                    <div className={`h-full ${b.color}`} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Proyección de pérdida */}
      <Card className="bg-gradient-to-br from-red-500/10 via-amber-500/5 to-transparent border-red-500/20">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--muted-foreground)] font-semibold">
                <Zap className="h-3.5 w-3.5 text-red-600" />
                Proyección de pérdida cambiaria
              </div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1">
                Pérdida adicional si esta cartera no se cobra, asumiendo devaluación diaria promedio{" "}
                <strong className="text-red-600">{fmtPct(proyeccion.tasaDiariaPct)}</strong>
                {" "}(últimos {proyeccion.ventanaBaseDias} días)
              </div>
            </div>
            <div className="text-right text-xs text-[var(--muted-foreground)]">
              <div className="font-semibold uppercase tracking-wider">Anualizada</div>
              <div className="text-base font-bold text-red-600">
                {fmtPct((Math.pow(1 + proyeccion.tasaDiariaPct / 100, 365) - 1) * 100)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <ProyCard
              dias={30}
              perdida={totalProy30}
              tasaFutura={proyeccion.tasaProy30}
              tasaHoy={tasaHoy}
            />
            <ProyCard
              dias={60}
              perdida={totalProy60}
              tasaFutura={proyeccion.tasaProy60}
              tasaHoy={tasaHoy}
              severo
            />
            <ProyCard
              dias={90}
              perdida={totalProy90}
              tasaFutura={proyeccion.tasaProy90}
              tasaHoy={tasaHoy}
              severo
            />
          </div>

          <div className="mt-3 pt-3 border-t border-[var(--border)] text-xs text-[var(--muted-foreground)] flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              Al total de <strong>{fmtUsd(totalPerdidaUsd)}</strong> ya perdidos por devaluación,
              se sumarían estas cantidades si no se cobra la cartera a tiempo. Los saldos en Bs
              se mantienen iguales, pero su valor en $ cae día tras día.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {(["TODOS", "SEGURO", "ANUALIDAD", "OTRO"] as Filtro[]).map((f) => {
          const active = filtro === f;
          const Icon = f === "SEGURO" ? Shield : f === "ANUALIDAD" ? Stethoscope : Users;
          return (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                active
                  ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                  : "bg-[var(--background)] border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]"
              }`}
            >
              {f !== "TODOS" && <Icon className="h-3 w-3" />}
              {f === "TODOS" ? "Todos" : f === "SEGURO" ? "Seguros" : f === "ANUALIDAD" ? "Anualidades" : "Otros"}
              <span className="opacity-70">({contadores[f]})</span>
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-[var(--muted-foreground)]">Ordenar:</span>
          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value as OrdenBy)}
            className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)] h-8"
          >
            <option value="perdida">Pérdida $ (mayor)</option>
            <option value="proy30">Proy. 30d (mayor)</option>
            <option value="saldo">Saldo Bs (mayor)</option>
            <option value="dias">Días en cartera</option>
            <option value="nombre">Nombre A-Z</option>
          </select>
        </div>
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--muted)] text-left sticky top-0">
                <tr>
                  <th className="p-3 font-medium">Convenio</th>
                  <th className="p-3 font-medium">Tipo</th>
                  <th className="p-3 font-medium text-right">Días</th>
                  <th className="p-3 font-medium text-right">Saldo Bs</th>
                  <th className="p-3 font-medium text-right">Valor origen $</th>
                  <th className="p-3 font-medium text-right">Valor hoy $</th>
                  <th className="p-3 font-medium text-right">Pérdida $</th>
                  <th className="p-3 font-medium text-right">Proy. 30d</th>
                  <th className="p-3 font-medium text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((c) => (
                  <tr key={c.nombre} className="border-t border-[var(--border)] hover:bg-[var(--muted)]/40">
                    <td className="p-3">
                      <div className="font-medium">{c.nombre}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        Origen: {format(new Date(c.primeraFecha), "dd MMM yy", { locale: es })}
                        {" · "}tasa {c.tasaOrigen.toFixed(2)}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge
                        tone={
                          c.tipo === "SEGURO" ? "success" : c.tipo === "ANUALIDAD" ? "warning" : "default"
                        }
                      >
                        {c.tipo === "SEGURO"
                          ? "Seguro"
                          : c.tipo === "ANUALIDAD"
                          ? "Anualidad"
                          : "Otro"}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <span
                        className={`font-semibold ${
                          c.diasCartera > 60
                            ? "text-red-500"
                            : c.diasCartera > 30
                            ? "text-amber-600"
                            : c.diasCartera > 7
                            ? "text-yellow-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {c.diasCartera}
                      </span>
                    </td>
                    <td className="p-3 text-right text-xs">{fmtBs(c.saldoActualBs)}</td>
                    <td className="p-3 text-right text-xs text-[var(--muted-foreground)]">
                      {fmtUsd(c.saldoOrigenUsd)}
                    </td>
                    <td className="p-3 text-right text-amber-600 font-medium">
                      {fmtUsd(c.saldoActualUsd)}
                    </td>
                    <td className="p-3 text-right text-red-600 font-bold">
                      −{fmtUsd(c.perdidaUsd)}
                    </td>
                    <td className="p-3 text-right text-red-500 text-xs font-semibold">
                      −{fmtUsd(c.perdidaProyectada30)}
                    </td>
                    <td className="p-3 text-right text-red-600 text-xs font-semibold">
                      {fmtPct(-c.perdidaPct)}
                    </td>
                  </tr>
                ))}
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-sm text-[var(--muted-foreground)]">
                      No hay convenios con este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
              {visibles.length > 0 && (
                <tfoot className="bg-[var(--muted)] font-semibold text-sm">
                  <tr className="border-t-2">
                    <td className="p-3" colSpan={3}>
                      Totales · {visibles.length} convenios
                    </td>
                    <td className="p-3 text-right text-xs">{fmtBs(totalSaldoBs)}</td>
                    <td className="p-3 text-right text-xs">{fmtUsd(totalOrigenUsd)}</td>
                    <td className="p-3 text-right text-amber-600">{fmtUsd(totalSaldoUsd)}</td>
                    <td className="p-3 text-right text-red-600">−{fmtUsd(totalPerdidaUsd)}</td>
                    <td className="p-3 text-right text-red-500 text-xs">−{fmtUsd(totalProy30)}</td>
                    <td className="p-3 text-right text-red-600 text-xs">{fmtPct(-perdidaPctTotal)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Nota metodológica */}
      <Card className="bg-[var(--muted)]/30 border-dashed">
        <CardContent className="p-4 text-xs text-[var(--muted-foreground)] space-y-1">
          <div className="font-semibold text-[var(--foreground)]">Notas</div>
          <p>
            · <strong>Valor origen $</strong>: lo que valía el saldo actual en Bs el
            día que el convenio apareció por primera vez (con la tasa de ese día).
          </p>
          <p>
            · <strong>Pérdida $</strong>: diferencia entre el valor origen y el
            valor hoy, causada por la devaluación del Bolívar.
          </p>
          <p>
            · <strong>Proyección</strong>: asume que la devaluación continúa al
            ritmo diario observado en los últimos {proyeccion.ventanaBaseDias} días.
            Es un escenario, no una predicción.
          </p>
          <p>
            · <strong>Clasificación</strong>: automática por nombre. Seguros se
            detectan por palabras clave; Anualidad por &ldquo;Dr./Dra./ANUALIDAD&rdquo;.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ProyCard — tarjeta de proyección por horizonte de días
// ══════════════════════════════════════════════════════════════
function ProyCard({
  dias,
  perdida,
  tasaFutura,
  tasaHoy,
  severo,
}: {
  dias: number;
  perdida: number;
  tasaFutura: number;
  tasaHoy: number;
  severo?: boolean;
}) {
  const color = severo ? "text-red-600" : "text-amber-600";
  const bg = severo ? "bg-red-500/5" : "bg-amber-500/5";
  const variacion = tasaHoy > 0 ? ((tasaFutura - tasaHoy) / tasaHoy) * 100 : 0;
  return (
    <div className={`rounded-lg border border-[var(--border)] ${bg} p-3`}>
      <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
        <Calendar className="h-3 w-3" />
        {dias} días
      </div>
      <div className={`text-xl sm:text-2xl font-black mt-1 ${color}`}>
        −{fmtUsd(perdida)}
      </div>
      <div className="text-[10px] text-[var(--muted-foreground)] mt-1 leading-tight">
        Tasa proy: <strong>{tasaFutura.toLocaleString("es-VE", { maximumFractionDigits: 0 })}</strong>
        {" "}({fmtPct(variacion)})
      </div>
    </div>
  );
}
