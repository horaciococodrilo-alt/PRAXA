# M06.1a-M06.2a: base del conector Meta — migración `0012` y pruebas de aislamiento, privilegios y cierre

## Qué cambia y por qué

Agrega `supabase/migrations/0012_integrations.sql`: el esquema `worker_api` (no expuesto), el rol `praxa_integrations` sin contraseña, las tres tablas del conector (`integration_connections`, `oauth_attempts`, `private.integration_credentials`) y sus doce funciones `SECURITY DEFINER`, con aislamiento por empresa, privilegios revocados por defecto y reintentos idempotentes ante una llamada repetida exacta (`AGENTS.md:48`). Prueba ese comportamiento en la base — no en el código — con cuatro archivos pgTAP nuevos (aislamiento, privilegios, ciclo de vida, cierre administrativo) y una prueba de la Data API. Es la base de datos sobre la que `M06.3a` construye el cifrado y el cliente del rol de C; no hay UI ni llamadas a Meta en este corte.

## Criterios y qué los prueba

| Criterio | Prueba |
|---|---|
| Aislamiento entre empresas (CA-19, CA-21, CA-29) | `08_integration_isolation.test.sql` (26/26); confirmado además contra la base real con una mutación de control que suprime el filtro de empresa en `get_credential` y muestra que `throws_ok` lo detectaría |
| Privilegios de esquema, tablas y funciones (CA-14 a CA-17, CA-20 a CA-22) | `09_integration_privileges.test.sql` (52/52); confirmado con una mutación de control (grant de más sobre `count_credentials_by_key_version`) contra la base real |
| Idempotencia de las escrituras repetibles (`create_pending_connection`, `confirm_connection`, `mark_needs_reauth`, `replace_credential`, `rewrap_credential` y `create_oauth_attempt`; `D-M06.1a-M06.2a-11` a `-22`) | `09b_integration_lifecycle.test.sql` (147/147) |
| Transiciones de estado y purga de intentos vencidos (CA-07, CA-38b) | `09b_integration_lifecycle.test.sql` (mismo archivo) |
| Cierre administrativo de una empresa, con integración (CA-67, CA-68, `H-E1-06`, `H-E1-07`) | `10_demo_closure.test.sql` (21/21); `H-E1-07` descartada con la parte 1 sola, antes de que existiera `0012` |
| Lectura efectiva por la Data API (sección 5b, CA-21) | `tests/app/integrations-data-api.test.ts` (6/6) |
| Mensajes de error sin fugas (CA-09, CB-02) | `09b`, T-45 a T-47: catálogo fijo, sin `DETAIL`/`HINT`, ningún `23xxx` crudo |

Matriz completa (positivo/negativo/borde por criterio) en `qa-review-1.md`, sección 1.

## Verificación y resultados

Reproducida de forma independiente en la sesión de QA, sobre el commit `9ce95e373d7adc24e60b39bcdb3ab055de96c52f`:

| Comando | Resultado |
|---|---|
| `npm run db:check:test` | Destino verificado: proyecto de pruebas desechable |
| `npm run test:policies` | 11 archivos, 390 aserciones, 0 problemas |
| `npm run test:app` | 5 archivos, 29 pasadas, 7 omitidas (3 opt-in de `email-flows`, `H-E1-23`; 4 avisos de suites que sí corrieron) |
| `npm run verify` | exit 0: lint, typegen, typecheck, 8 archivos / 145 pruebas, build correcto |

Además, dos mutaciones de control ejecutadas contra la base real (rollback incondicional, sin residuos) confirman que las pruebas de aislamiento y de privilegios detectarían una regresión en esos puntos. Detalle completo, incluido el código de las pruebas exploratorias, en `qa-review-1.md`.

## Para el merge y para el gate

- **Merge:** revisión de Codex sobre el PR sin bloqueantes, y CI (`verify`) en verde. La CI corre exactamente `npm run verify`, ya confirmado en verde localmente sobre este commit.
- **Gate `G-DB-META`:** aprobación explícita del usuario, incluyendo de forma expresa la decisión ya registrada sobre las tres pruebas opt-in de `email-flows` (`H-E1-23`) y el registro de los hallazgos diferidos `H-E1-24` a `H-E1-27` (idempotencia de `create_pending_connection` con un intento no consumido, costo de validación de zona horaria, doble lectura en `get_credential`, y duplicación del bloque de traducción de errores — los cuatro sin corrección en este corte, con microfase asignada).
- Aplicar `0012` al proyecto `app` es una acción reservada de `M28.2a`, fuera de este corte.

## Riesgos

- El camino "el rol ya es `SUPERUSER`" de la creación idempotente del rol no tiene una aserción pgTAP directa (solo revisión de código): no es alcanzable por ningún flujo de la aplicación, y `postgres` no puede revertir ese atributo de todas formas (hallazgo informativo R-06 de `implementation-review-3.md`, no bloqueante).
- `H-E1-24`: `create_pending_connection` no verifica que exista un intento `initial` consumido antes de crear la pendiente. Queda asignado a `M16.1`, que sí controla el orden del flujo OAuth completo.

## Qué mirar primero

- `supabase/migrations/0012_integrations.sql` — especialmente los reintentos de las seis escrituras repetibles (`consume_oauth_attempt` rechaza cualquier reintento a propósito, CA-03) y la traducción de errores de clase `23`.
- `supabase/tests/09b_integration_lifecycle.test.sql` — el archivo más grande (147 aserciones), cubre ciclo de vida completo y los reintentos.
- `docs/FASES/FASE1/M06.1a-M06.2a/revisiones/qa-review-1.md` — matriz de criterios y las dos pruebas exploratorias contra la base real.
- `docs/HALLAZGOS.md` (`H-E1-23` a `H-E1-27`) y `docs/PROJECT_STATE.md` — estado del gate y hallazgos diferidos.
