# SPRINT-3 · Imágenes seguras y moderación

## Resultado

El reporte admite una foto opcional sin exponer credenciales ni hacer pasar el binario por una función de Vercel. El navegador obtiene una URL de carga de un solo uso, sube al bucket privado `attachments` y el servidor procesa la imagen en segundo plano. El envío del reporte no espera una decisión de moderación.

El proveedor externo fue aplazado por decisión de producto. `ModerationProvider` permite conectarlo después sin cambiar el almacenamiento ni la UI. `DeferredModerationProvider` es el modo seguro actual: devuelve confianza desconocida y obliga a revisión humana.

## Flujo y fronteras de seguridad

1. El servidor valida nombre, MIME declarado y máximo de 6 MB, crea un adjunto propietario y firma sólo su ruta de cuarentena.
2. El cliente carga directamente a Supabase Storage y confirma la carga.
3. El procesador reclama el trabajo de forma idempotente y descarga con `service_role`.
4. Se bloquean PDF, ZIP, ejecutables, SVG/script, EICAR, imágenes animadas, formatos no permitidos y más de 25 megapíxeles.
5. Sharp decodifica, rota y limita a 1920×1920; al generar WebP no conserva EXIF ni metadatos.
6. Se calcula SHA-256 sobre la copia normalizada, se detecta coincidencia exacta y se elimina el original de cuarentena.
7. Sólo la copia procesada puede recibir una URL firmada de lectura por cinco minutos.
8. Un residente sólo ve la imagen si `ModerationItem.status = APROBADO`; moderadores pueden revisar la copia privada pendiente.

Los errores de seguridad se rechazan. Los errores transitorios quedan en `FALLIDO` y aparecen con opción de reintento. Un error de proveedor futuro deberá degradar siempre a revisión humana, nunca a aprobación.

## Trazabilidad de tickets

| Ticket   | Implementación                                                                                  | Verificación                                 |
| -------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------- |
| VELA-030 | Bucket privado, carga y lectura firmadas, TTL 5 min, autorización por tenant/reporte            | Migración, RLS, build y verificación cloud   |
| VELA-031 | Límite 6 MB, JPG/PNG/WebP, 25 MP, normalización WebP sin metadatos                              | Pruebas de `sanitizeImage`                   |
| VELA-032 | `ModerationProvider`, estado persistente, etiquetas/confianza y ejecución posterior a respuesta | Pruebas de política y flujo de base de datos |
| VELA-033 | Umbrales 0.15/0.85 y revisión humana para ambiguos/sin proveedor                                | Pruebas unitarias de límites                 |
| VELA-034 | `/admin/moderacion`, aprobar/rechazar con motivo, RBAC y auditoría                              | Pruebas RBAC, DB y E2E                       |
| VELA-035 | Bloqueo local de firmas peligrosas y EICAR; el antivirus administrado queda como mejora futura  | Pruebas de archivos hostiles                 |
| VELA-036 | 5 reportes/hora, 15/día; bloqueo exacto, sugerencia similar y hash de imagen                    | Pruebas unitarias y DB                       |

## Modelo y migración

La migración `20260807120000_sprint_3_secure_attachments` agrega estados de procesamiento, propietario, cuarentena/copia procesada, dimensiones, hash, fallos, timestamps, fuente/motivo de decisión y relaciones de revisión. Elimina las políticas de escritura directa de `Attachment` y `ModerationItem`; esas mutaciones son exclusivas del servidor. La migración crea o endurece el bucket cuando se ejecuta en Supabase y sigue siendo compatible con PostgreSQL estándar para CI.

## Operación

- `IMAGE_MODERATION_PROVIDER=deferred` documenta el modo actual. No requiere ni acepta credenciales de Google Cloud Vision.
- Para conectar un proveedor, implementar `ModerationProvider.analyze`, devolver `riskScore` de 0 a 1 y etiquetas; después seleccionar el adaptador en `getModerationProvider`.
- Revisar periódicamente adjuntos `PENDIENTE_SUBIDA` sin ticket y eliminarlos mediante un trabajo de limpieza cuando se defina la política de retención.
- Mantener `SUPABASE_SERVICE_ROLE_KEY` sólo en el servidor y conservar el bucket como no público.

## Comandos de aceptación

```bash
npm audit --audit-level=high
npm run check
npm run verify:database
npm run verify:sprint3:cloud
npm run build
```

La prueba E2E manual automatiza sus comprobaciones de persistencia con
`e2e:sprint3:verify-pending` y `e2e:sprint3:verify-approved`. Al terminar,
`e2e:sprint3:cleanup-storage` elimina los objetos de prueba antes de ejecutar
`e2e:sprint2:cleanup` para borrar la fixture.
