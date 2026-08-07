# Vela

Vela es una plataforma SaaS multi-tenant de operación residencial. El repositorio contiene las fundaciones de SPRINT-0, identidad y acceso de SPRINT-1, el flujo operativo de reportes de SPRINT-2, adjuntos seguros con moderación de SPRINT-3 y comunicación segmentada de SPRINT-4.

## SPRINT-4 disponible

- Avisos inmediatos o programados, segmentados por todos, zona, vivienda o rol.
- Centro de notificaciones paginado, filtros, contador Zustand y actualización Realtime.
- Web Push VAPID y correo transaccional Resend + React Email.
- Confirmación de lectura y porcentaje por aviso para administración.
- Preferencias por canal, zona horaria y horario silencioso con excepción crítica.
- RLS por destinatario materializado y publicación cron idempotente.

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
npm run verify:sprint3:cloud
npm run build
npm run verify:services
```

`verify:database` levanta PostgreSQL temporal, aplica todas las migraciones, ejecuta dos veces el seed y demuestra aislamiento entre tenants. Además prueba numeración concurrente, SLA, ciclo de estados, privacidad, RLS de adjuntos/moderación, duplicados, rate limit y auditoría.

## Seguridad

- Nunca publiques `.env.local`, `SUPABASE_SERVICE_ROLE_KEY` ni credenciales de proveedores.
- El cliente administrativo es exclusivo del servidor.
- El `tenantId` efectivo se deriva de la sesión; nunca se confía en el navegador.
- RLS es la barrera final aunque falle una validación de aplicación.
- Los tokens de invitación se almacenan únicamente como SHA-256.
- Nunca se firma ni muestra el archivo original: sólo la copia normalizada y aprobada.
- Las URL de lectura privada vencen a los cinco minutos.

Consulta [docs/sprint-4.md](docs/sprint-4.md) para la trazabilidad, arquitectura y operación. Las entregas anteriores permanecen documentadas en `docs/sprint-0.md`, `docs/sprint-1.md`, `docs/sprint-2.md` y `docs/sprint-3.md`.
