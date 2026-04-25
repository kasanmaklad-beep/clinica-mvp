"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtUsd, fmtBs } from "@/lib/utils";
import { fmtPct } from "@/lib/devaluacion";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Wallet,
  TrendingDown,
  Clock,
  Calendar,
  Zap,
  LineChart,
  History,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Equal,
} from "lucide-react";

// ───────────── Tipos ─────────────
export interface DiaSaldo {
  id: string;
  fecha: string;
  tasaDia: number;
  diasTranscurridos: number;
  consClinicaBs: number;
  servBs: number;
  antBs: number;
  cueBs: number;
  ingresoBs: number;
  ingresoUsdOrigen: number;
  ingresoUsdHoy: number;
  perdidaUsd: number;
}

export interface ProyPerdida {
  dias: number;
  tasaProyectada: number;
  perdidaUsd: number;
}

export interface ProyTasa {
  dias: number;
  tasaProyectada: number;
  fechaObjetivo: string;
}

export interface HistoricoComp {
  id: string;
  fechaProyeccion: string;
  fechaObjetivo: string;
  diasAdelante: number;
  tasaHoy: number;
  tasaProyectada: number;
  tasaReal: number;
  diferenciaPct: number;
}

interface PropsEmpty {
  empty: true;
}
interface PropsFull {
  empty: false;
  tasaHoy: number;
  fechaHoy: string;
  tasaDiariaPct: number;
  ventanaBaseDias: number;
  dias: DiaSaldo[];
  totales: {
    saldoBs: number;
    saldoUsdOrigen: number;
    saldoUsdHoy: number;
    perdidaYaUsd: number;
  };
  proyPerdida: ProyPerdida[];
  proyTasa: ProyTasa[];
  historico: HistoricoComp[];
}

type Props = PropsEmpty | PropsFull;

// ───────────── Componente principal ─────────────
export function CarteraClient(props: Props) {
  if (props.empty) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Cartera
          </h1>
          <p className="text-[var(--muted-foreground)] mt-1 text-sm">
            Saldo en cuentas y exposición a la devaluación
          </p>
        </div>
        <Card>
          <CardContent className="py-12 flex flex-col items-center text-center space-y-3">
            <Wallet className="h-12 w-12 text-[var(--muted-foreground)]" />
            <div className="font-semibold">Aún no hay reportes registrados</div>
            <p className="text-sm text-[var(--muted-foreground)] max-w-md">
              Cuando se carguen reportes diarios, aquí verás el saldo en cuentas,
              su pérdida proyectada y la proyección de la tasa Bs/$.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const {
    tasaHoy,
    fechaHoy,
    tasaDiariaPct,
    ventanaBaseDias,
    dias,
    totales,
    proyPerdida,
    proyTasa,
    historico,
  } = props;

  const anualizada = (Math.pow(1 + tasaDiariaPct / 100, 365) - 1) * 100;
  const perdidaYaPct =
    totales.saldoUsdOrigen > 0
      ? (totales.perdidaYaUsd / totales.saldoUsdOrigen) * 100
      : 0;

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cartera</h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">
          Dinero en cuentas (últimos 15 días) · tasa hoy{" "}
          <strong>
            {tasaHoy.toLocaleString("es-VE", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </strong>{" "}
          Bs/$ · {format(new Date(fechaHoy), "d 'de' MMMM yyyy", { locale: es })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-[var(--muted-foreground)] font-medium">
                Saldo en cuentas
              </div>
              <Wallet className="h-4 w-4 text-[var(--muted-foreground)]" />
            </div>
            <div className="text-xl font-bold mt-1 text-amber-600">
              {fmtBs(totales.saldoBs)}
            </div>
            <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
              ≈ {fmtUsd(totales.saldoUsdHoy)}
            </div>
          </CardContent>
        </Card>

        <Card className="ring-1 ring-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-[var(--muted-foreground)] font-medium">
                Ya perdido
              </div>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>
            <div className="text-xl font-bold mt-1 text-red-600">
              {fmtUsd(totales.perdidaYaUsd)}
            </div>
            <div className="text-xs text-red-600/80 mt-0.5 font-medium">
              {fmtPct(-perdidaYaPct)} vs entrada
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-[var(--muted-foreground)] font-medium">
                Devaluación diaria
              </div>
              <LineChart className="h-4 w-4 text-[var(--muted-foreground)]" />
            </div>
            <div className="text-xl font-bold mt-1 text-amber-600">
              {fmtPct(tasaDiariaPct)}
            </div>
            <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
              últimos {ventanaBaseDias} días
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-[var(--muted-foreground)] font-medium">
                Anualizada
              </div>
              <Clock className="h-4 w-4 text-[var(--muted-foreground)]" />
            </div>
            <div className="text-xl font-bold mt-1 text-red-600">
              {fmtPct(anualizada)}
            </div>
            <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
              proyección compound
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pérdida proyectada sobre saldo */}
      <Card className="bg-gradient-to-br from-red-500/10 via-amber-500/5 to-transparent border-red-500/20">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--muted-foreground)] font-semibold">
                <Zap className="h-3.5 w-3.5 text-red-600" />
                Pérdida proyectada sobre el saldo
              </div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1">
                Cuánto USD adicional perdería este saldo si se mantiene en Bs.
                La nómina sale quincenal, así que la ventana relevante es ≤ 15 días.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {proyPerdida.map((p) => (
              <ProyPerdidaCard
                key={p.dias}
                dias={p.dias}
                perdidaUsd={p.perdidaUsd}
                tasaFutura={p.tasaProyectada}
                tasaHoy={tasaHoy}
                severo={p.dias >= 7}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Proyección de tasa */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--muted-foreground)] font-semibold">
                <LineChart className="h-3.5 w-3.5 text-[var(--primary)]" />
                Proyección de tasa Bs/$
              </div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1">
                Valor estimado del bolívar a futuro. 45 días aproxima el plazo
                típico de pago de los seguros.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {proyTasa.map((p) => (
              <ProyTasaCard
                key={p.dias}
                dias={p.dias}
                tasaFutura={p.tasaProyectada}
                tasaHoy={tasaHoy}
                fechaObjetivo={p.fechaObjetivo}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comparativa esperado vs real */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <History className="h-4 w-4 text-[var(--primary)]" />
            <div className="font-semibold text-sm">
              Esperado vs real ({historico.length})
            </div>
          </div>
          {historico.length === 0 ? (
            <div className="text-xs text-[var(--muted-foreground)] py-4 text-center">
              Aún no hay proyecciones cumplidas. Aparecerán aquí cuando llegue la
              fecha objetivo de proyecciones registradas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--muted)] text-left">
                  <tr>
                    <th className="p-2 font-medium">Proyectado el</th>
                    <th className="p-2 font-medium">Para fecha</th>
                    <th className="p-2 font-medium text-center">Plazo</th>
                    <th className="p-2 font-medium text-right">Tasa proy.</th>
                    <th className="p-2 font-medium text-right">Tasa real</th>
                    <th className="p-2 font-medium text-right">Δ</th>
                    <th className="p-2 font-medium">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((h) => {
                    const r = clasificarResultado(h.diferenciaPct);
                    return (
                      <tr
                        key={h.id}
                        className="border-t border-[var(--border)] hover:bg-[var(--muted)]/40"
                      >
                        <td className="p-2 text-xs">
                          {format(new Date(h.fechaProyeccion), "dd MMM yy", {
                            locale: es,
                          })}
                        </td>
                        <td className="p-2 text-xs">
                          {format(new Date(h.fechaObjetivo), "dd MMM yy", {
                            locale: es,
                          })}
                        </td>
                        <td className="p-2 text-xs text-center text-[var(--muted-foreground)]">
                          {h.diasAdelante}d
                        </td>
                        <td className="p-2 text-right text-xs">
                          {h.tasaProyectada.toLocaleString("es-VE", {
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-2 text-right text-xs font-medium">
                          {h.tasaReal.toLocaleString("es-VE", {
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td
                          className={`p-2 text-right text-xs font-semibold ${r.color}`}
                        >
                          {fmtPct(h.diferenciaPct)}
                        </td>
                        <td className="p-2">
                          <Badge tone={r.tone}>
                            <r.Icon className="h-3 w-3" />
                            {r.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detalle día a día */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-[var(--primary)]" />
            <div className="font-semibold text-sm">
              Detalle por día — últimos 15
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--muted)] text-left">
                <tr>
                  <th className="p-2 font-medium">Fecha</th>
                  <th className="p-2 font-medium text-right">Días</th>
                  <th className="p-2 font-medium text-right">Tasa día</th>
                  <th className="p-2 font-medium text-right">Ingreso Bs</th>
                  <th className="p-2 font-medium text-right">Valor entrada $</th>
                  <th className="p-2 font-medium text-right">Valor hoy $</th>
                  <th className="p-2 font-medium text-right">Pérdida $</th>
                </tr>
              </thead>
              <tbody>
                {dias.map((d) => (
                  <tr
                    key={d.id}
                    className="border-t border-[var(--border)] hover:bg-[var(--muted)]/40"
                  >
                    <td className="p-2 text-xs capitalize">
                      {format(new Date(d.fecha), "EEE dd MMM", { locale: es })}
                    </td>
                    <td className="p-2 text-right text-xs text-[var(--muted-foreground)]">
                      {d.diasTranscurridos}
                    </td>
                    <td className="p-2 text-right text-xs text-[var(--muted-foreground)]">
                      {d.tasaDia.toLocaleString("es-VE", {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-2 text-right text-xs">
                      {fmtBs(d.ingresoBs)}
                    </td>
                    <td className="p-2 text-right text-xs text-[var(--muted-foreground)]">
                      {fmtUsd(d.ingresoUsdOrigen)}
                    </td>
                    <td className="p-2 text-right text-xs text-amber-600 font-medium">
                      {fmtUsd(d.ingresoUsdHoy)}
                    </td>
                    <td className="p-2 text-right text-xs text-red-600 font-semibold">
                      −{fmtUsd(d.perdidaUsd)}
                    </td>
                  </tr>
                ))}
                {dias.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-6 text-center text-sm text-[var(--muted-foreground)]"
                    >
                      No hay reportes en los últimos 15 días.
                    </td>
                  </tr>
                )}
              </tbody>
              {dias.length > 0 && (
                <tfoot className="bg-[var(--muted)] font-semibold text-sm">
                  <tr className="border-t-2">
                    <td className="p-2" colSpan={3}>
                      Totales · {dias.length} días
                    </td>
                    <td className="p-2 text-right text-xs">
                      {fmtBs(totales.saldoBs)}
                    </td>
                    <td className="p-2 text-right text-xs">
                      {fmtUsd(totales.saldoUsdOrigen)}
                    </td>
                    <td className="p-2 text-right text-amber-600">
                      {fmtUsd(totales.saldoUsdHoy)}
                    </td>
                    <td className="p-2 text-right text-red-600">
                      −{fmtUsd(totales.perdidaYaUsd)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Notas */}
      <Card className="bg-[var(--muted)]/30 border-dashed">
        <CardContent className="p-4 text-xs text-[var(--muted-foreground)] space-y-1">
          <div className="font-semibold text-[var(--foreground)]">Notas</div>
          <p>
            · <strong>Saldo en cuentas</strong>: ingreso clínica acumulado de los
            últimos 15 días. Aproxima el dinero que aún no ha salido por nómina
            quincenal u otros gastos.
          </p>
          <p>
            · <strong>Valor entrada $</strong>: lo que valía cada ingreso el día
            que entró, con la tasa de ese día.
          </p>
          <p>
            · <strong>Pérdida proyectada</strong>: asume que la devaluación
            continúa al ritmo diario observado en los últimos {ventanaBaseDias}{" "}
            días. Es un escenario, no una predicción.
          </p>
          <p>
            · <strong>Esperado vs real</strong>: cada día se persiste la
            proyección a 7/15/30/45 días. Cuando llega la fecha objetivo se
            compara contra la tasa real de ese día.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ───────────── Subcomponentes ─────────────
function ProyPerdidaCard({
  dias,
  perdidaUsd,
  tasaFutura,
  tasaHoy,
  severo,
}: {
  dias: number;
  perdidaUsd: number;
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
        {dias} {dias === 1 ? "día" : "días"}
      </div>
      <div className={`text-xl sm:text-2xl font-black mt-1 ${color}`}>
        −{fmtUsd(perdidaUsd)}
      </div>
      <div className="text-[10px] text-[var(--muted-foreground)] mt-1 leading-tight">
        Tasa proy:{" "}
        <strong>
          {tasaFutura.toLocaleString("es-VE", { maximumFractionDigits: 2 })}
        </strong>{" "}
        ({fmtPct(variacion)})
      </div>
    </div>
  );
}

function ProyTasaCard({
  dias,
  tasaFutura,
  tasaHoy,
  fechaObjetivo,
}: {
  dias: number;
  tasaFutura: number;
  tasaHoy: number;
  fechaObjetivo: string;
}) {
  const variacion = tasaHoy > 0 ? ((tasaFutura - tasaHoy) / tasaHoy) * 100 : 0;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3">
      <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
        <Calendar className="h-3 w-3" />
        {dias} días
      </div>
      <div className="text-xl sm:text-2xl font-black mt-1 text-[var(--foreground)]">
        {tasaFutura.toLocaleString("es-VE", { maximumFractionDigits: 2 })}
      </div>
      <div className="text-[10px] text-[var(--muted-foreground)] mt-1 leading-tight">
        {format(new Date(fechaObjetivo), "dd MMM yy", { locale: es })} ·{" "}
        <span className="text-red-500 font-semibold">{fmtPct(variacion)}</span>
      </div>
    </div>
  );
}

// ───────────── Helpers ─────────────
type ResultadoBadge = {
  label: string;
  tone: "success" | "warning" | "danger" | "default";
  Icon: typeof CheckCircle2;
  color: string;
};

function clasificarResultado(diferenciaPct: number): ResultadoBadge {
  // diferenciaPct positivo = tasa real más alta que proyectada → MÁS devaluación que esperada (peor para el clínica)
  // diferenciaPct negativo = tasa real más baja que proyectada → MENOS devaluación (mejor)
  if (diferenciaPct > 1) {
    return {
      label: "Peor de lo esperado",
      tone: "danger",
      Icon: ArrowUpRight,
      color: "text-red-600",
    };
  }
  if (diferenciaPct < -1) {
    return {
      label: "Mejor de lo esperado",
      tone: "success",
      Icon: ArrowDownRight,
      color: "text-emerald-600",
    };
  }
  return {
    label: "Cumplió",
    tone: "default",
    Icon: Equal,
    color: "text-[var(--muted-foreground)]",
  };
}
