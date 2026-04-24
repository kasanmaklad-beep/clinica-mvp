"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  ClipboardList,
  FileSpreadsheet,
  History,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Stethoscope,
  KeyRound,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Role = "ADMIN" | "CAPTURISTA" | "LECTOR";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "CAPTURISTA", "LECTOR"] },
  { href: "/reportes/nuevo", label: "Nuevo reporte", icon: ClipboardList, roles: ["ADMIN", "CAPTURISTA"] },
  { href: "/reportes", label: "Histórico", icon: History, roles: ["ADMIN", "CAPTURISTA", "LECTOR"] },
  { href: "/cartera", label: "Cartera", icon: Wallet, roles: ["ADMIN", "CAPTURISTA", "LECTOR"] },
  { href: "/importar", label: "Importar reporte", icon: FileSpreadsheet, roles: ["ADMIN", "CAPTURISTA"] },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users, roles: ["ADMIN"] },
  { href: "/admin/catalogos", label: "Catálogos", icon: Settings, roles: ["ADMIN"] },
];

export function AppShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const role = user.role as Role;
  const items = NAV.filter((n) => n.roles.includes(role));

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Topbar móvil */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)]/90 backdrop-blur px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
            <Stethoscope className="h-4 w-4" />
          </div>
          <span className="font-semibold text-sm">Clínicas del Este</span>
        </div>
        <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Abrir menú">
          <Menu className="h-5 w-5" />
        </Button>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:border-r lg:border-[var(--border)] lg:bg-[var(--card)]",
          "fixed inset-0 z-40 w-72 bg-[var(--card)] border-r border-[var(--border)] transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-2 p-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-sm leading-tight">Clínicas del Este</div>
                <div className="text-xs text-[var(--muted-foreground)]">Reportes operativos</div>
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => setOpen(false)} className="lg:hidden" aria-label="Cerrar">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 overflow-y-auto p-2">
            <ul className="space-y-1">
              {items.map((item) => {
                const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                        active
                          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                          : "hover:bg-[var(--muted)]",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="border-t border-[var(--border)] p-3 space-y-2">
            <div className="px-2 py-1">
              <div className="text-sm font-medium truncate">{user.name}</div>
              <div className="text-xs text-[var(--muted-foreground)] truncate">{user.email}</div>
              <div className="text-xs mt-1 inline-block rounded-full bg-[var(--accent)] text-[var(--primary)] px-2 py-0.5">
                {role === "ADMIN" ? "Administrador" : role === "CAPTURISTA" ? "Capturista" : "Lector"}
              </div>
            </div>
            <Link
              href="/perfil"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[var(--muted)] transition-colors w-full"
            >
              <KeyRound className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
              <span>Cambiar contraseña</span>
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay mobile */}
      {open && (
        <button
          className="lg:hidden fixed inset-0 z-30 bg-black/40"
          onClick={() => setOpen(false)}
          aria-label="Cerrar menú"
        />
      )}

      {/* Contenido */}
      <main className="flex-1 min-w-0">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
