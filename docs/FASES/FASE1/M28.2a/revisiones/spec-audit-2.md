# Auditoría de spec — M28.2a — 2026-10-03 (segunda ronda)

- **Commit auditado:** `7b2a30f`. Árbol de trabajo con dos archivos modificados sin comitear
  (`docs/FASES/FASE1/M28.2a/spec.md`, `docs/FASES/FASE1/meta_first/spec.md`): las correcciones de
  A-01, A-02 y A-03 de `spec-audit-1.md`, ya declaradas por la propia spec en su sección
  "Fuentes" ("Referencias de línea recontrastadas al corregir A-03 sobre
  `7b2a30f96f12284b5339b7591a8ce16d29a26555`"). Esta auditoría evalúa el contenido real del
  árbol de trabajo, no solo el HEAD comiteado.
- **Hash de contenido de la spec, sin la línea de estado:** `7517041448d9579977406bf7c8cd6d39a954e922`.
- **Estado de entrada:** `BORRADOR`. Cumple la precondición.
- **Veredicto: APROBABLE.** Los 18 ítems del checklist están en PASS. Las tres contradicciones
  de `spec-audit-1.md` (A-01, A-02, A-03) están corregidas y verificadas contra el código y los
  documentos vigentes.

## Checklist

| # | Ítem | PASS/FAIL/BLOQUEO | Evidencia |
|---:|---|---|---|
| 1 | Trazabilidad | PASS | Los tres criterios sin CA numerado de la ficha (`meta_first/plan.md:234`) aparecen resumidos con fidelidad en `M28.2a/spec.md:129-131` ("Heredados de la ruta"). |
| 2 | Alcance | PASS | `M28.2a/spec.md:33-48` (Alcance/Fuera de alcance) reproduce exactamente la ficha (`plan.md:230-238`) y II.7 (`plan.md:530-556`); ningún paso nuevo. La verificación de `private` (además de `worker_api`) en el Alcance punto 4 traza a DEC-03 y a la corrección de A-02, no es ampliación. |
| 3 | Coherencia con la spec general | PASS | DEC-18 en `meta_first/spec.md:58` ya incorpora la excepción acotada del grill de M28.2a ("Excepción acotada aprobada por el usuario... Cerrada; excepción ya aprobada incorporada al corregir A-01"); CB-04 en `meta_first/spec.md:539` la referencia explícitamente. Sin contradicción con nombres/tipos que consumen microfases siguientes (M16.1 solo depende de `G-ENTORNO`, `plan.md:267`). |
| 4 | Decisiones | PASS | D-M28.2a-01 a 03 en `M28.2a/spec.md:211-213`, todas "Usuario, grill confirmado, 2026-10-03"; ninguna contradice DEC-07, DEC-08 ni DEC-18 de `meta_first/spec.md:47-58`. |
| 5 | Trampas | PASS | Las dos trampas de II.7 (`plan.md:553,555`: SMTP por defecto solo al equipo; riesgo Hobby) están reflejadas en `M28.2a/spec.md:195,201`. |
| 6 | Intervenciones y acciones reservadas | PASS | `M28.2a/spec.md:178-191` coincide con la ficha (`plan.md:238`) y III.2 (`plan.md:777`); fila "Reservadas" asigna push, despliegue, `db:push` a `app` y `db:push:test` al usuario, con verificación distribuida en las filas de II.7.1-2 y II.7.3 inmediatamente superiores. |
| 7 | Verificación | PASS | `M28.2a/spec.md:168-176` incluye `npm run verify`, checklist manual con registro externo y cita CB-06 explícitamente (`:174`), igual que III.3 (`plan.md:798`) y la sección 14 de `meta_first/spec.md:536-541`. |
| 8 | Dependencias | PASS | `PROJECT_STATE.md:20` registra `G-CRYPTO` aprobado y `:24` registra M28.2a habilitada, sin empezar. `git merge-base --is-ancestor d3db802... HEAD` confirma que el commit de cierre de `G-CRYPTO` es ancestro de HEAD (`7b2a30f`); `git diff --stat d83e288 7b2a30f` muestra que esta rama no modifica ningún archivo de código, solo `M28.2a/spec.md` (nuevo) y 8 líneas de `meta_first/plan.md`. |
| 9 | Lo entregado de verdad | PASS | Firmas citadas verificadas contra el código real: `parseCredentialKeyring(keys, current): CredentialKeyring` en `keyring.ts:43`; `validateConnectionString` en `worker-api.ts:108`; `roleUserRef`/`isSharedTransactionPooler`/`inspectConnectionUrl`/`supabaseTlsConfig` en `connection-url.mjs:15,68,80,110`; todas coinciden exactamente con lo que la spec afirma. |
| 10 | Pendientes y hallazgos | PASS | `H-E1-08` pendiente y asignado a M28.2a (`HALLAZGOS.md:25`), tratado en `M28.2a/spec.md:144,195,237`. `H-E1-23` correctamente descrito como "no es de este corte" (`HALLAZGOS.md:40` y `:395`), sin pretender cerrarlo (`M28.2a/spec.md:239`). Los dos pendientes de `PROJECT_STATE.md:45-47` (visibilidad del repositorio, referencias de línea de `SECURITY.md` en M03a) no tocan M28.2a. |
| 11 | Contexto real | PASS | Se verificaron una por una las 17 citas `archivo:línea` de la tabla "Contexto verificado en el código" (`M28.2a/spec.md:54-70`) contra el árbol de trabajo real: `package.json:6,14,17,18,26`; `vitest.config.mts:29,37,50`; `src/lib/env.ts:33,59`; `signup/page.tsx:32,36`; `forgot-password/page.tsx:26`; `reset-password/page.tsx:29,41,50`; `login/page.tsx:31`; `auth/callback/route.ts:18,28,34,40,46`; `app/layout.tsx:32,36`; `company/service.ts:29`; `session.ts:21`; `integraciones/page.tsx:11,25`; `onboarding/repository.ts:140`; `supabase/config.toml:7,24,169,173,186,238`; `0012_integrations.sql:108,201,277,359,407`; `scripts/check-target.mjs:15`; `scripts/lib/target.mjs:194`; `scripts/db-push.mjs:9,27,41`; `worker-api.ts:108`; `connection-url.mjs:15,68,80,86,99,110`; `keyring.ts:43`; `tests/app/email-flows.test.ts:15,26,41,54`. Las tres líneas falsas de A-03 (`package.json:9`, `worker-api.ts:106`, `email-flows.test.ts:24`, `PROJECT_STATE.md:19` mal atribuida) ya no aparecen: la spec corregida cita `package.json:6/14/26`, `worker-api.ts:108`, `email-flows.test.ts:15/26/41/54` y separa `PROJECT_STATE.md:19` (G-DB-META) de `:20` (G-CRYPTO), todas correctas. |
| 12 | Archivos previstos | PASS | `M28.2a/spec.md:116-119` prevé `entorno.md` (autorizado por II.7 paso 9, `plan.md:545`) y los tres archivos de seguimiento autorizados por `AGENTS.md` y la Precondición 8 de `plan.md:370`. `SECURITY.md`/`ARCHITECTURE.md` correctamente ausentes: la verificación remota de exposición de `worker_api`/`private` ya está descrita como intervención futura del usuario en `SECURITY.md:98` ("se verifica en el panel... al preparar el entorno"), sin flip previsto→vigente pendiente que M28.2a deba registrar ahí. |
| 13 | Diseño suficiente | PASS | Nombres de variables, formatos de redirect (`?next=%2Fonboarding`, `?next=%2Freset-password`), objetos SQL (`worker_api`, `praxa_integrations`, `public.integration_connections`, `public.oauth_attempts`, `private.integration_credentials`) y códigos de error (`link-invalid`, `link-missing-params`, `server-error`) están todos fijados en el código existente y citados sin inventar nombres nuevos. |
| 14 | Verificable | PASS | Cada criterio M28.2a-C-01 a C-10 tiene su caso T-01 a T-11 con comando real (`npm run verify`, `db:check`, `db:push`, `db:preview`) o procedimiento manual explícito, resultado esperado concreto y casos negativos/borde (T-04 falla si aparece cualquiera de los dos esquemas; T-07 rechazo de alta nueva; T-09 sesión ausente y callback sin parámetros). |
| 15 | Sin nada abierto | PASS | "Preguntas abiertas" (`M28.2a/spec.md:223-233`) solo contiene IDs ya resueltos. Las cuatro hipótesis declaran cómo y cuándo se verifican (pasos 2-8b, VR-01 futuro). Los supuestos externos decisivos (SMTP de Supabase, redirecciones, uso comercial de Vercel, cambios de exposición de la Data API) tienen evidencia oficial consultada el 2026-10-03, listada en "Fuentes" con URL. |
| 16 | Ejecutable ahora | PASS | Todas las microfases previas entregaron lo que la spec usa (verificado en el ítem 9 y 11). Los scripts `db:check`, `db:preview`, `db:push`, `verify` existen en `package.json:20-26`. Las variables que la spec usa sin crearlas (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `PRAXA_CREDENTIAL_KEYS`, `PRAXA_CREDENTIAL_KEY_CURRENT`, `PRAXA_INTEGRATIONS_DB_URL`) están en `.env.example` sin valores. `npm run verify`, corrido en el directorio actual (el código del árbol es idéntico al de `main` fusionado: `git diff --stat d83e288 7b2a30f` solo toca documentación) vía `powershell -NoProfile -Command "npm run verify"` por la limitación conocida de Git Bash (H-E1-20, reproducida primero: 11 archivos fallaron en Git Bash con "Cannot read properties of undefined (reading 'config')" / "Vitest failed to find the runner"): exit 0, lint + typegen + typecheck + 11 archivos/222 pruebas + build, todo en verde. |
| 17 | Consistencia interna | PASS | El Alcance punto 4, el Diseño concreto (pasos II.7.4-5) y los criterios C-04/T-04 verifican de forma uniforme **ambos** esquemas (`worker_api` y `private`); ya no hay discrepancia (corrección de A-02). "Fuera de alcance" no excluye nada que el resto de la spec exija. |
| 18 | Reglas no negociables | PASS | K01 no aplica (microfase sin código de producto); sin secretos ni datos reales en la spec; ninguna migración se edita (`Fuera de alcance`, `M28.2a/spec.md:45`); la única prueba contra `app` es el recorrido manual acotado y expresamente autorizado por el usuario (D-M28.2a-03, DEC-18, CB-04); no se introduce ninguna credencial nueva fuera de `worker_api`; toda evidencia exigida es redactada. |

## Contradicciones

| Elemento de la spec | Contradice a (fuente y ubicación) | Evidencia | Cómo se resuelve |
|---|---|---|---|
| Ninguna | — | — | — |

Las tres contradicciones de `spec-audit-1.md` (A-01: DEC-18 vs. registro de prueba; A-02:
verificación de `private` incompleta; A-03: referencias de línea falsas) están resueltas en el
árbol de trabajo actual, verificado línea por línea en el ítem 11.

## Hallazgos

Ninguno sobrevive la verificación. No se abre ningún hallazgo nuevo.

## Observación de tamaño

Sigue siendo mayormente documental y de verificación, con la ejecución real a cargo del usuario
(cuentas, DNS, SMTP, dashboard). No hay evidencia de que el trabajo del asistente exceda ocho
horas. No se recomienda partir la microfase.

## Siguiente paso

El usuario puede aprobar esta spec (pasa a `APROBADA`) y seguir con `plan mode` para M28.2a,
según el protocolo de `AGENTS.md`.
