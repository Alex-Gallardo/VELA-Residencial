# SPRINT-1 — Identidad, acceso y multi-tenant

## Alcance entregado

| Ticket   | Entregable                                                    | Evidencia principal                                                                        |
| -------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| VELA-010 | Login, logout y recuperación de cuenta con Supabase Auth      | `src/server/actions/auth.ts`, rutas `/login`, `/recuperar-cuenta` y `/actualizar-password` |
| VELA-011 | Middleware de sesión, resolución de tenant y guardas privadas | `src/middleware.ts`, pruebas `route-guards.test.ts`                                        |
| VELA-012 | RLS y funciones `auth_tenant_ids()`/roles                     | migración `20260806233000_sprint_1_auth_rls`, prueba A/B en `verify-database.ts`           |
| VELA-013 | RBAC centralizado con `can(user, action, resource)`           | `src/lib/permissions.ts`, matriz unitaria y API `403`                                      |
| VELA-014 | Crear, expirar, revocar y compartir invitaciones              | panel `/admin/invitaciones`, tokens SHA-256 y correo Resend opcional                       |
| VELA-015 | Aceptación y onboarding de vivienda/hogar                     | `/invitacion/[token]`, `/onboarding`, alta transaccional                                   |
| VELA-016 | Auditoría de acciones sensibles y roles                       | `audit-service.ts`, `membership-service.ts`, verificación de `AuditLog`                    |

## Demostración objetivo

1. Un administrador autenticado abre `/admin/invitaciones`.
2. Selecciona correo, vivienda y relación; Vela genera un enlace válido por siete días.
3. El residente abre `/invitacion/[token]`, crea su cuenta y confirma su hogar.
4. Vela crea membresía y rol dentro de una transacción, consume la invitación y registra auditoría.
5. El residente entra a `/inicio`; RLS sólo expone datos de su residencial.

## Controles relevantes

- Las rutas privadas redirigen a `/login` sin sesión.
- Un usuario autenticado sin membresía va a `/onboarding`.
- Los encabezados de identidad entrantes se eliminan y se reconstruyen en middleware.
- Una invitación aceptada, vencida o revocada deja de resolver.
- Los cambios de rol sólo deben realizarse mediante el servicio auditado.
- `AuditLog` no expone políticas de modificación para usuarios autenticados.
