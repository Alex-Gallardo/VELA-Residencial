# Vela

Vela es una plataforma SaaS multi-tenant de operación residencial. El repositorio contiene las fundaciones de SPRINT-0 y la identidad y acceso de SPRINT-1.

## SPRINT-1 disponible

- Login, logout, recuperación y actualización de contraseña con Supabase Auth.
- Middleware de sesión y resolución de residencial para rutas privadas.
- RBAC centralizado con roles temporales y respuestas API `403`.
- Invitaciones de un solo uso con token hasheado, expiración y revocación.
- Registro guiado de vivienda, relación y hogar.
- RLS en todas las tablas multi-tenant y aislamiento probado entre tenants A/B.
- Auditoría obligatoria de invitaciones y cambios de rol.

El registro público no existe: una cuenta nueva sólo puede originarse desde un enlace de invitación válido.

## Requisitos e inicio local

- Node.js 20.9 o superior.
- Un proyecto Supabase con Postgres.
- Opcional: Sentry, PostHog, Vercel y Resend para enviar invitaciones por correo.

```bash
npm install
copy .env.example .env.local
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

La aplicación queda en `http://localhost:3000`; el estado técnico, en `http://localhost:3000/api/health`.

## Verificación

```bash
npm run check
npm run verify:database
npm run build
npm run verify:services
```

`verify:database` levanta PostgreSQL temporal, aplica todas las migraciones, ejecuta dos veces el seed, simula identidades Supabase y demuestra que un usuario del tenant A no puede leer datos del tenant B. También comprueba la auditoría de cambios de rol.

## Seguridad

- Nunca publiques `.env.local`, `SUPABASE_SERVICE_ROLE_KEY` ni credenciales de proveedores.
- El cliente administrativo es exclusivo del servidor.
- El `tenantId` efectivo se deriva de la sesión; nunca se confía en el navegador.
- RLS es la barrera final aunque falle una validación de aplicación.
- Los tokens de invitación se almacenan únicamente como SHA-256.

Consulta [docs/sprint-1.md](docs/sprint-1.md) para la trazabilidad de tickets y criterios de aceptación.
