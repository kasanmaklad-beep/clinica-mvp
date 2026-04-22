# Hospital Clínicas del Este — MVP Reportes Operativos
> Documento maestro del proyecto · Última actualización: 2026-04-21

---

## Descripción general
Aplicación web de reportes operativos para Hospital Clínicas del Este (Venezuela).
Permite registrar, visualizar y analizar los ingresos diarios en bolívares y dólares.

**Stack:** Next.js 16 App Router · TypeScript · Prisma 6 + SQLite · NextAuth v5 beta · Recharts 3

**URL local:** `http://localhost:3000` (o IP de red `http://10.0.0.X:3000`)
**Arranque:** `npm run dev -- --hostname 0.0.0.0`

---

## Estructura del proyecto

```
MVP CLINICA/
├── prisma/
│   ├── schema.prisma          # Modelo de datos
│   └── dev.db                 # Base de datos SQLite
├── scripts/
│   └── seed-historico.ts      # Importador de 297 PDFs históricos
├── src/
│   ├── app/
│   │   ├── (app)/
│   │   │   ├── page.tsx                    # Dashboard ejecutivo (server)
│   │   │   ├── dashboard-client.tsx        # Dashboard (client component)
│   │   │   ├── reportes/
│   │   │   │   ├── page.tsx                # Histórico (mes→día drill-down)
│   │   │   │   ├── nuevo/page.tsx          # Crear reporte
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx            # Detalle del reporte
│   │   │   │       └── editar/page.tsx     # Editar reporte
│   │   │   └── admin/
│   │   │       ├── catalogos/              # Especialidades, Unidades, Aseguradoras
│   │   │       └── usuarios/               # Gestión de usuarios
│   │   └── api/
│   │       ├── reportes/[id]/route.ts      # GET/PATCH reporte individual
│   │       ├── admin/catalogos/
│   │       │   └── unidades/route.ts       # POST/PATCH unidades de servicio
│   │       └── admin/usuarios/             # CRUD usuarios
│   ├── lib/
│   │   ├── prisma.ts           # Cliente Prisma singleton
│   │   ├── roles.ts            # isAdmin(), canEditReports()
│   │   └── utils.ts            # fmtUsd(), fmtBs(), fmtInt(), cn()
│   └── components/
│       └── ui/                 # Button, Card, Badge, Input...
└── docs/
    └── PROYECTO.md             # Este archivo
```

---

## Modelo de datos clave

### Lógica de doble moneda (CRÍTICO)
- `totalBs` = ingreso total en Bolívares (incluye equivalente en Bs de los pagos en USD)
- `ingresoDivisa` = efectivo físico en USD recibido ese día (subconjunto, ya incluido en totalBs)
- **NUNCA sumar** `ingresoDivisa × tasa + totalBs` → doble conteo
- **Conversión correcta:** `totalBs ÷ tasaCambio` = equivalente USD del día

### Ingreso real de la clínica
- **Consultas:** `porcentajeClinica = numPacientes × honorarioClinica` (honorario fijo en USD)
- **Laboratorio / Imágenes:** `totalBs ÷ tasaCambio` (servicio 100% de la clínica)
- **Anticipos:** `totalBs ÷ tasaCambio`
- **Convenios:** `totalBs ÷ tasaCambio`

### UnidadServicio — campo `categoria`
- `LABORATORIO`: Laboratorio, Laboratorio/Emergencia, Anatomía Patológica, Banco de Sangre, Emergencia
- `IMAGENES`: Imágenes, Imágenes/Emergencia
- `SERVICIO`: otros

---

## Roles de acceso
| Rol | Permisos |
|-----|---------|
| ADMIN | Todo: crear, editar (incluso cerrados), catalogos, usuarios |
| CAPTURISTA | Crear y editar reportes en borrador |
| LECTOR | Solo lectura |

**Contraseña admin por defecto:** `admin123` (cambiar en producción)

---

## Funcionalidades completadas

### 1. Importación histórica (297 PDFs)
- Script: `scripts/seed-historico.ts`
- Comando: `npx tsx scripts/seed-historico.ts`
- Importa: consultas, servicios, pacientes por área, anticipos, cuentas por cobrar, APS
- Parseador de tasa de cambio para líneas divididas
- Alias "Oftamología" → "Oftalmología"
- Corrección de posiciones de columnas para PDFs de formato antiguo

### 2. Gestión de reportes
- Crear / editar reporte diario con todas las secciones
- Cierre de reportes (BORRADOR → CERRADO)
- Vista detallada con totales por sección
- Exportación Excel individual

### 3. Histórico (`/reportes`)
- Vista mes-primero con `<details>` nativo (sin JS extra)
- Primer mes abierto automáticamente, resto colapsado
- Cada mes: USD total, Bs., pacientes, días, trend ↑↓ vs mes anterior
- Drill-down a días con USD destacado en ámbar

### 4. Dashboard ejecutivo (`/`)
#### Vista mensual (superior)
- **Hero del mes:** ingreso clínica en USD (verde, 5xl), Bs equivalente, pacientes, $/pac., vs mes anterior
- **Tendencia 12 meses:** bar chart con `porcentajeClinica` + `totalBs÷tasa` por mes
- **Ingresos por área:** 5 barras (Consultas/Lab/Imágenes/Anticipos/Convenios) con USD + Bs + pacientes + $/pac.
  - *El total del hero siempre coincide con la suma de las 5 áreas*
- **Top 5 especialidades:** ordenado por ingreso clínica, con ↑↓ vs mes anterior
- **Análisis automático:** bullets con crecimiento, $/pac., mejor día, proyección a fin de mes

#### Detalle del día (inferior)
- Navegación ← → por día
- KPIs: `% Clínica $` (primario), `% Clínica Bs.`, Pacientes, Facturado $
- Secciones plegables con `≈ $` (Bs÷tasa) en todas las tablas:
  - **Consultas** (azul)
  - **Laboratorio** (verde, separado de Imágenes)
  - **Imágenes** (cyan, departamento independiente)
  - **Anticipos** (naranja)
  - **Cuentas por Cobrar / Convenios** (sky)
  - Pacientes por área, APS

### 5. Administración
- Gestión de usuarios (crear, activar/desactivar, cambiar rol)
- Catálogos: Especialidades, Unidades de Servicio (con campo `categoria`), Aseguradoras
- Al agregar nueva Unidad: seleccionar categoría (Laboratorio / Imágenes / Servicio)

---

## Pasos siguientes (backlog priorizado)

### 🔴 Alta prioridad
1. **Exportación mensual / período** — PDF o Excel con totales del mes para directivos
2. **Producción** — Migrar de SQLite a PostgreSQL (Neon/Supabase), deploy en Vercel/Railway
3. **Cambio de contraseñas** — El admin debe poder cambiar su contraseña desde la UI

### 🟡 Media prioridad
4. **Formulario de captura mejorado** — Guardar automáticamente borradores, validación más clara
5. **Exportar detalle del día** — PDF del reporte diario para imprimir / archivar
6. **Dashboard histórico navegable** — Ver cualquier mes pasado en el ejecutivo (ahora solo muestra el mes actual)
7. **Metas / presupuesto** — Comparar ingreso real vs meta mensual por área
8. **Corregir PDFs con advertencias** — 791 PDFs de Feb 2025 con columnas en formato antiguo

### 🟢 Baja prioridad / futuro
9. **Notificaciones** — Alerta si no se capturó reporte del día
10. **Acceso por área** — CAPTURISTA solo ve su área (Lab vs Consultas)
11. **Multi-sede** — Si hay más hospitales del grupo
12. **App móvil** — PWA para captura desde tablet

---

## Comandos útiles

```bash
# Arrancar servidor
npm run dev -- --hostname 0.0.0.0

# Importar PDFs históricos
npx tsx scripts/seed-historico.ts

# Aplicar cambios de schema sin perder datos
npx prisma db push

# Regenerar cliente Prisma
npx prisma generate

# Abrir Prisma Studio (explorador visual de BD)
npx prisma studio

# Verificar tipos TypeScript
npx tsc --noEmit

# Reset contraseña admin (desde Node)
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();
bcrypt.hash('NUEVA_CONTRASEÑA', 10).then(h => 
  p.user.update({ where: { email: 'admin@clinica.com' }, data: { passwordHash: h } })
  .then(() => { console.log('OK'); p.\$disconnect(); })
);
"
```

---

## Decisiones técnicas importantes

| Decisión | Razón |
|----------|-------|
| SQLite en dev | Simplicidad, sin servidor. Migrar a PostgreSQL para producción. |
| `db push` en vez de `migrate` | La BD fue creada sin historial de migraciones. Usar `db push` para cambios de schema. |
| `porcentajeClinica` solo en consultas | Lab/Imágenes son 100% de la clínica → usar `totalBs÷tasa` como equivalente |
| `ingresoDivisa` casi siempre 0 | El hospital cobra principalmente en Bs. Solo algunos pacientes pagan en USD efectivo. |
| `<details>` nativo en histórico | Drill-down sin estado React → renderizado en servidor, más rápido |
| `totalBs÷tasa` como equiv. USD | Correcto para Venezuela: casi todo en Bs, la tasa varía por día |
