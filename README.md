# Inventarios — Toma de Inventarios Multi-punto

Aplicación web mobile-first para digitalizar la toma de inventarios mensuales.

## Stack

- Next.js 14 (App Router) + TypeScript
- PostgreSQL (Supabase) + Prisma ORM
- NextAuth.js (Credentials + JWT)
- Tailwind CSS
- html5-qrcode (escaneo de códigos de barras)
- exceljs (exportación/carga — próximas fases)

## Configuración

1. Copia las variables de entorno:

```bash
cp .env.example .env
```

2. Configura `DATABASE_URL` con tu connection string de Supabase Postgres.

3. Genera `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32
```

4. Instala dependencias y prepara la base de datos:

```bash
npm install
npm run db:migrate
npm run db:seed
```

5. Inicia el servidor de desarrollo:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Usuarios de prueba (seed)

| Rol        | Email                      | Contraseña   |
|------------|----------------------------|--------------|
| Supervisor | supervisor@inventario.com  | Admin123!    |
| Tomador    | tomador@inventario.com     | Tomador123!  |

El seed crea 8 puntos iniciales, 3 productos de demo y un inventario activo con una área asignada al tomador.

## Estructura de rutas

```
/app/(auth)/login          → Login
/app/(tomador)/tomador     → Dashboard tomador
/app/(tomador)/tomador/area/[id] → Conteo con escaneo
/app/(supervisor)/supervisor     → Panel supervisor (placeholder)
/app/api/*                 → API REST
```

## Estado del entregable inicial

- [x] Proyecto Next.js + Tailwind + Prisma
- [x] Schema Prisma completo
- [x] NextAuth con Credentials Provider
- [x] Migraciones + seed (8 puntos + supervisor)
- [x] Middleware con protección por rol
- [x] Login + dashboard tomador + escaneo + guardado de conteos
- [x] **Fase 2:** CRUD Puntos y Áreas en `/supervisor/puntos`
- [x] **Fase 3:** Catálogo de productos en `/supervisor/productos` (CRUD + Excel)
- [x] **Fase 4:** Inventarios y asignaciones en `/supervisor/inventarios`

## Fase 4 — Inventarios

- Crear inventario (una activa a la vez) con asignaciones PENDIENTE por cada área activa
- Asignar tomadores por área (solo en estado PENDIENTE)
- Cierre con bloqueo de conteos para el tomador
- Migración: `usuarioId` opcional en asignaciones

```bash
npm run db:migrate
```

- `/supervisor/productos` — listado buscable/paginado, CRUD individual
- Carga masiva `.xlsx` con upsert por código de barras y resumen de errores
- Descarga de plantilla en `/api/productos/plantilla`
- Soft-delete si el producto tiene conteos de inventario

Aplicar migración:

```bash
npm run db:migrate
```

- `/supervisor/puntos` — listado, crear, editar y eliminar puntos
- `/supervisor/puntos/[id]` — áreas del punto (CRUD)
- Soft-delete (`activo: false`) si hay asignaciones/conteos de inventario
- Eliminación física solo cuando no hay historial

Aplicar migración nueva:

```bash
npm run db:migrate
```
- Carga masiva Excel
- Gestión de inventarios y asignaciones
- Reportes y exportación Excel
- Gestión de usuarios

## Despliegue en Vercel

1. Conecta el repositorio a Vercel.
2. Configura las variables `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.
3. Ejecuta migraciones contra la DB de producción antes del primer deploy.
