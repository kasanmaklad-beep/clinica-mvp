export const ROLES = {
  ADMIN: "ADMIN",
  CAPTURISTA: "CAPTURISTA",
  LECTOR: "LECTOR",
} as const;

export type Role = keyof typeof ROLES;

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  CAPTURISTA: "Capturista",
  LECTOR: "Lector",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "Acceso total: usuarios, catálogos, reportes y dashboard",
  CAPTURISTA: "Puede crear, editar y cerrar reportes",
  LECTOR: "Solo lectura: dashboard e histórico",
};

export function canEditReports(role: string | undefined | null): boolean {
  return role === "ADMIN" || role === "CAPTURISTA";
}

export function isAdmin(role: string | undefined | null): boolean {
  return role === "ADMIN";
}
