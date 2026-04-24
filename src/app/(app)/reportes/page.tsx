import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtUsd, fmtBs, fmtInt } from "@/lib/utils";
import { Plus, ChevronRight, Calendar, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { canEditReports } from "@/lib/roles";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export const dynamic = "force-dynamic";

export default async function HistoricoPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  const reportes = await prisma.dailyReport.findMany({
    orderBy: { fecha: "desc" },
    select: {
      id: true,
      fecha: true,
      estado: true,
      tasaCambio: true,
      _count: { select: { anticipos: true } },
      consultas: { select: { totalBs: true, numPacientes: true, porcentajeClinica: true } },
      servicios: { select: { totalBs: true, numPacientes: true } },
      anticipos: { select: { totalBs: true } },
      cuentasPorCobrar: { select: { totalBs: true, numPacientes: true } },
    },
  });

  type DayRow = {
    id: string;
    fecha: Date;
    estado: string;
    numAnticipos: number;
    totalDiv: number;
    totalBs: number;
    totalPac: number;
  };
  type MonthRow = {
    key: string;
    label: string;
    totalDiv: number;
    totalBs: number;
    totalPac: number;
    dias: DayRow[];
  };

  // Group by YYYY-MM
  const grouped = new Map<string, MonthRow>();
  for (const r of reportes) {
    const key = format(new Date(r.fecha), "yyyy-MM");
    const [y, m] = key.split("-");
    const label = format(new Date(Number(y), Number(m) - 1, 1), "MMMM yyyy", { locale: es });
    if (!grouped.has(key)) {
      grouped.set(key, { key, label, totalDiv: 0, totalBs: 0, totalPac: 0, dias: [] });
    }
    const bucket = grouped.get(key)!;
    // Ingreso real de la clínica en el día.
    // - Consultas: sólo honorario clínica (porcentajeClinica en USD). El resto del
    //   totalBs facturado es honorario del médico y no entra a la clínica.
    // - Servicios/Anticipos/Convenios: totalBs completo.
    // ingresoDivisa ya está contabilizado dentro de porcentajeClinica y totalBs.
    const dayTasa = r.tasaCambio || 1;
    const consClinicaUsd = r.consultas.reduce((s, c) => s + c.porcentajeClinica, 0);
    const servBs = r.servicios.reduce((s, x) => s + x.totalBs, 0);
    const antBs  = r.anticipos.reduce((s, a) => s + a.totalBs, 0);
    const cueBs  = r.cuentasPorCobrar.reduce((s, c) => s + c.totalBs, 0);
    const totalDiv = consClinicaUsd + (servBs + antBs + cueBs) / dayTasa;
    const totalBs  = consClinicaUsd * dayTasa + servBs + antBs + cueBs;
    const totalPac =
      r.consultas.reduce((s, x) => s + x.numPacientes, 0) +
      r.servicios.reduce((s, x) => s + x.numPacientes, 0) +
      r.cuentasPorCobrar.reduce((s, c) => s + c.numPacientes, 0);

    bucket.totalDiv += totalDiv;
    bucket.totalBs += totalBs;
    bucket.totalPac += totalPac;
    bucket.dias.push({
      id: r.id,
      fecha: r.fecha,
      estado: r.estado,
      numAnticipos: r._count.anticipos,
      totalDiv, totalBs, totalPac,
    });
  }

  const meses = Array.from(grouped.values()).sort((a, b) => b.key.localeCompare(a.key));

  // Pre-compute previous-month comparisons (next index in desc order)
  const mesWithPrev = meses.map((m, i) => ({ ...m, prev: meses[i + 1] ?? null }));

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Histórico</h1>
          <p className="text-[var(--muted-foreground)] mt-1 text-sm">
            {reportes.length} reportes · {meses.length} meses
          </p>
        </div>
        {canEditReports(role) && (
          <Button asChild>
            <Link href="/reportes/nuevo">
              <Plus className="h-4 w-4" /> Nuevo reporte
            </Link>
          </Button>
        )}
      </div>

      {reportes.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="font-medium">Sin reportes aún</div>
            <p className="text-sm text-[var(--muted-foreground)]">Crea el primer reporte diario o carga un Excel histórico.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {mesWithPrev.map((mes, i) => {
            const prev = mes.prev;
            const diff = prev && prev.totalDiv > 0 ? ((mes.totalDiv - prev.totalDiv) / prev.totalDiv) * 100 : null;
            const up = diff !== null && diff > 0.5;
            const down = diff !== null && diff < -0.5;
            const flat = diff !== null && !up && !down;
            const TIcon = flat ? Minus : up ? TrendingUp : down ? TrendingDown : null;
            const trendColor = up ? "text-emerald-600" : down ? "text-red-500" : "text-[var(--muted-foreground)]";

            return (
              <details key={mes.key} open={i === 0} className="group">
                <summary className="list-none cursor-pointer">
                  <Card className="hover:shadow-md transition-shadow group-open:ring-1 group-open:ring-[var(--primary)]/30">
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-center gap-3">
                        <ChevronRight className="h-5 w-5 text-[var(--muted-foreground)] transition-transform group-open:rotate-90 shrink-0" />
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="font-semibold capitalize">{mes.label}</h2>
                            {TIcon && diff !== null && (
                              <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${trendColor}`}>
                                <TIcon className="h-3 w-3" />
                                {flat ? "—" : `${up ? "+" : ""}${diff.toFixed(0)}%`}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
                            {mes.dias.length} {mes.dias.length === 1 ? "día" : "días"} · {fmtInt(mes.totalPac)} pacientes
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-bold text-amber-600 text-base sm:text-lg">{fmtUsd(mes.totalDiv)}</div>
                          <div className="text-xs text-[var(--muted-foreground)]">{fmtBs(mes.totalBs)}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </summary>

                <div className="mt-2 ml-4 sm:ml-8 space-y-1.5 border-l-2 border-[var(--border)] pl-3 sm:pl-4 pb-2">
                  {mes.dias.map((r) => (
                    <Link key={r.id} href={`/reportes/${r.id}`}>
                      <Card className="hover:shadow-md hover:border-[var(--primary)]/30 transition-all cursor-pointer">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                <span className="font-medium capitalize">
                                  {format(new Date(r.fecha), "EEEE d", { locale: es })}
                                </span>
                                <span className="text-xs text-amber-600 font-semibold">{fmtUsd(r.totalDiv)}</span>
                                <span className="text-xs text-[var(--muted-foreground)]">{fmtBs(r.totalBs)}</span>
                                <span className="text-xs text-[var(--muted-foreground)]">{fmtInt(r.totalPac)} pac.</span>
                                {r.numAnticipos > 0 && (
                                  <span className="text-xs text-[var(--muted-foreground)]">{r.numAnticipos} ant.</span>
                                )}
                              </div>
                            </div>
                            <Badge tone={r.estado === "CERRADO" ? "success" : "warning"}>
                              {r.estado === "CERRADO" ? "Cerrado" : "Borrador"}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
