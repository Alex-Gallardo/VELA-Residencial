# SPRINT-4 · Avisos y notificaciones

## Resultado

Vela permite a Administración General y Comunicaciones crear avisos inmediatos
o programados, segmentarlos por todo el residencial, zona, vivienda o rol, y
distribuirlos por in-app, Web Push y correo. Cada destinatario queda materializado
en `NoticeReceipt`; esto evita recalcular audiencias históricas y permite medir
lectura sin exponer avisos a usuarios fuera del segmento.

La documentación funcional original se contrastó con Sprints 0–3. Las entidades
base ya existían, pero faltaban preferencias, suscripciones Push, programación,
entrega, procesamiento, UI y una frontera RLS que respetara la audiencia. La
migración de este sprint completa esas brechas.

## Trazabilidad

| Ticket   | Implementación                                                                        | Evidencia                                          |
| -------- | ------------------------------------------------------------------------------------- | -------------------------------------------------- |
| VELA-040 | `/admin/avisos`, validación Zod, segmentación, programación y cron idempotente        | Tests de validación/audiencia y PostgreSQL         |
| VELA-041 | `/notificaciones`, filtros, paginación, leído/pendiente y contador Zustand            | UI, rutas privadas y pruebas                       |
| VELA-042 | Suscripción Supabase Realtime a inserts propios en `Notification`                     | Bridge cliente + publicación Realtime en migración |
| VELA-043 | Service worker, alta/baja de suscripción y entrega VAPID                              | Perfil, servicio Push y variables documentadas     |
| VELA-044 | Resend + React Email; actualizaciones de tickets encolan in-app/Push/email            | Plantilla unitaria y acciones de ticket            |
| VELA-045 | Recibo por destinatario, confirmación explícita y porcentaje administrativo           | Servicio, UI y prueba RLS A/B                      |
| VELA-046 | Preferencias por canal, zona horaria y horario silencioso; alertas críticas lo omiten | Perfil y tests de cruce de medianoche              |

SMS se rechaza explícitamente: el flujo de producto lo menciona para alertas
críticas, pero no existe proveedor contratado y la documentación lo condiciona.
No se simula una entrega que no pueda garantizarse.

## Seguridad y consistencia

- El actor y `tenantId` siempre provienen de la sesión del servidor.
- La audiencia se resuelve contra membresías, hogares y roles activos del tenant.
- Un aviso residente sólo pasa RLS cuando existe su `NoticeReceipt`, ya fue
  entregado, está publicado y no expiró.
- Los destinatarios se fijan al publicar; cambios posteriores de vivienda no
  alteran evidencia histórica.
- La publicación bloquea la fila (`FOR UPDATE`) para evitar envíos dobles si dos
  ejecuciones cron coinciden.
- Las mutaciones de recibos y entregas son del servidor; el navegador sólo puede
  leer su información y recibir sus inserts por Realtime.
- Web Push conserva endpoint y claves en servidor. Las suscripciones expiradas
  se eliminan al recibir 404/410 del proveedor.
- El horario silencioso difiere Push/email. `ALERTA_CRITICA` siempre genera in-app
  y no espera al horario; los canales desactivados sí se respetan.

## Operación

1. Aplica la migración con `npm run db:deploy`.
2. Genera VAPID con `npx web-push generate-vapid-keys` y configura:
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`.
3. Configura `RESEND_API_KEY` y `NOTIFICATION_FROM_EMAIL` con un dominio verificado.
4. Define `CRON_SECRET`. `vercel.json` invoca `/api/cron/notices` cada cinco minutos.
5. Ejecuta la aceptación local y la fixture cloud:

```bash
npm run check
npm run format:check
npm run verify:database
npm run build
npm run e2e:sprint4:setup
npm run e2e:sprint4:verify
```

La fixture guarda credenciales aleatorias con permisos de usuario en
`.test-credentials/sprint-4.json`, ruta ignorada por Git y creada con permisos
restrictivos cuando el sistema operativo los admite. `e2e:sprint4:cleanup`
elimina el tenant y las cuentas cuando ya no se necesiten.
