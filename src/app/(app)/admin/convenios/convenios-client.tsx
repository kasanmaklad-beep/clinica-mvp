"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtUsd, fmtBs, fmtInt } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Search,
  AlertTriangle,
  Merge,
  ArrowRight,
  CheckCircle,
  X,
  Loader2,
} from "lucide-react";

export interface ConvenioRow {
  nombre: string;
  tipo: "SEGURO" | "ANUALIDAD" | "OTRO";
  apariciones: number;
  saldoActualBs: number;
  saldoActualUsd: number;
  primeraFecha: string;
  ultimaFecha: string;
}

export interface DuplicadoPar {
  a: string;
  b: string;
  distancia: number;
  aparA: number;
  aparB: number;
  saldoA: number;
  saldoB: number;
  tipoA: "SEGURO" | "ANUALIDAD" | "OTRO";
  tipoB: "SEGURO" | "ANUALIDAD" | "OTRO";
}

interface Props {
  convenios: ConvenioRow[];
  duplicados: DuplicadoPar[];
  totalDuplicados: number;
}

export function ConveniosClient({ convenios, duplicados, totalDuplicados }: Props) {
  const router = useRouter();
  const [filtro, setFiltro] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<"TODOS" | "SEGURO" | "ANUALIDAD" | "OTRO">("TODOS");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [mergeModal, setMergeModal] = useState<{
    variantes: string[];
    canonicoSugerido: string;
  } | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);

  const visibles = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return convenios.filter((c) => {
      if (tipoFiltro !== "TODOS" && c.tipo !== tipoFiltro) return false;
      if (q && !c.nombre.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [convenios, filtro, tipoFiltro]);

  function toggleSel(nombre: string) {
    const next = new Set(seleccionados);
    if (next.has(nombre)) next.delete(nombre);
    else next.add(nombre);
    setSeleccionados(next);
  }

  function abrirMergeManual() {
    if (seleccionados.size < 2) {
      setMensaje({ tipo: "err", texto: "Selecciona al menos 2 convenios para unir" });
      return;
    }
    // Sugerir canónico: el de más apariciones
    const rows = convenios.filter((c) => seleccionados.has(c.nombre));
    rows.sort((a, b) => b.apariciones - a.apariciones);
    setMergeModal({
      variantes: rows.map((r) => r.nombre),
      canonicoSugerido: rows[0].nombre,
    });
  }

  function abrirMergePar(par: DuplicadoPar) {
    const canonicoSugerido = par.aparA >= par.aparB ? par.a : par.b;
    setMergeModal({
      variantes: [par.a, par.b],
      canonicoSugerido,
    });
  }

  async function ejecutarMerge(canonico: string, variantes: string[]) {
    setAplicando(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/admin/convenios/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canonico, variantes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMensaje({ tipo: "err", texto: data.error || "Error al unir convenios" });
      } else {
        setMensaje({
          tipo: "ok",
          texto: `${data.actualizadas} fila(s) renombradas a "${data.canonico}"`,
        });
        setSeleccionados(new Set());
        setMergeModal(null);
        // Refrescar datos de servidor
        router.refresh();
      }
    } catch {
      setMensaje({ tipo: "err", texto: "Error de conexión" });
    } finally {
      setAplicando(false);
    }
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Convenios</h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">
          Normalización y unificación de nombres de convenios en cuentas por cobrar.
        </p>
      </div>

      {/* Mensaje */}
      {mensaje && (
        <Card
          className={
            mensaje.tipo === "ok"
              ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20"
              : "border-red-300 bg-red-50 dark:bg-red-950/20"
          }
        >
          <CardContent className="py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              {mensaje.tipo === "ok" ? (
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              )}
              <span className={mensaje.tipo === "ok" ? "text-emerald-900 dark:text-emerald-200" : "text-red-900 dark:text-red-200"}>
                {mensaje.texto}
              </span>
            </div>
            <button
              onClick={() => setMensaje(null)}
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <X className="h-4 w-4" />
            </button>
          </CardContent>
        </Card>
      )}

      {/* Sugerencias de duplicados */}
      {duplicados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Posibles duplicados
              <Badge tone="warning">{totalDuplicados}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-[var(--muted-foreground)] mb-2">
              Pares de nombres similares detectados por distancia ortográfica.
              Revisa cada par: si son el mismo convenio, haz click en &quot;Unir&quot;.
              {totalDuplicados > duplicados.length &&
                ` Mostrando los primeros ${duplicados.length} de ${totalDuplicados}.`}
            </p>
            <div className="space-y-2">
              {duplicados.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--muted)]/30"
                >
                  <span className="text-xs text-[var(--muted-foreground)] w-12 shrink-0">
                    d={p.distancia}
                  </span>
                  <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        tone={p.tipoA === "SEGURO" ? "success" : p.tipoA === "ANUALIDAD" ? "warning" : "default"}
                        className="shrink-0"
                      >
                        {p.tipoA[0]}
                      </Badge>
                      <span className="font-medium truncate">{p.a}</span>
                      <span className="text-xs text-[var(--muted-foreground)] shrink-0">
                        [{p.aparA}×]
                      </span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        tone={p.tipoB === "SEGURO" ? "success" : p.tipoB === "ANUALIDAD" ? "warning" : "default"}
                        className="shrink-0"
                      >
                        {p.tipoB[0]}
                      </Badge>
                      <span className="font-medium truncate">{p.b}</span>
                      <span className="text-xs text-[var(--muted-foreground)] shrink-0">
                        [{p.aparB}×]
                      </span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => abrirMergePar(p)}>
                    <Merge className="h-3.5 w-3.5" /> Unir
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros + acciones */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--muted-foreground)]" />
          <input
            type="text"
            placeholder="Buscar convenio..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>
        {(["TODOS", "SEGURO", "ANUALIDAD", "OTRO"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTipoFiltro(t)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              tipoFiltro === t
                ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                : "border-[var(--border)] hover:bg-[var(--muted)]"
            }`}
          >
            {t === "TODOS" ? "Todos" : t === "SEGURO" ? "Seguros" : t === "ANUALIDAD" ? "Anualidad" : "Otros"}
          </button>
        ))}
        {seleccionados.size >= 2 && (
          <Button size="sm" onClick={abrirMergeManual}>
            <Merge className="h-4 w-4" /> Unir {seleccionados.size} seleccionados
          </Button>
        )}
        {seleccionados.size > 0 && (
          <Button size="sm" variant="outline" onClick={() => setSeleccionados(new Set())}>
            Limpiar selección
          </Button>
        )}
      </div>

      {/* Tabla convenios */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--muted)] text-left">
                <tr>
                  <th className="p-3 w-10"></th>
                  <th className="p-3 font-medium">Convenio</th>
                  <th className="p-3 font-medium">Tipo</th>
                  <th className="p-3 font-medium text-right">Apariciones</th>
                  <th className="p-3 font-medium text-right">Saldo Bs</th>
                  <th className="p-3 font-medium text-right">Saldo $</th>
                  <th className="p-3 font-medium">Rango</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((c) => {
                  const sel = seleccionados.has(c.nombre);
                  return (
                    <tr
                      key={c.nombre}
                      className={`border-t border-[var(--border)] hover:bg-[var(--muted)]/40 cursor-pointer ${
                        sel ? "bg-[var(--primary)]/10" : ""
                      }`}
                      onClick={() => toggleSel(c.nombre)}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={sel}
                          onChange={() => toggleSel(c.nombre)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="p-3 font-medium">{c.nombre}</td>
                      <td className="p-3">
                        <Badge
                          tone={
                            c.tipo === "SEGURO"
                              ? "success"
                              : c.tipo === "ANUALIDAD"
                              ? "warning"
                              : "default"
                          }
                        >
                          {c.tipo === "SEGURO"
                            ? "Seguro"
                            : c.tipo === "ANUALIDAD"
                            ? "Anualidad"
                            : "Otro"}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">{fmtInt(c.apariciones)}</td>
                      <td className="p-3 text-right text-xs">{fmtBs(c.saldoActualBs)}</td>
                      <td className="p-3 text-right text-amber-600 font-medium">
                        {fmtUsd(c.saldoActualUsd)}
                      </td>
                      <td className="p-3 text-xs text-[var(--muted-foreground)]">
                        {format(new Date(c.primeraFecha), "dd/MM/yy", { locale: es })}
                        {" → "}
                        {format(new Date(c.ultimaFecha), "dd/MM/yy", { locale: es })}
                      </td>
                    </tr>
                  );
                })}
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-[var(--muted-foreground)]">
                      Sin resultados.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-[var(--muted)]/50 text-xs text-[var(--muted-foreground)]">
                <tr className="border-t">
                  <td colSpan={7} className="p-3">
                    Mostrando {visibles.length} de {convenios.length} convenios únicos
                    {seleccionados.size > 0 && ` · ${seleccionados.size} seleccionados`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de merge */}
      {mergeModal && (
        <MergeModal
          variantes={mergeModal.variantes}
          canonicoInicial={mergeModal.canonicoSugerido}
          aplicando={aplicando}
          onCancel={() => setMergeModal(null)}
          onConfirm={(canonico) => ejecutarMerge(canonico, mergeModal.variantes)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Modal de confirmación
// ══════════════════════════════════════════════════════════════
function MergeModal({
  variantes,
  canonicoInicial,
  aplicando,
  onCancel,
  onConfirm,
}: {
  variantes: string[];
  canonicoInicial: string;
  aplicando: boolean;
  onCancel: () => void;
  onConfirm: (canonico: string) => void;
}) {
  const [canonico, setCanonico] = useState(canonicoInicial);
  const [nombreCustom, setNombreCustom] = useState("");
  const [usarCustom, setUsarCustom] = useState(false);

  const canonicoFinal = usarCustom ? nombreCustom.trim() : canonico;
  const aRenombrar = variantes.filter((v) => v !== canonicoFinal);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Merge className="h-4 w-4" />
            Unificar convenios
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
              Nombre canónico (destino)
            </div>
            <div className="space-y-2">
              {variantes.map((v) => (
                <label
                  key={v}
                  className="flex items-center gap-2 p-2 rounded-md border border-[var(--border)] hover:bg-[var(--muted)]/40 cursor-pointer text-sm"
                >
                  <input
                    type="radio"
                    name="canonico"
                    checked={!usarCustom && canonico === v}
                    onChange={() => {
                      setCanonico(v);
                      setUsarCustom(false);
                    }}
                  />
                  <span className="font-medium">{v}</span>
                </label>
              ))}
              <label className="flex items-center gap-2 p-2 rounded-md border border-[var(--border)] hover:bg-[var(--muted)]/40 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="canonico"
                  checked={usarCustom}
                  onChange={() => setUsarCustom(true)}
                />
                <span className="text-[var(--muted-foreground)]">Otro:</span>
                <input
                  type="text"
                  placeholder="Nombre personalizado"
                  value={nombreCustom}
                  onChange={(e) => {
                    setNombreCustom(e.target.value);
                    setUsarCustom(true);
                  }}
                  className="flex-1 px-2 py-1 rounded border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </label>
            </div>
          </div>

          {aRenombrar.length > 0 && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-300 p-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-200 mb-2">
                Se renombrarán
              </div>
              <ul className="space-y-1">
                {aRenombrar.map((v) => (
                  <li key={v} className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                    <span className="truncate">{v}</span>
                    <ArrowRight className="h-3 w-3 shrink-0" />
                    <span className="font-semibold truncate">{canonicoFinal || "—"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onCancel} disabled={aplicando}>
              Cancelar
            </Button>
            <Button
              onClick={() => canonicoFinal && onConfirm(canonicoFinal)}
              disabled={!canonicoFinal || aRenombrar.length === 0 || aplicando}
            >
              {aplicando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Aplicando...
                </>
              ) : (
                <>
                  <Merge className="h-4 w-4" /> Confirmar unión
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
