# M06.3a — Auditoría de spec 4

- Fecha: 2026-10-01.
- Commit base: `f96b3b3`.
- Spec: `docs/FASES/FASE1/M06.3a/spec.md`, estado **BORRADOR**.
- Hash Git del contenido sin la línea `**Estado:**`: `73916504c73990df7a2d38ff18b7ea7f3c592375`.
- El hash coincide con el auditado en `spec-audit-3.md`. Se contrastó nuevamente el estado del árbol, las fuentes del contrato y el checklist. Este informe es el único archivo escrito por la auditoría.

## Veredicto

**APROBABLE.** Los 18 ítems pasan. No hay contradicciones ni hallazgos nuevos. Este resultado permite que el usuario decida la aprobación visible de la spec; no cambia por sí mismo `BORRADOR` ni aprueba `G-CRYPTO`.

En la tabla, **S** es `docs/FASES/FASE1/M06.3a/spec.md`, **P** es `docs/FASES/FASE1/meta_first/plan.md` y **R** es `docs/FASES/FASE1/meta_first/spec.md`.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---|---|---|
| 1 | Trazabilidad | PASS | P ficha M06.3a/II.6; S §Criterios de aceptación, «Heredados»: CA-21 y CA-23–27, con la porción HTTP de CA-26 expresamente asignada a M16.1. |
| 2 | Alcance | PASS | S §Alcance, §Fuera de alcance y §Archivos previstos frente a P II.6: cifrado, cliente `worker_api`, repository, guardas, pruebas y documentación acotada; sin migración ni implementación OAuth. |
| 3 | Coherencia con spec general | PASS | R §§5, 7–9, 13b y 14; la fila «Cifrado / M06.3a» de R §14 exige `db:check:test` + `test:app`, igual que S §Verificación. M16.1/M16c/M28.2a conservan sus responsabilidades. |
| 4 | Decisiones | PASS | S §Decisiones D-M06.3a-01–11 reproduce Q1–Q11 confirmadas, sin contradicción con CA/DEC de la ruta. |
| 5 | Trampas | PASS | P II.6; S §Trampas y riesgos, T-04/T-10: IV nuevo por sellado, versión ausente diferenciada, pooler, `server-only` en Vitest y rotación. |
| 6 | Intervenciones y acciones reservadas | PASS | P III.2/ficha y S §Intervenciones: contraseña y variables tienen pasos; push, despliegue y `db:push` a `app` y pruebas permanecen reservados al usuario y sujetos a verificación posterior. |
| 7 | Verificación | PASS | P III.3, R §14 y S §Verificación/T-31/T-37: gate efectivo `db:check:test` + `test:app`; suite nueva falla ante URL ausente, inválida u otro proyecto, sin skip ni fallback a la URL runtime (CB-06). |
| 8 | Dependencias | PASS | `docs/PROJECT_STATE.md`: G-K01, G-K02-K04 y G-DB-META aprobados. Contratos K01–K04 y migración 0012 existen; sesiones de M05.1.1, M05.1.2–M05.1.4 y M06.1a–M06.2a registran su evidencia. |
| 9 | Lo entregado de verdad | PASS | S:323 y T-52:589 usan diez campos, los mismos de `src/modules/integrations/contract/credential.ts:37-60`. La validación de lifecycle/contexto permanece fuera del `z.strictObject`; S también se ajusta a las firmas y errores de SQL 0012. |
| 10 | Pendientes y hallazgos | PASS | S §Hallazgos relacionados y `docs/HALLAZGOS.md`: H-E1-17 como convención de mock; H-E1-36 login aquí y endurecimiento en M16c; H-E1-37 mitigación futura del repository con capacidad SQL más amplia; H-E1-41 resuelto por categorías de autoridad. |
| 11 | Contexto real | PASS | S §Contexto verificado enlaza K01/K04, SQL 0012, scripts, pruebas y documentación local existente. H-E1-36 usa la entrada estable, no la anterior línea equivocada. |
| 12 | Archivos previstos | PASS | S §Archivos previstos, P II.6 y Q2: lockfile, `scripts/lib/sql-target.mjs`, README limitado, `.env.example` y suite app permanente están autorizados. |
| 13 | Diseño suficiente | PASS | S §§5–7 y C-27 definen Queryable, funciones SQL, errores y respuesta del repository. S:322–325 exige objeto nuevo de diez campos K04 y validación separada de provider/status/generation. |
| 14 | Verificable | PASS | S §Casos de prueba T-01–T-53 usa comandos de `package.json`, resultados concretos y negativos. T-52:589 exige proyección a los diez campos reales antes de `secretCredentialSchema`. |
| 15 | Sin nada abierto | PASS | S §Preguntas abiertas declara Q1–Q11 cerradas; H-S-01–06 tienen verificación o microfase asignada. H-S-05 sobre TLS del endpoint no sustituye T-31 de autenticación real. |
| 16 | Ejecutable ahora | PASS | `npm run verify` exit 0 en esta auditoría: lint, typegen, typecheck, Vitest 8 archivos/145 pruebas y build. Scripts existentes; las variables futuras se incorporan en `.env.example` por II.6 paso 10 antes de usarlas. |
| 17 | Consistencia interna | PASS | S §6:323 y T-52:589 concuerdan en diez campos; C-27 y §Fuera de alcance no contradicen esa proyección ni los casos. |
| 18 | Reglas no negociables | PASS | S §§5–7, 10 y 12: empresa del K01, credenciales por `worker_api`, base de pruebas desechable, errores redactados y ninguna migración. La configuración TLS rechaza parámetros URL y fija CA, hostname estándar y `sslnegotiation: 'postgres'`. |

## Comprobaciones expresas

- **Q1:** `db:check:test` y `test:app` son obligatorios; la suite `tests/app/integrations-worker-api-client.test.ts` no puede omitirse. Este audit no la ejecuta porque todavía no existe.
- **Q5/Q11:** S §5 rechaza parámetros URL capaces de alterar TLS, incluido `sslnegotiation`, y fija `sslnegotiation: 'postgres'` frente a `PGSSLNEGOTIATION`. El fingerprint es evidencia y prueba del PEM versionado, no un segundo pinning del peer en runtime.
- **Q6/Q10:** `keyVersion` corresponde al material leído; ante escritura incierta se entrega la credential autenticada con rewrap `unconfirmed`, sin afirmar versión nueva persistida ni reintento automático.
- **H-E1-17/H-E1-36/H-E1-37/H-E1-41:** se conservan respectivamente como convención de testing resuelta, acceso real por verificar con endurecimiento diferido, mitigación pendiente a nivel repository con límite SQL aceptado, y resolución documental por categorías.
- **A-01 de spec-audit-2:** `SecretCredential` tiene diez campos exactos; S §6 y T-52 coinciden. Los campos de lifecycle/contexto no se incorporan al schema K04.

## Contradicciones

Ninguna.

## Hallazgos

Ninguno.

## Verificación y siguiente paso

`git diff --check` pasó. `npm run verify` terminó con **exit 0**: 8 archivos/145 pruebas y build completo. No se corrieron `db:check:test`, `test:app` ni pgTAP; son obligaciones de la implementación y de sus gates, no evidencia que pueda anticipar esta auditoría. No se inspeccionó manualmente `.env.local` ni se imprimieron valores de entorno.

El siguiente paso, si el usuario aprueba este resultado, es la aprobación visible de la spec antes de continuar el pipeline de planificación. Este informe no cambia la spec, no aprueba `G-CRYPTO` y no inicia plan-audit ni implementación. No hay evidencia suficiente para afirmar que el corte supera ocho horas, por lo que no se recomienda dividirlo.
