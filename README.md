# Vela

Vela es una plataforma SaaS multi-tenant de operación residencial. El repositorio contiene las fundaciones de SPRINT-0, identidad y acceso de SPRINT-1, el flujo operativo de reportes de SPRINT-2, adjuntos seguros con moderación de SPRINT-3, comunicación segmentada de SPRINT-4 y el backoffice operativo de SPRINT-5.

## SPRINT-5 disponible

- Dashboard administrativo con KPIs reales de tickets, SLA, tiempos, moderación, avisos y actividad.
- Gestión de viviendas, hogares, residentes, membresías, usuarios y roles.
- Acceso temporal de soporte (break-glass) con expiración máxima de 24 horas.
- Auditoría filtrable por acción y rango de fechas.
- Configuración de categorías/SLA, zonas, canales y contactos de emergencia.
- Reglamento y documentos PDF privados, versionados y publicados por tenant.
- Styleguide vivo, estados de carga/vacíos y accesibilidad Lighthouse 100/100.

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
npm run verify:sprint5:cloud
npm run build
npm run verify:services
```

`verify:database` levanta PostgreSQL temporal, aplica todas las migraciones, ejecuta dos veces el seed y demuestra aislamiento entre tenants. Además prueba numeración concurrente, SLA configurable, ciclo de estados, privacidad, RLS de adjuntos/moderación/documentos, break-glass, duplicados, rate limit, KPIs y auditoría.

## Seguridad

- Nunca publiques `.env.local`, `SUPABASE_SERVICE_ROLE_KEY` ni credenciales de proveedores.
- El cliente administrativo es exclusivo del servidor.
- El `tenantId` efectivo se deriva de la sesión; nunca se confía en el navegador.
- RLS es la barrera final aunque falle una validación de aplicación.
- Los tokens de invitación se almacenan únicamente como SHA-256.
- Nunca se firma ni muestra el archivo original: sólo la copia normalizada y aprobada.
- Las URL de lectura privada vencen a los cinco minutos.
- Los documentos sólo admiten PDF validado por firma, pesan como máximo 10 MB y se sirven mediante URL firmada.
- El rol de soporte es temporal y su expiración también se aplica dentro de las políticas RLS.

Consulta [docs/sprint-5.md](docs/sprint-5.md) para la trazabilidad, arquitectura y operación. Las entregas anteriores permanecen documentadas en `docs/sprint-0.md` a `docs/sprint-4.md`.
