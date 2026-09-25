# Revisión del código actual frente a la ruta `meta_first`

Revisión hecha el 2026-09-22 sobre el árbol de trabajo en `main`. Sólo lectura: no se modificó código.

## Veredicto general

El repositorio está en mejor estado del que sugiere su tamaño. La autenticación, el aislamiento multiempresa y la disciplina de privilegios ya están resueltos y probados, y el conector se apoya sobre eso sin rehacer nada. Lo que falta no son ajustes: son capas enteras que todavía no existen.

No hay una sola línea de código de integraciones. Ningún cliente HTTP hacia un sistema externo, ninguna tabla de conexiones, ningún manejo de credenciales, ningún job, ninguna llamada a un modelo de lenguaje.

## Lo que ya existe y se reutiliza tal cual

| Pieza | Dónde | Por qué sirve |
|---|---|---|
| Identidad verificada en servidor | [session.ts](../../../../src/modules/identity/session.ts) | `getClaims()` valida la firma del JWT. `requireUserForAction()` es lo que van a usar las rutas del conector. |
| Resolución de empresa por membresía | [service.ts](../../../../src/modules/company/service.ts) | `requireCompanyMembership()` devuelve el `companyId` sin aceptarlo del cliente. Es exactamente el non-negotiable de aislamiento. |
| Esquema `private` no expuesto | [0001](../../../../supabase/migrations/0001_schemas_and_identity.sql) | Existe un lugar donde poner objetos que la Data API no alcanza. Es la base de la decisión D1. |
| `private.is_company_member()` | [0001](../../../../supabase/migrations/0001_schemas_and_identity.sql) | Helper `SECURITY DEFINER` ya probado, reutilizable en las políticas de las tablas nuevas. |
| Patrón de RPC `SECURITY INVOKER` | [0002](../../../../supabase/migrations/0002_company_context.sql) | El molde para escrituras idempotentes bajo RLS. |
| Matriz de privilegios explícita | [0004](../../../../supabase/migrations/0004_grants.sql) | `revoke all` y después conceder operación por operación. Las tablas nuevas siguen el mismo camino. |
| Contratos con Zod | [reporting/contract/](../../../../src/modules/reporting/contract/) | El estilo para K02–K04: tipos cerrados, ausencia explícita, sin huecos rellenados con supuestos. |
| Tres proyectos de prueba | [vitest.config.mts](../../../../vitest.config.mts) | `unit`, `component` y `app`. El conector usa los tres. |
| Suite pgTAP | [supabase/tests/](../../../../supabase/tests/) | Siete archivos que prueban RLS y privilegios en la base, no en el código. Las tablas nuevas suman los suyos. |
| Cliente sin credencial privilegiada | [env.ts](../../../../src/lib/env.ts) | Invariante verificada por `tests/unit/no-privileged-credentials.test.ts`. Condiciona D1. |

## Lo que hay que crear desde cero

| Capa | Estado | Corte |
|---|---|---|
| Contratos de intento OAuth, conexión y credencial | No existe | `M05.1.2`, `M05.1.3`, `M05.1.4` |
| Tablas, RLS y privilegios de esas tres entidades | No existe | `M06.1a`, `M06.2a` |
| Cifrado y descifrado de tokens | No existe | `M06.3a` |
| Cliente HTTP de la Graph API | No existe | `M16.1` |
| Rutas de inicio y callback de OAuth | No existe | `M16.1` |
| Selección de cuenta, probe y desconexión | No existe | `M16.2` |
| Lectura y persistencia de insights | No existe | `M16c` |
| Herramientas tipadas y orquestador de chat | No existe | `M25a` |
| UI de integraciones real | Placeholder honesto | `M16.1`, `M16.2` |

La página [integraciones/page.tsx](<../../../../src/app/(app)/app/integraciones/page.tsx>) hoy dice explícitamente que no hay conectores y no muestra botones que no hagan nada. Eso está bien hecho y es lo que se reemplaza, no se parchea.

## Decisiones que hay que tomar antes de escribir código

### D1 — Dónde viven los tokens cifrados

Es la decisión estructural de toda la ruta.

`docs/SECURITY.md` exige que los tokens de integraciones estén cifrados, fuera del alcance de la Data API y nunca en una tabla legible por `authenticated`. Al mismo tiempo, la aplicación no usa ninguna credencial de servicio, y `tests/unit/no-privileged-credentials.test.ts` falla si aparece una bajo `src/`. El documento resuelve el conflicto suponiendo un worker que todavía no existe, y en esta ruta no va a existir.

**Propuesta A, recomendada.** La tabla de credenciales vive en el esquema `private`, sin ningún `grant` para `anon` ni `authenticated`. Se escribe y se lee mediante funciones `SECURITY DEFINER` en `public` que verifican la membresía con `private.is_company_member()` antes de tocar nada. El cifrado y el descifrado ocurren en Node, dentro del Route Handler, con una clave que sólo existe como variable de entorno del servidor.

Consecuencias que hay que aceptar con los ojos abiertos: la función de lectura es invocable por el usuario a través de la Data API, así que un usuario podría obtener el **texto cifrado** de su propia conexión. Sin la clave del servidor ese texto no sirve para nada, y la clave nunca sale del proceso de Node. A cambio, no se introduce ninguna credencial privilegiada en la aplicación y la invariante existente sobrevive intacta.

**Propuesta B.** Un segundo cliente de Supabase con clave secreta, usado sólo en las rutas del conector. Es lo que haría un worker. Rompe la invariante actual, obliga a reescribir la prueba que la protege y a enmendar `SECURITY.md`. No lo recomiendo para esta ruta: agrega una superficie de riesgo real a cambio de cerrar un hueco teórico.

**Requiere tu aprobación antes de `M06.1a`.**

### D2 — No hay worker, y no lo vamos a construir acá

`M07` entero, la arquitectura de jobs, queda fuera de la ruta. La sincronización de insights de `M16c` se dispara cuando el usuario aprieta un botón, en una Server Action, de forma idempotente por ventana. Es honesto, se demuestra bien y no arrastra siete microfases.

Lo que se pierde: no hay recolección automática ni reintentos en segundo plano. Se declara como limitación en la interfaz, no se disimula.

### D3 — Dos hallazgos menores

`H-E1-02`: la plantilla [prompt-implementacion.md](../../../_templates/prompt-implementacion.md) manda leer `docs/microfases/<ID>/`, pero la estructura real del repositorio es `docs/FASES/FASE1/<MF>/`. Un asistente que siga la plantilla al pie de la letra busca archivos que no existen.

`H-E1-03`: `docs/SECURITY.md` afirma que no hay política de borrado ni de retención y que es requisito antes de conectar el primer sistema real. `M03a` la define; cuando se apruebe, `SECURITY.md` tiene que dejar de decir que no existe.

## Riesgos de la ruta, en orden de probabilidad

1. **La cuenta de prueba deja de estar disponible.** Todo el desarrollo depende del acceso que un tercero concedió y puede revocar. Mitigación: `M16.2` prueba revocación explícitamente, y los fixtures de prueba no dependen de la cuenta real.
2. **El token de larga duración vence a los sesenta días.** No es un problema durante el desarrollo, sí en cuanto haya un cliente. `M16.2` implementa la reautorización desde el principio.
3. **La zona horaria desalinea el gasto.** Ver `H-M00-01`. Es la razón de la Decisión 1 del acta.
4. **Límites de tasa de la Graph API.** En tier limitado son bajos. `M16c` guarda el crudo para no repetir llamadas y registra los días ya observados.
