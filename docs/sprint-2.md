# SPRINT-2 — Reportes y flujo operativo

## Alcance entregado

| Ticket   | Entregable                                                       | Evidencia principal                                                           |
| -------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| VELA-020 | Creación guiada en tres pasos y máximo tres acciones             | `/reportes/nuevo`, `create-ticket-wizard.tsx`                                 |
| VELA-021 | Alta validada, transaccional y correlativo único por residencial | `tickets.ts`, `ticket-service.ts`, prueba concurrente en `verify-database.ts` |
| VELA-022 | Borrador local persistente y recuperable tras recargar           | `draft-report-store.ts`, hidratación explícita y recorrido E2E                |
| VELA-023 | Lista propia filtrable con estado y SLA                          | `/reportes`, `ticket-status-badge.tsx`, `sla-badge.tsx`                       |
| VELA-024 | Detalle con historial cronológico                                | `/reportes/[id]`, actividades ordenadas ascendentemente                       |
| VELA-025 | Máquina de estados con rechazo de transiciones inválidas         | `ticket-state-machine.ts`, pruebas unitarias de rutas válidas e inválidas     |
| VELA-026 | Bandeja administrativa para filtrar, asignar y cambiar estado    | `/admin/tickets`, `/admin/tickets/[id]`, permiso `triage:ticket`              |
| VELA-027 | SLA calculado desde la configuración de categoría                | `sla-service.ts`, persistencia de `slaDueAt`, badges de riesgo/cumplimiento   |
| VELA-028 | Comentarios públicos separados de notas internas                 | acciones de comentarios, filtro explícito residente y política RLS validada   |

## Demostración objetivo validada

1. El residente abre el flujo, selecciona **Mantenimiento**, completa los detalles y recarga la página.
2. Vela recupera categoría, paso y textos del borrador; el reporte se envía como `#001` en tres acciones.
3. El administrador filtra la bandeja, asigna el reporte y publica un comentario visible y una nota interna.
4. El reporte avanza `ENVIADO → ASIGNADO → EN_PROCESO → RESUELTO` y registra cada actividad.
5. El residente filtra sus reportes resueltos, ve responsable, SLA cumplido, comentario público e historial.
6. La nota interna aparece al administrador, pero no existe en el DOM de la vista residente.

## Controles y verificaciones

- Zod valida categoría, vivienda, título, descripción, ubicación, comentarios, asignación y transición.
- El `tenantId` y el actor se derivan de la sesión del servidor; los formularios no pueden elegirlos.
- Un bloqueo asesor transaccional por tenant protege el correlativo incluso con altas concurrentes.
- La vivienda debe pertenecer a un hogar activo del residente y la categoría debe estar habilitada.
- Sólo personal activo con roles operativos puede recibir un reporte o ejecutar triaje.
- Toda creación, asignación, cambio de estado y nota interna genera auditoría.
- RLS permite al residente consultar únicamente sus tickets y nunca comentarios `isInternal`.
- `verify:database` levanta PostgreSQL real y prueba correlativos concurrentes, SLA, historial, RLS y auditoría.
- La fixture E2E usa un tenant temporal en Supabase y se elimina después de la validación.
- No fue necesaria una migración nueva: SPRINT-0 ya incluyó las entidades y restricciones de tickets; SPRINT-2 incorpora su comportamiento de aplicación.

## Comandos de aceptación

```bash
npm run check
npm run format:check
npm run verify:database
npm run build
npm run verify:services
```

Las fixtures `e2e:sprint2:*` son exclusivas para pruebas controladas contra un proyecto Supabase configurado y no forman parte del arranque habitual.
