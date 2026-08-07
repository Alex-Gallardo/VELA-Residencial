# SPRINT-5 · Backoffice, documentos y calidad visual

## Resultado

Vela incorpora el backoffice necesario para operar un residencial sin depender de
ediciones directas en base de datos. Administración puede consultar KPIs reales,
gestionar el padrón y los accesos, revisar auditoría, configurar la operación y
publicar reglamentos PDF versionados. Los residentes sólo ven la versión vigente
y publicada de cada documento.

La documentación original se contrastó con el estado de Sprints 0–4. Se
reutilizaron las entidades de viviendas, hogares, usuarios, roles, categorías y
auditoría; se completaron los datos y políticas que faltaban para zonas,
configuración del tenant y documentos versionados.

## Trazabilidad

| Ticket   | Implementación                                                                                  | Evidencia                                               |
| -------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| VELA-050 | `/admin` con KPIs de estados, SLA, tiempos, categorías, moderación, lectura crítica y actividad | Verificación PostgreSQL y UI                            |
| VELA-051 | `/admin/residentes` para viviendas, hogares, residentes y bajas/movimientos                     | Validación Zod, transacciones y prueba de ciclo de vida |
| VELA-052 | `/admin/usuarios` para membresías y roles; soporte temporal con máximo de 24 h                  | Política de dominio y RLS activo/expirado               |
| VELA-053 | `/admin/auditoria` con filtros por acción y fechas                                              | Consulta aislada por tenant y prueba RLS                |
| VELA-054 | `/admin/configuracion` para categorías/SLA, zonas, canales y contactos                          | Prueba de SLA recalculado al crear tickets              |
| VELA-055 | `/admin/documentos`, `/reglamento` y descarga firmada de PDF privado                            | Versionado, bucket privado y prueba RLS                 |
| VELA-056 | `/styleguide` con tokens, tipografía, componentes, iconografía y estados                        | Revisión visual en navegador                            |
| VELA-057 | Navegación, skeletons, vacíos, reduced-motion, foco y contraste claro/oscuro                    | Lighthouse Accessibility 100/100                        |

## Reglas de dominio y seguridad

- El actor y el `tenantId` se derivan siempre de la sesión del servidor.
- Las bajas de residentes conservan el historial: desactivan membresía y
  `HouseholdMember` en vez de borrar evidencia.
- Una vivienda sólo se puede eliminar si no tiene hogares.
- No se puede retirar el último rol de Administración General activo del tenant.
- `SOPORTE_SISTEMA` exige expiración futura, como máximo a 24 horas; la función
  RLS valida la expiración en UTC, además de la aplicación.
- Las categorías y sus horas SLA son datos por tenant. Los tickets nuevos toman
  la configuración vigente al calcular su vencimiento.
- `IN_APP` es un canal obligatorio; Push y email pueden deshabilitarse por tenant
  y esa decisión se aplica al encolado y despacho.
- Un documento acepta únicamente PDF con firma `%PDF-`, máximo 10 MB. Cada nueva
  versión bloquea la serie y despublica de forma atómica la anterior.
- El bucket `documents` es privado. La descarga pasa por autorización y genera
  una URL firmada de cinco minutos.
- RLS permite al residente leer sólo documentos vigentes/publicados de su tenant;
  Comunicaciones, Administración y soporte temporal pueden consultar versiones.

## Datos y migración

La migración `20260807230000_sprint_5_admin_documents`:

1. amplía `Document` de forma compatible y migra registros existentes;
2. crea `ZoneConfig` y `TenantSettings` con valores iniciales por tenant;
3. agrega índices, claves únicas y relaciones necesarias;
4. instala políticas RLS para documentos, configuración, zonas y auditoría;
5. crea el bucket privado `documents`, limitado a PDF y 10 MB.

El seed es idempotente e inicializa las nuevas configuraciones. La migración ya
fue aplicada y verificada en el proyecto Supabase configurado para esta entrega.

## Operación y aceptación

```bash
npm run db:deploy
npm run db:seed
npm run check
npm run format:check
npm run verify:database
npm run verify:sprint5:cloud
npm run build
```

`verify:database` usa PostgreSQL temporal, aplica todas las migraciones, ejecuta
el seed dos veces y comprueba aislamiento, padrón, configuración, SLA,
documentos/versiones, auditoría, KPIs y break-glass expirado. La verificación cloud
comprueba migración, políticas RLS y bucket; crea un PDF mínimo, valida su lectura
firmada y lo elimina al finalizar.

Las credenciales de prueba se guardan sólo en `.test-credentials/`, ruta ignorada
por Git. No deben copiarse al repositorio ni reutilizarse como cuentas productivas.
