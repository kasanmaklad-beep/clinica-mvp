# Guía de despliegue — Hospital Clínicas del Este

## Requisitos previos
- Cuenta de GitHub ✅
- Proyecto subido a GitHub (ver paso 1)
- Cuenta en Neon (base de datos PostgreSQL gratuita)
- Cuenta en Vercel (hosting gratuito para Next.js)

---

## Paso 1 — Subir el código a GitHub

En la terminal, dentro de la carpeta del proyecto:

```bash
cd "MVP CLINICA"

# Inicializar git (si no está inicializado)
git init
git add .
git commit -m "Primera versión lista para producción"

# Crear repositorio en github.com y conectar:
git remote add origin https://github.com/TU-USUARIO/clinica-mvp.git
git branch -M main
git push -u origin main
```

---

## Paso 2 — Crear base de datos en Neon

1. Ir a **https://neon.tech** → Sign up (gratis)
2. Crear un proyecto: `clinica-del-este`
3. En el dashboard, copiar el **Connection string** (formato):
   ```
   postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
   ```
4. Guardar ese string — lo usarás en los pasos 3 y 4

---

## Paso 3 — Migrar los datos históricos a Neon

En la terminal local (una sola vez):

```bash
# Actualizar el archivo .env con la URL de Neon:
# DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"

# Crear las tablas en Neon:
npx prisma db push

# Cargar todos los datos históricos (297 reportes, consultas, etc.):
npm run db:seed-postgres
```

Esto tarda ~2-3 minutos. Al final verás "✅ Migración completa."

---

## Paso 4 — Desplegar en Vercel

1. Ir a **https://vercel.com** → Sign up con GitHub
2. Click "New Project" → seleccionar el repositorio `clinica-mvp`
3. En la sección **Environment Variables**, agregar:

| Variable | Valor |
|----------|-------|
| `DATABASE_URL` | La connection string de Neon |
| `AUTH_SECRET` | Valor del `.env` local (o generar uno nuevo) |
| `AUTH_TRUST_HOST` | `true` |

4. En **Build & Development Settings**:
   - Build Command: `npx prisma generate && next build`
   - (lo demás se deja como está)

5. Click **Deploy** → esperar ~2 minutos

6. Vercel te da una URL del tipo: `https://clinica-mvp.vercel.app`

---

## Resultado

- La app estará disponible en `https://clinica-mvp.vercel.app`
- Todos los roles (Admin, Capturista, Lector) funcionan
- El capturista accede desde cualquier ciudad con su usuario y contraseña
- Los datos se guardan en Neon (PostgreSQL, 512 MB gratis)

---

## Credenciales por defecto

```
Admin:      admin@clinica.com  /  admin123
```

⚠️ Cambiar la contraseña del admin desde la UI después del primer acceso (`/perfil`)

---

## Desarrollo local (después del deploy)

Para seguir desarrollando localmente, conectarse directamente a Neon:

```bash
# En .env local, usar la URL de Neon:
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
npm run dev
```

O usar la rama "dev" de Neon (separada de producción) para no mezclar datos.
