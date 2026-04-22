import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtUsd, fmtBs, fmtInt } from "@/lib/utils";
import { canEditReports, isAdmin } from "@/lib/roles";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";

type Params = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function ReporteDetallePage({ params }: Params) {
  const { id } = await params;
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  const r = await prisma.dailyReport.findUnique({
    where: { id },
    include: {
      consultas: { include: { especialidad: true }, orderBy: { especialidad: { orden: "asc" } } },
      servicios: { include: { unidadServicio: true }, orderBy: { unidadServicio: { orden: "asc" } } },
      pacientesArea: true,
      anticipos: true,
      cuentasPorCobrar: true,
      aps: true,
      creadoPor: { select: { name: true } },
    },
  });

  if (!r) notFound();

  const totalConsultasUsd = r.consultas.reduce((s, c) => s + c.ingresoDivisa, 0);
  const totalConsultasBs = r.consultas.reduce((s, c) => s + c.totalBs, 0);
  const totalConsultasPac = r.consultas.reduce((s, c) => s + c.numPacientes, 0);
  const totalConsultasClinica = r.consultas.reduce((s, c) => s + c.porcentajeClinica, 0);
  const totalServiciosUsd = r.servicios.reduce((s, c) => s + c.ingresoDivisa, 0);
  const totalServiciosBs = r.servicios.reduce((s, c) => s + c.totalBs, 0);
  const totalServiciosPac = r.servicios.reduce((s, c) => s + c.numPacientes, 0);
  const totalAnticiposUsd = r.anticipos.reduce((s, a) => s + a.ingresoDivisa, 0);
  const totalAnticiposBs = r.anticipos.reduce((s, a) => s + a.totalBs, 0);
  const totalCuentasUsd = r.cuentasPorCobrar.reduce((s, c) => s + c.ingresoDivisa, 0);
  const totalCuentasBs = r.cuentasPorCobrar.reduce((s, c) => s + c.totalBs, 0);
  const totalCuentasPac = r.cuentasPorCobrar.reduce((s, c) => s + c.numPacientes, 0);
  const totalGeneralUsd = totalConsultasUsd + totalServiciosUsd + totalAnticiposUsd + totalCuentasUsd;
  const totalGeneralBs = totalConsultasBs + totalServiciosBs + totalAnticiposBs + totalCuentasBs;

  const consultasActivas = r.consultas.filter(c => c.numPacientes > 0 || c.totalBs > 0);
  const serviciosActivos = r.servicios.filter(s => s.numPacientes > 0 || s.totalBs > 0);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/reportes"><ArrowLeft className="h-4 w-4" /> Histórico</Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate capitalize">
            {format(new Date(r.fecha), "EEEE d 'de' MMMM yyyy", { locale: es })}
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Tasa: {r.tasaCambio} Bs/$ · {r.creadoPor.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={r.estado === "CERRADO" ? "success" : "warning"}>
            {r.estado === "CERRADO" ? "Cerrado" : "Borrador"}
          </Badge>
          {(canEditReports(role) && r.estado === "BORRADOR") || isAdmin(role) ? (
            <Button size="sm" asChild>
              <Link href={`/reportes/${id}/editar`}><Pencil className="h-4 w-4" /> Editar</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total USD", value: fmtUsd(totalGeneralUsd), color: "text-[var(--primary)]" },
          { label: "Total Bs.", value: fmtBs(totalGeneralBs), color: "" },
          { label: "Pacientes", value: fmtInt(totalConsultasPac + totalServiciosPac + totalCuentasPac), color: "" },
          { label: "% Clínica", value: fmtUsd(totalConsultasClinica), color: "text-emerald-600" },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-3">
              <div className="text-xs text-[var(--muted-foreground)]">{k.label}</div>
              <div className={`text-lg font-bold mt-0.5 ${k.color}`}>{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Consultas */}
      {consultasActivas.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Unidades de Consulta</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--muted)] text-left">
                  <tr>
                    <th className="p-3 font-medium">Especialidad</th>
                    <th className="p-3 font-medium text-right">Total $</th>
                    <th className="p-3 font-medium text-right">Total Bs.</th>
                    <th className="p-3 font-medium text-right">Pacientes</th>
                    <th className="p-3 font-medium text-right">% Clínica</th>
                  </tr>
                </thead>
                <tbody>
                  {consultasActivas.map((c) => (
                    <tr key={c.id} className="border-t border-[var(--border)]">
                      <td className="p-3">{c.especialidad.nombre}</td>
                      <td className="p-3 text-right">{fmtUsd(c.ingresoDivisa)}</td>
                      <td className="p-3 text-right">{fmtBs(c.totalBs)}</td>
                      <td className="p-3 text-right font-medium">{c.numPacientes}</td>
                      <td className="p-3 text-right text-[var(--primary)]">{fmtUsd(c.porcentajeClinica)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[var(--border)] bg-[var(--muted)] font-semibold">
                    <td className="p-3">Totales</td>
                    <td className="p-3 text-right">{fmtUsd(totalConsultasUsd)}</td>
                    <td className="p-3 text-right">{fmtBs(totalConsultasBs)}</td>
                    <td className="p-3 text-right">{fmtInt(totalConsultasPac)}</td>
                    <td className="p-3 text-right text-[var(--primary)]">{fmtUsd(totalConsultasClinica)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Servicios */}
      {serviciosActivos.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Laboratorio / Imágenes</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--muted)] text-left">
                  <tr>
                    <th className="p-3 font-medium">Unidad</th>
                    <th className="p-3 font-medium text-right">Total $</th>
                    <th className="p-3 font-medium text-right">Total Bs.</th>
                    <th className="p-3 font-medium text-right">Pacientes</th>
                  </tr>
                </thead>
                <tbody>
                  {serviciosActivos.map((s) => (
                    <tr key={s.id} className="border-t border-[var(--border)]">
                      <td className="p-3">{s.unidadServicio.nombre}</td>
                      <td className="p-3 text-right">{fmtUsd(s.ingresoDivisa)}</td>
                      <td className="p-3 text-right">{fmtBs(s.totalBs)}</td>
                      <td className="p-3 text-right font-medium">{s.numPacientes}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[var(--border)] bg-[var(--muted)] font-semibold">
                    <td className="p-3">Totales</td>
                    <td className="p-3 text-right">{fmtUsd(totalServiciosUsd)}</td>
                    <td className="p-3 text-right">{fmtBs(totalServiciosBs)}</td>
                    <td className="p-3 text-right">{fmtInt(totalServiciosPac)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pacientes área */}
      {r.pacientesArea.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Pacientes por Área</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {r.pacientesArea.map((p) => (
                <div key={p.id} className="text-center">
                  <div className="text-2xl font-bold">{p.numPacientes}</div>
                  <div className="text-xs text-[var(--muted-foreground)] capitalize">{p.area.toLowerCase()}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Anticipos */}
      {r.anticipos.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Anticipos</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--muted)] text-left">
                  <tr>
                    <th className="p-3 font-medium">Tipo</th>
                    <th className="p-3 font-medium">Paciente</th>
                    <th className="p-3 font-medium text-right">Total $</th>
                    <th className="p-3 font-medium text-right">Total Bs.</th>
                  </tr>
                </thead>
                <tbody>
                  {r.anticipos.map((a) => (
                    <tr key={a.id} className="border-t border-[var(--border)]">
                      <td className="p-3 capitalize">{a.tipo.toLowerCase()}</td>
                      <td className="p-3">{a.pacienteNombre || "—"}</td>
                      <td className="p-3 text-right">{fmtUsd(a.ingresoDivisa)}</td>
                      <td className="p-3 text-right">{fmtBs(a.totalBs)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[var(--border)] bg-[var(--muted)] font-semibold">
                    <td className="p-3" colSpan={2}>Totales</td>
                    <td className="p-3 text-right">{fmtUsd(totalAnticiposUsd)}</td>
                    <td className="p-3 text-right">{fmtBs(totalAnticiposBs)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cuentas por Cobrar / Convenios */}
      {r.cuentasPorCobrar.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Cuentas por Cobrar / Convenios</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--muted)] text-left">
                  <tr>
                    <th className="p-3 font-medium">Convenio / Aseguradora</th>
                    <th className="p-3 font-medium text-right">Total $</th>
                    <th className="p-3 font-medium text-right">Total Bs.</th>
                    <th className="p-3 font-medium text-right">Pacientes</th>
                    <th className="p-3 font-medium">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {r.cuentasPorCobrar.map((c) => (
                    <tr key={c.id} className="border-t border-[var(--border)]">
                      <td className="p-3 font-medium">{c.nombreConvenio}</td>
                      <td className="p-3 text-right">{c.ingresoDivisa > 0 ? fmtUsd(c.ingresoDivisa) : "—"}</td>
                      <td className="p-3 text-right">{c.totalBs > 0 ? fmtBs(c.totalBs) : "—"}</td>
                      <td className="p-3 text-right">{c.numPacientes > 0 ? c.numPacientes : "—"}</td>
                      <td className="p-3 text-[var(--muted-foreground)] text-xs">{c.comentarios || ""}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[var(--border)] bg-[var(--muted)] font-semibold">
                    <td className="p-3">Totales</td>
                    <td className="p-3 text-right">{fmtUsd(totalCuentasUsd)}</td>
                    <td className="p-3 text-right">{fmtBs(totalCuentasBs)}</td>
                    <td className="p-3 text-right">{fmtInt(totalCuentasPac)}</td>
                    <td className="p-3" />
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* APS */}
      {r.aps && (
        <Card>
          <CardHeader><CardTitle className="text-base">Unidad de APS</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div><div className="text-[var(--muted-foreground)]">Consultas</div><div className="font-bold text-lg">{r.aps.consultas}</div></div>
              <div><div className="text-[var(--muted-foreground)]">Lab / Imágenes</div><div className="font-bold text-lg">{r.aps.laboratoriosImagenes}</div></div>
              <div><div className="text-[var(--muted-foreground)]">Movimientos</div><div className="font-bold text-lg">{r.aps.movimientosDia}</div></div>
              <div><div className="text-[var(--muted-foreground)]">Facturados</div><div className="font-bold text-lg">{r.aps.totalFacturados}</div></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Total general */}
      <div className="rounded-xl border-2 border-[var(--primary)] bg-[var(--card)] p-4">
        <div className="text-sm font-semibold text-[var(--muted-foreground)] mb-3">TOTAL GENERAL</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div><div className="text-xs text-[var(--muted-foreground)]">Total USD</div><div className="text-2xl font-bold text-[var(--primary)]">{fmtUsd(totalGeneralUsd)}</div></div>
          <div><div className="text-xs text-[var(--muted-foreground)]">Total Bs.</div><div className="text-2xl font-bold">{fmtBs(totalGeneralBs)}</div></div>
          <div><div className="text-xs text-[var(--muted-foreground)]">Total Pacientes</div><div className="text-2xl font-bold">{fmtInt(totalConsultasPac + totalServiciosPac + totalCuentasPac)}</div></div>
        </div>
      </div>
    </div>
  );
}
