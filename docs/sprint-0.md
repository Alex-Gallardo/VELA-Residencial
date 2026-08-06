# SPRINT-0 — Fundaciones

## Alcance implementado

| Ticket   | Entregable local                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------------------- |
| VELA-001 | Next.js 15, React 19, TypeScript strict, Tailwind y configuración shadcn/ui                                     |
| VELA-002 | ESLint, Prettier y hook pre-commit para lint + typecheck                                                        |
| VELA-003 | Plantilla de variables y clientes Supabase browser/server/admin con validación                                  |
| VELA-004 | Esquema Prisma del MVP, migración inicial versionada y seed demo idempotente verificados en PostgreSQL temporal |
| VELA-005 | Workflow CI y placeholder de la aplicación listo para Vercel                                                    |
| VELA-006 | Tokens Vela en CSS y mapeo Tailwind (`bg-brand`, `text-muted`, etc.)                                            |
| VELA-007 | Integración condicional de Sentry y PostHog más verificador de eventos                                          |

## Límites deliberados

No se incluyeron autenticación, middleware de sesión, políticas RLS, RBAC, pantallas de reportes ni landing comercial completa: pertenecen a SPRINT-1 en adelante.

La creación y validación de proyectos cloud requiere credenciales del propietario. Para cerrarla, configura `.env.local`, ejecuta `npm run verify:services`, conecta el repositorio a Vercel y replica allí las variables de entorno.
