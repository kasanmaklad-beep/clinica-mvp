# Clínica HCE — MVP Reportes (ACTIVO)

**Cliente:** Hospital Clínicas del Este  
**Estado:** Producción — desplegado en Railway  
**Admin:** kasanmaklad@gmail.com

## Stack
- Next.js 16 App Router + TypeScript
- Prisma 6 + SQLite (dev) / PostgreSQL (Railway)
- NextAuth v5 beta (credentials/JWT)
- Recharts 3, date-fns/es, Tailwind CSS

## Arrancar local
```bash
cd ~/Proyectos/clinica-hce
npm run dev -- --hostname 0.0.0.0
# http://localhost:3000
```

## Roles
- **ADMIN:** admin@clinica.com / admin123
- **CAPTURISTA:** create/edit reportes
- **LECTOR:** solo lectura

## Archivos clave
- `src/app/(app)/page.tsx` — dashboard servidor
- `src/app/(app)/dashboard-client.tsx` — vista ejecutiva
- `src/app/(app)/reportes/page.tsx` — lista histórica
- `prisma/schema.prisma` — modelo de datos
- `scripts/seed-historico.ts` — importación 297 PDFs

## Base de datos
```bash
npx prisma studio
npm run db:push
npm run db:seed
```

## Documentación completa
`docs/PROYECTO.md`
