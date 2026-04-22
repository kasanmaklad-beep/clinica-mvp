"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Copy, Eye, EyeOff, KeyRound, Power, X } from "lucide-react";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, type Role } from "@/lib/roles";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  activo: boolean;
  createdAt: string;
}

function randomDigits(len = 6) {
  let out = "";
  const values = new Uint32Array(len);
  crypto.getRandomValues(values);
  for (let i = 0; i < len; i++) out += (values[i] % 10).toString();
  return out;
}

export function UsuariosClient({
  initialUsers,
  currentUserId,
}: {
  initialUsers: User[];
  currentUserId: string | null;
}) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(randomDigits());
  const [role, setRole] = useState<Role>("CAPTURISTA");
  const [showPwd, setShowPwd] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string } | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [resetPwd, setResetPwd] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  function openReset(u: User) {
    setResetUser(u);
    setResetPwd(randomDigits());
    setResetError(null);
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetUser) return;
    if (resetPwd.length < 6) {
      setResetError("La clave debe tener al menos 6 caracteres");
      return;
    }
    setResetLoading(true);
    setResetError(null);
    const res = await fetch(`/api/admin/usuarios/${resetUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: resetPwd }),
    });
    setResetLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setResetError(data.error || "No se pudo actualizar la clave");
      return;
    }
    setLastCreated({ email: resetUser.email, password: resetPwd });
    setResetUser(null);
    setResetPwd("");
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Error al crear usuario");
      return;
    }
    setUsers((prev) => [data.user, ...prev]);
    setLastCreated({ email, password });
    setName("");
    setEmail("");
    setPassword(randomDigits());
    setRole("CAPTURISTA");
    setOpen(false);
  }

  async function onToggleActive(u: User) {
    const res = await fetch(`/api/admin/usuarios/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !u.activo }),
    });
    if (res.ok) {
      const data = await res.json();
      setUsers((prev) => prev.map((x) => (x.id === u.id ? data.user : x)));
    }
  }


  async function onChangeRole(u: User, newRole: Role) {
    const res = await fetch(`/api/admin/usuarios/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      const data = await res.json();
      setUsers((prev) => prev.map((x) => (x.id === u.id ? data.user : x)));
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Administra accesos y roles del sistema
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      {lastCreated && (
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-emerald-900 dark:text-emerald-100">Credenciales generadas</div>
                <div className="text-sm mt-2 font-mono break-all">
                  <div><span className="opacity-70">Correo:</span> {lastCreated.email}</div>
                  <div><span className="opacity-70">Clave:</span> {lastCreated.password}</div>
                </div>
                <div className="text-xs mt-2 text-emerald-800 dark:text-emerald-300">
                  Copia estas credenciales y entrégalas al usuario. No podrás verla de nuevo.
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="outline" onClick={() => copy(`${lastCreated.email} / ${lastCreated.password}`)}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setLastCreated(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {open && (
        <Card>
          <CardHeader>
            <CardTitle>Crear usuario</CardTitle>
            <CardDescription>El usuario recibirá la contraseña que generes aquí</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nombre completo</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Correo</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="role">Rol</Label>
                <Select id="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  <option value="ADMIN">Administrador — {ROLE_DESCRIPTIONS.ADMIN}</option>
                  <option value="CAPTURISTA">Capturista — {ROLE_DESCRIPTIONS.CAPTURISTA}</option>
                  <option value="LECTOR">Lector — {ROLE_DESCRIPTIONS.LECTOR}</option>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="flex gap-2">
                  <Input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => setShowPwd((v) => !v)}>
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button type="button" variant="outline" size="icon" onClick={() => setPassword(randomDigits())} aria-label="Generar contraseña">
                    <KeyRound className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {error && (
                <p className="sm:col-span-2 text-sm text-[var(--destructive)] bg-red-50 dark:bg-red-950/30 rounded-md p-2">
                  {error}
                </p>
              )}
              <div className="sm:col-span-2 flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Creando..." : "Crear usuario"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {resetUser && (
        <Card className="border-[var(--primary)]/40">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>Nueva clave para {resetUser.name}</CardTitle>
                <CardDescription>{resetUser.email}</CardDescription>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setResetUser(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitReset} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="resetPwd">Clave</Label>
                <div className="flex gap-2">
                  <Input
                    id="resetPwd"
                    type="text"
                    value={resetPwd}
                    onChange={(e) => setResetPwd(e.target.value)}
                    minLength={6}
                    required
                    placeholder="mínimo 6 caracteres"
                    className="font-mono"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => setResetPwd(randomDigits())} aria-label="Generar 6 dígitos">
                    <KeyRound className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Puedes escribir una clave fácil de recordar o generar 6 dígitos con el botón.
                </p>
              </div>
              {resetError && (
                <p className="text-sm text-[var(--destructive)] bg-red-50 dark:bg-red-950/30 rounded-md p-2">
                  {resetError}
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setResetUser(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={resetLoading}>
                  {resetLoading ? "Guardando..." : "Guardar clave"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {/* Vista tabla para desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--muted)] text-left">
                <tr>
                  <th className="p-3 font-medium">Nombre</th>
                  <th className="p-3 font-medium">Correo</th>
                  <th className="p-3 font-medium">Rol</th>
                  <th className="p-3 font-medium">Estado</th>
                  <th className="p-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-[var(--border)]">
                    <td className="p-3 font-medium">{u.name}{u.id === currentUserId && <span className="ml-2 text-xs text-[var(--muted-foreground)]">(tú)</span>}</td>
                    <td className="p-3 text-[var(--muted-foreground)]">{u.email}</td>
                    <td className="p-3">
                      <Select
                        value={u.role}
                        onChange={(e) => onChangeRole(u, e.target.value as Role)}
                        disabled={u.id === currentUserId}
                        className="h-8 w-40"
                      >
                        <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
                        <option value="CAPTURISTA">{ROLE_LABELS.CAPTURISTA}</option>
                        <option value="LECTOR">{ROLE_LABELS.LECTOR}</option>
                      </Select>
                    </td>
                    <td className="p-3">
                      {u.activo ? (
                        <Badge tone="success">Activo</Badge>
                      ) : (
                        <Badge tone="danger">Inactivo</Badge>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={() => openReset(u)}>
                        <KeyRound className="h-3.5 w-3.5" /> Clave
                      </Button>
                      <Button
                        size="sm"
                        variant={u.activo ? "outline" : "primary"}
                        onClick={() => onToggleActive(u)}
                        disabled={u.id === currentUserId}
                      >
                        <Power className="h-3.5 w-3.5" />
                        {u.activo ? "Desactivar" : "Activar"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Vista cards para mobile */}
          <div className="md:hidden divide-y divide-[var(--border)]">
            {users.map((u) => (
              <div key={u.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {u.name}
                      {u.id === currentUserId && <span className="ml-2 text-xs text-[var(--muted-foreground)]">(tú)</span>}
                    </div>
                    <div className="text-sm text-[var(--muted-foreground)] truncate">{u.email}</div>
                  </div>
                  {u.activo ? <Badge tone="success">Activo</Badge> : <Badge tone="danger">Inactivo</Badge>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Rol</Label>
                  <Select
                    value={u.role}
                    onChange={(e) => onChangeRole(u, e.target.value as Role)}
                    disabled={u.id === currentUserId}
                  >
                    <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
                    <option value="CAPTURISTA">{ROLE_LABELS.CAPTURISTA}</option>
                    <option value="LECTOR">{ROLE_LABELS.LECTOR}</option>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openReset(u)} className="flex-1">
                    <KeyRound className="h-3.5 w-3.5" /> Nueva clave
                  </Button>
                  <Button
                    size="sm"
                    variant={u.activo ? "outline" : "primary"}
                    onClick={() => onToggleActive(u)}
                    disabled={u.id === currentUserId}
                    className="flex-1"
                  >
                    <Power className="h-3.5 w-3.5" />
                    {u.activo ? "Desactivar" : "Activar"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
