# 🏥 Clínica HCE — Reportes

**Cliente:** Hospital Clínicas del Este
**Estado:** 🟢 PRODUCCIÓN
**Última actividad:** 25 abril 2026
**Deploy:** https://hcereporte.up.railway.app
**Repo:** https://github.com/kasanmaklad-beep/clinica-mvp
**Railway project:** HCEreportes

---

## ¿Qué hace?

Genera reportes mensuales de la clínica desde PDFs de facturación, con dashboard
ejecutivo, exportación a Excel y desglose por componente.

## Arrancar local

```bash
cd ~/Proyectos/01-activos/clinica-hce
npm run dev -- --hostname 0.0.0.0
# http://localhost:3000
```

## Roles del sistema

- **ADMIN:** `admin@clinica.com` / `admin123`
- **CAPTURISTA** — captura de reportes
- **LECTOR** — solo lectura

## Stack

Next.js 16 (App Router) · TypeScript · Prisma 6 · Postgres (Railway) / SQLite (dev)
NextAuth v5 · Tailwind · Recharts

## Archivos clave

- `src/app/(app)/page.tsx` — dashboard servidor
- `src/app/(app)/dashboard-client.tsx` — vista ejecutiva
- `src/app/(app)/reportes/page.tsx` — lista histórica
- `prisma/schema.prisma` — modelo de datos
- `scripts/seed-historico.ts` — importación de PDFs históricos
- `docs/PROYECTO.md` — documentación completa
