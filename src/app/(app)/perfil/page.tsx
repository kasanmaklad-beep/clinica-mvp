"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, KeyRound, CheckCircle } from "lucide-react";

export default function PerfilPage() {
  const [current, setCurrent]     = useState("");
  const [next, setNext]           = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState(false);

  const mismatch = next.length > 0 && confirm.length > 0 && next !== confirm;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/perfil/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo cambiar la contraseña");
      return;
    }
    setSuccess(true);
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Mi perfil</h1>
        <p className="text-[var(--muted-foreground)] mt-1">Cambia tu contraseña de acceso</p>
      </div>

      {success && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 p-4">
          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-emerald-900 dark:text-emerald-100">Contraseña actualizada</div>
            <p className="text-sm text-emerald-800 dark:text-emerald-300 mt-0.5">
              La próxima vez que inicies sesión usa tu nueva contraseña.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-[var(--primary)]" />
            <div>
              <CardTitle>Cambiar contraseña</CardTitle>
              <CardDescription>Mínimo 6 caracteres</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">

            {/* Contraseña actual */}
            <div className="space-y-1.5">
              <Label htmlFor="current">Contraseña actual</Label>
              <div className="flex gap-2">
                <Input
                  id="current"
                  type={showCurrent ? "text" : "password"}
                  value={current}
                  onChange={e => { setCurrent(e.target.value); setSuccess(false); }}
                  required
                  autoComplete="current-password"
                />
                <Button type="button" variant="outline" size="icon" onClick={() => setShowCurrent(v => !v)}>
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Nueva contraseña */}
            <div className="space-y-1.5">
              <Label htmlFor="next">Nueva contraseña</Label>
              <div className="flex gap-2">
                <Input
                  id="next"
                  type={showNext ? "text" : "password"}
                  value={next}
                  onChange={e => { setNext(e.target.value); setSuccess(false); }}
                  minLength={6}
                  required
                  autoComplete="new-password"
                />
                <Button type="button" variant="outline" size="icon" onClick={() => setShowNext(v => !v)}>
                  {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Confirmar nueva contraseña */}
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirmar nueva contraseña</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setSuccess(false); }}
                minLength={6}
                required
                autoComplete="new-password"
                className={mismatch ? "border-red-400 focus-visible:ring-red-400" : ""}
              />
              {mismatch && (
                <p className="text-xs text-[var(--destructive)]">Las contraseñas no coinciden</p>
              )}
            </div>

            {error && (
              <p className="text-sm text-[var(--destructive)] bg-red-50 dark:bg-red-950/30 rounded-md p-2">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading || mismatch} className="w-full">
              {loading ? "Guardando..." : "Cambiar contraseña"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
