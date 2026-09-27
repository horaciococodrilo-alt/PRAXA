# Auditoría de spec — M06.1a-M06.2a (5)

- **Fecha:** 2026-09-27
- **Commit auditado:** `b9d067e`
- **Hash de contenido de la spec:** `e57d8a7fefc5c45575343d9c045c9e096b97b063`
- **Spec:** `docs/FASES/FASE1/M06.1a-M06.2a/spec.md`
- **Precondición:** cumplida. La spec existe y figura en `BORRADOR` (`spec.md:3`).

## Veredicto

**APROBABLE.** Los 18 ítems están en PASS. No se encontró ninguna contradicción nueva ni ningún defecto que obligue al implementador a inventar. Se mantienen dos observaciones de severidad baja ya documentadas por `spec-audit-4`; ninguna bloquea la ejecución ni requiere una decisión del usuario.

La auditoría se repitió contra el mismo commit y el mismo hash de contenido que `spec-audit-4`. La base limpia terminó en verde. La primera corrida válida de `npm run verify` reprodujo exactamente `H-E1-18`: 136 pruebas pasaron, pero el worker de `tests/component/onboarding-wizard.test.tsx` no arrancó y esa suite no se ejecutó. Según `spec.md:562` y `D-M06.1a-M06.2a-09`, se repitió una vez; la segunda corrida terminó con exit 0, 8 archivos y 145 pruebas, y build correcto.

## Checklist

| # | Ítem | PASS/FAIL/BLOQUEO | Evidencia |
|---:|---|---|---|
| 1 | Trazabilidad | PASS | Los CA de M06.1a (`plan.md:189`) y M06.2a (`plan.md:204`) aparecen en Heredados (`spec.md:422-454`) y son fieles a `meta_first/spec.md` §§8-10. |
| 2 | Alcance | PASS | Alcance y Fuera de alcance (`spec.md:27-57`) coinciden con las fichas (`plan.md:180-208`) y con II.4-II.5 (`plan.md:429-497`). Los criterios operativos trazan a CA, DEC, trampas o decisiones de la microfase (`spec.md:460-497`). |
| 3 | Coherencia con la spec general | PASS | No contradice DEC-03/04, la matriz de privilegios (`meta_first/spec.md:144-178`), CA-01 a CA-29 aplicables, CA-35 a CA-39, CA-67 ni CA-68. Las firmas y retornos que consumirán M06.3a y M16.x están definidos. |
| 4 | Decisiones | PASS | `D-M06.1a-M06.2a-01` a `-10` identifican decisión, autor y fecha (`spec.md:614-627`) y no contradicen ningún DEC ni CA. |
| 5 | Trampas | PASS | Las tres trampas de II.4, las tres de II.5 y la hipótesis de PostgreSQL 16+ (`plan.md:470-497`) están reflejadas en `spec.md:581-605` y H-S-02. |
| 6 | Intervenciones y acciones reservadas | PASS | `db:push:test` queda a cargo del usuario (`plan.md:193`, `:208`, `:766`; `spec.md:572`). Commit, push, despliegue y `db:push` al proyecto `app` permanecen reservados, con verificación posterior (`spec.md:573-579`, T-43). |
| 7 | Verificación | PASS | Incluye `db:check:test`, `db:push:test`, `test:policies`, `test:app` y `verify` (`spec.md:554-565`), como exige III.3 (`plan.md:779-799`), y aplica CB-06. |
| 8 | Dependencias | PASS | `PROJECT_STATE.md:11-15` registra `G-K01` y `G-K02-K04` aprobados y M06.1a como siguiente. `main@b9d067e` contiene K01 y K02-K04. |
| 9 | Lo entregado de verdad | PASS | La spec usa los campos, tipos y restricciones reales de `context.ts`, `oauth-attempt.ts`, `connection.ts`, `credential.ts` y `primitives.ts`; incorpora `created_at`, `provider`, TTL de 10 minutos, clases de error, estados, base64, IV, etiqueta y scopes entregados. |
| 10 | Pendientes y hallazgos | PASS | `H-E1-05`, `-06`, `-07`, `-11`, `-12`, `-18`, `-19`, `-20`, `-21`, `-22` y `H-M04.1-02` quedan resueltos o diferidos explícitamente (`spec.md:647-660`). Los pendientes de K02-K04 están cubiertos por C-07, C-14 y D-10. |
| 11 | Contexto real | PASS | Se verificaron las migraciones `0001` a `0011`, pgTAP existente, scripts de destino y push, helpers de `test:app`, configuración de Vitest, K01-K04, `SECURITY.md`, `PROJECT_STATE.md` y `HALLAZGOS.md`. Las referencias existentes dicen lo que afirma la spec; los objetos nuevos están declarados como previstos. |
| 12 | Archivos previstos | PASS | Cada archivo de `spec.md:402-416` está autorizado por II.4-II.5, por la ficha de M06.2a o por seguimiento obligatorio. El ensayo temporal queda fuera del repositorio. |
| 13 | Diseño suficiente | PASS | Están definidos nombres, esquemas, columnas, restricciones, índices, firmas, retornos, orden de chequeos, SQLSTATE, mensajes, traducción de errores de clase `23`, privilegios y helpers de prueba. |
| 14 | Verificable | PASS | Cada C-NN tiene al menos un T-NN con comando real y resultado concreto (`spec.md:499-552`); incluye negativos y bordes relevantes, como 10 minutos exactos, IV de 10/11 bytes, acceso cruzado, ausencia de `DETAIL`/`HINT` y colisiones de identificador. |
| 15 | Sin nada abierto | PASS | Preguntas abiertas está vacía (`spec.md:643-645`). H-S-01 a H-S-10 indican cómo y cuándo se verifican, con condición de parada o alternativa. Los supuestos externos decisivos tienen fuente oficial o validación posterior. |
| 16 | Ejecutable ahora | PASS | Existen los scripts de `package.json`, `pg`, los resolutores de destino y los helpers requeridos. La única intervención previa al cierre es `db:push:test`, con paso asignado. En un worktree limpio de `b9d067e`, la repetición prescrita de `npm run verify` terminó con exit 0. |
| 17 | Consistencia interna | PASS | Alcance, diseño, criterios, casos, secuencia y archivos coinciden. Las excepciones de `count_credentials_by_key_version`, `consume_oauth_attempt`, `purge_connection` y `create_pending_connection` están delimitadas y cubiertas. |
| 18 | Reglas no negociables | PASS | Tenant verificado por membresía; datos sintéticos; una migración nueva sin editar las existentes; pruebas solo contra destino desechable; credenciales solo por `worker_api`; errores redactados y sin detalle sensible. |

## Contradicciones

Ninguna.

## Hallazgos

| ID | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-01 | baja | Diseño §8; Riesgos | La regla general hace obligatorio `p_client_business_id` en `create_pending_connection`, aunque K03 admite `client_business_id = null`. Es una precondición más estricta para M16.1, pero la firma y el error están definidos, por lo que no obliga a inventar en esta microfase. | `spec.md:156`, `:294`, `:313`; `connection.ts:58`; `plan.md:575` | Declarar el riesgo para M16.1 y sumar el caso nulo a T-45; alternativamente, declarar ese parámetro opcional. | No |
| A-02 | baja | Archivos previstos | La nota final atribuye el cambio previo de `docs/HALLAZGOS.md` solo a H-E1-22, pero el diff también corrige `vitest.config.ts` a `vitest.config.mts` en H-E1-18. | `spec.md:416`; diff actual de `docs/HALLAZGOS.md` | Mencionar también la corrección del nombre de `vitest.config.mts` proveniente de `spec-audit-3`, A-02. | No |

No hay hallazgos nuevos en esta quinta auditoría. Las dos observaciones son las mismas de `spec-audit-4` y no afectan el veredicto.

## Observación de tamaño

El grupo sigue siendo grande para dos cortes de hasta 8 horas. Si al planificar no cabe, la separación compatible con la ruta es:

- `M06.1a`: esquema, rol, tablas, privilegios y funciones, con `09`;
- `M06.2a`: `08`, `09b`, `10` y la prueba de la Data API.

El gate `G-DB-META` se mantiene al final del grupo.

## Verificaciones ejecutadas

| Comando | Resultado |
|---|---|
| `git status --short --branch` / `git rev-parse --short HEAD` | `main@b9d067e`; cambios preexistentes preservados: `docs/HALLAZGOS.md` modificado y la carpeta de la microfase sin seguimiento. |
| Hash de contenido sin la línea de estado | `e57d8a7fefc5c45575343d9c045c9e096b97b063`, igual a `spec-audit-4`. |
| Lectura completa de spec general, spec de microfase, fuentes normativas, dependencias y archivos citados | Referencias válidas y contenido coherente con la spec. |
| `git worktree add --detach ... HEAD` | Worktree limpio de `b9d067e` creado fuera del repositorio. |
| `npm ci --foreground-scripts` | 471 paquetes instalados; 0 vulnerabilidades. Una primera invocación de `verify` iniciada antes de que terminara la instalación se descartó porque no encontraba `eslint`. |
| `npm run verify` en el worktree, primera corrida válida | Exit distinto de cero por `H-E1-18`: 7 archivos y 136 pruebas pasaron; `onboarding-wizard.test.tsx` no se ejecutó por timeout al iniciar el worker. |
| `npm run verify` en el worktree, repetición única prescrita | **Exit 0:** lint, typegen y typecheck en verde; 8 archivos y 145 pruebas pasaron; build de Next.js correcto. |
| `git worktree remove --force ...` | Worktree temporal eliminado. |

No se leyó `.env.local`, no se ejecutó ningún comando contra una base remota y no se expuso ningún secreto.

## Siguiente paso

El usuario puede aprobar la spec y pasarla a `APROBADA`, referida al hash `e57d8a7fefc5c45575343d9c045c9e096b97b063`. Después corresponde plan mode; no se inicia automáticamente la implementación. Si antes se aplican A-01 o A-02, cambia el hash y la aprobación debe referirse al nuevo contenido.
