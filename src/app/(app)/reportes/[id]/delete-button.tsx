"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  id: string;
  fecha: string; // ISO
}

/**
 * Botón de eliminación con doble confirmación.
 * Paso 1: usuario hace click en "Eliminar".
 * Paso 2: aparece un panel modal con la fecha del reporte y exige escribir
 *         la palabra ELIMINAR para habilitar el botón final.
 * Paso 3: confirma → DELETE /api/reportes/:id → redirige a /reportes.
 *
 * El backend (DELETE handler) ya valida que el usuario sea ADMIN.
 */
export function DeleteReportButton({ id, fecha }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fechaLabel = format(new Date(fecha), "EEEE d 'de' MMMM yyyy", {
    locale: es,
  });
  const canConfirm = typed.trim().toUpperCase() === "ELIMINAR" && !loading;

  const reset = () => {
    setOpen(false);
    setTyped("");
    setError(null);
  };

  const onDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reportes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Error ${res.status}`);
      }
      router.push("/reportes");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => setOpen(true)}
        title="Eliminar este reporte"
      >
        <Trash2 className="h-4 w-4" /> Eliminar
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => e.target === e.currentTarget && !loading && reset()}
        >
          <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
            <div className="p-5 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-base">Eliminar reporte</h2>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Esta acción no se puede deshacer
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4 text-sm">
              <p>
                Vas a eliminar permanentemente el reporte de{" "}
                <strong className="capitalize">{fechaLabel}</strong> y todas sus
                líneas (consultas, servicios, anticipos, cuentas por cobrar,
                pacientes y APS).
              </p>

              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100">
                <strong>Para confirmar</strong>, escribe la palabra{" "}
                <code className="font-mono font-bold">ELIMINAR</code> en
                mayúsculas:
              </div>

              <input
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={loading}
                autoFocus
                placeholder="ELIMINAR"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
              />

              {error && (
                <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-200">
                  {error}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--border)] bg-[var(--muted)]/30">
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onDelete}
                disabled={!canConfirm}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Eliminando…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" /> Confirmar eliminación
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
