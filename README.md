# Vela

Vela es una plataforma SaaS multi-tenant de operación residencial. Su objetivo es que un residente pueda reportar un problema en menos de un minuto y que la administración tenga visibilidad y trazabilidad de la atención.

Este repositorio contiene **solamente SPRINT-0 (Fundaciones)**: estructura Next.js, TypeScript estricto, Tailwind/shadcn, clientes Supabase, esquema Prisma con seed demo, CI, tokens visuales y telemetría preparada. Autenticación, RLS, reportes y demás funciones pertenecen a sprints posteriores.

## Requisitos

- Node.js 20.9 o superior
- Un proyecto Supabase con Postgres
- Opcional para observabilidad: proyectos Sentry y PostHog
- Opcional para publicación: cuenta y proyecto Vercel

## Inicio local

```bash
npm install
copy .env.example .env.local
npm run db:generate
npm run dev
```

La aplicación queda disponible en `http://localhost:3000` y el estado de configuración en `http://localhost:3000/api/health`.

## Base de datos demo

Completa `DATABASE_URL` y `DIRECT_URL` en `.env.local`, luego ejecuta:

```bash
npm run db:migrate -- --name init
npm run db:seed
```

El seed es idempotente y crea el tenant demo `los-robles-demo`, un administrador, un residente, una vivienda, categorías con SLA y un ticket de ejemplo.

## Verificación

```bash
npm run check
npm run build
npm run verify:database
npm run verify:services
```

`verify:database` levanta PostgreSQL temporalmente, aplica la migración, ejecuta dos veces el seed y comprueba sus datos e idempotencia. `verify:services` comprueba realmente Supabase REST, Postgres/Prisma y envía eventos de prueba a Sentry y PostHog. Este último requiere credenciales reales en `.env.local`; falla de forma explícita si faltan o algún servicio no responde.

## Seguridad de secretos

- Nunca publiques `.env.local` ni la clave `SUPABASE_SERVICE_ROLE_KEY`.
- El cliente administrativo importa `server-only` y no puede empaquetarse en el navegador.
- Las claves públicas y privadas están separadas en clientes distintos.
- RLS se implementa en SPRINT-1, según el plan del proyecto.
