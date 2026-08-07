# Vela

Vela es una plataforma SaaS multi-tenant de operación residencial. El repositorio contiene las fundaciones de SPRINT-0, la identidad y acceso de SPRINT-1 y el flujo operativo de reportes de SPRINT-2.

## SPRINT-2 disponible

- Creación de reportes en tres pasos con borrador persistente.
- Correlativo único `#NNN` por residencial protegido ante concurrencia.
- Listado y detalle residente con filtros, estado, SLA e historial.
- Bandeja administrativa con filtros, asignación y máquina de estados.
- Comentarios visibles y notas internas separadas por aplicación y RLS.
- SLA calculado desde `CategoryConfig` y auditoría de acciones operativas.

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

`verify:database` levanta PostgreSQL temporal, aplica todas las migraciones, ejecuta dos veces el seed y demuestra aislamiento entre tenants. Además prueba numeración concurrente, SLA, ciclo de estados, privacidad de notas internas y auditoría.

## Seguridad

- Nunca publiques `.env.local`, `SUPABASE_SERVICE_ROLE_KEY` ni credenciales de proveedores.
- El cliente administrativo es exclusivo del servidor.
- El `tenantId` efectivo se deriva de la sesión; nunca se confía en el navegador.
- RLS es la barrera final aunque falle una validación de aplicación.
- Los tokens de invitación se almacenan únicamente como SHA-256.

Consulta [docs/sprint-2.md](docs/sprint-2.md) para la trazabilidad de tickets y criterios de aceptación. Las entregas anteriores permanecen documentadas en `docs/sprint-0.md` y `docs/sprint-1.md`.
