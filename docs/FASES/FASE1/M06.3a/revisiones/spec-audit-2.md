# M06.3a — Auditoría de spec 2

- Fecha: 2026-10-01.
- Commit base: `f96b3b3`.
- Spec auditada: `docs/FASES/FASE1/M06.3a/spec.md`, **BORRADOR**, con las correcciones documentales A-01–A-09 presentes en el árbol de trabajo.
- Hash Git del contenido de la spec, excluida la línea `**Estado:**`: `d7732a7e92148435e857145246020a604f47e217`.
- Esta auditoría solo escribe este informe. Se preservan las modificaciones preexistentes de la spec, la spec general, `docs/HALLAZGOS.md` y `spec-audit-1.md`.

## Veredicto

**REQUIERE CAMBIOS.** Hay una contradicción de severidad alta entre el contrato K04 entregado y dos afirmaciones de la spec. Las correcciones A-01–A-09 de la primera auditoría quedaron incorporadas y no se detectó otra decisión abierta. `npm run verify` pasó; eso acredita el baseline local, no las pruebas de integración que M06.3a todavía debe implementar.

En las tablas, **S** es `docs/FASES/FASE1/M06.3a/spec.md`, **P** es `docs/FASES/FASE1/meta_first/plan.md` y **R** es `docs/FASES/FASE1/meta_first/spec.md`.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---|---|---|---|
| 1 | Trazabilidad | PASS | P, ficha M06.3a y II.6; S §Criterios de aceptación, «Heredados de la ruta»: CA-21 y CA-23–27, con la parte HTTP de CA-26 asignada a M16.1. |
| 2 | Alcance | PASS | P II.6; S §Alcance, §Fuera de alcance y §Archivos previstos. Suite app permanente y Q2 acotada están autorizadas; no hay migración ni implementación OAuth. |
| 3 | Coherencia con spec general | PASS | R §§5, 7–9, 13b y 14; S §Diseño y §Verificación. R §14 ya exige `db:check:test` y `test:app` sin salto para Cifrado. Los contratos posteriores M16.1/M16c/M28.2a no se adelantan. La discrepancia con K04 *entregado* se marca en 9. |
| 4 | Decisiones | PASS | S §Decisiones de la microfase: D-M06.3a-01–11 recogen Q1–Q11. Q10 separa material descifrado válido de recifrado no confirmado; Q8 exige más que conteo cero para retirar una clave. |
| 5 | Trampas | PASS | P II.6; S §Trampas y riesgos y T-04/T-10: IV nuevo, versión ausente diferenciada, `server-only` en Vitest, pooler y rotación. |
| 6 | Intervenciones y acciones reservadas | PASS | P III.2 y ficha M06.3a; S §Intervenciones del usuario y acciones reservadas. Contraseña y URLs tienen paso propio; push, despliegue y `db:push` de ambos proyectos siguen reservados al usuario. |
| 7 | Verificación | PASS | P III.3; S §Verificación: `db:check:test`, `test:app` y `verify` forman el gate. S §7/§12 y T-31/T-37 exigen suite real, fallo ante URL faltante, inválida u otro proyecto, sin fallback a URL runtime ni skip. |
| 8 | Dependencias | PASS | `docs/PROJECT_STATE.md`: G-K01, G-K02-K04 y G-DB-META aprobados; código K01–K04 y migración 0012 presentes. Sesiones M05.1.1, M05.1.2–M05.1.4 y M06.1a–M06.2a registran el cierre. |
| 9 | Lo entregado de verdad | **FAIL** | S:323 afirma que K04 tiene once propiedades. `src/modules/integrations/contract/credential.ts:37-60` entrega un `z.strictObject` de diez propiedades, exactamente las diez que S enumera. Hallazgo A-01. |
| 10 | Pendientes y hallazgos | PASS | S §Hallazgos relacionados y `docs/HALLAZGOS.md`: H-E1-17 resuelto como convención de tests; H-E1-36 conserva el endurecimiento en M16c y exige login real aquí; H-E1-37 es mitigación futura solo en repository, con SQL más amplio; H-E1-41 resuelto documentalmente por categorías. |
| 11 | Contexto real | PASS | Referencias de S §Contexto verificado contrastadas con contratos K01/K04, `0012_integrations.sql`, scripts y pruebas existentes; la referencia anterior errónea a H-E1-36 se reemplazó por la entrada estable. El error de cardinalidad K04 es de contenido y queda en 9/17. |
| 12 | Archivos previstos | PASS | S §Archivos previstos frente a P II.6 y Q2: `package-lock.json`, `scripts/lib/sql-target.mjs`, README limitado, `.env.example` y nueva suite app tienen autorización explícita. |
| 13 | Diseño suficiente | **FAIL** | S §6:323 y T-52:589 obligan a elegir entre diez campos del esquema estricto K04 y «once» campos exigidos en prosa/prueba. La elección no debe quedar al implementador. A-01. |
| 14 | Verificable | **FAIL** | S T-52:589 exige que una fila válida se proyecte a once campos K04, mientras el único K04 válido tiene diez. El resultado esperado literal es imposible con `secretCredentialSchema`. A-01. Los demás criterios tienen caso, comando y resultado esperado. |
| 15 | Sin nada abierto | PASS | S §Preguntas abiertas: Q1–Q11 cerradas, grill cerrado, spec todavía BORRADOR. Hipótesis H-S-01–06 tienen prueba o microfase asignada; H-S-05 TLS está verificada para el endpoint, sin sustituir T-31 de login. |
| 16 | Ejecutable ahora | PASS | `npm run verify` terminó con exit 0: lint, typegen, typecheck, 8 archivos/145 pruebas y build completo. Scripts existentes en `package.json`; variables futuras se agregan en `.env.example` durante II.6 paso 10, antes de usarlas. No se leyó `.env.local`. |
| 17 | Consistencia interna | **FAIL** | S §6:323 enumera diez propiedades pero las llama once; T-52:589 repite once. C-27 requiere proyección K04, que por definición es de diez campos. A-01. |
| 18 | Reglas no negociables | PASS | S §§5–7, 10, 12 y §Trampas: K01 resuelve empresa, acceso por `worker_api`, proyecto desechable, errores redactados y ausencia de migración. TLS rechaza parámetros de URL, fija `sslnegotiation: 'postgres'`, valida CA y hostname estándar. |

## Revisión de las correcciones y puntos solicitados

- **A-01–A-09 de spec-audit-1:** la fila Cifrado de R incorpora el gate; la URL rechaza overrides de identidad/destino; la política TLS fija `sslnegotiation` frente a `PGSSLNEGOTIATION` y rechaza parámetros TLS de ambas URLs; la excepción antigua de proyecto app queda confinada al caso negativo T-23; T-37 usa un subproceso aislado y verifica ausencia real, sin conexiones; H-E1-17 quedó como convención explícita; el contrato Queryable/errores/proyección quedó detallado; el grill figura cerrado; el endpoint efectivo del rol debe ser shared transaction pooler en 6543. El desliz de cardinalidad introducido al concretar A-07 es el nuevo A-01 de este informe.
- **Q1:** S §Verificación exige `db:check:test` y `test:app` efectivos. La nueva suite falla, no se salta, si falta o falla `PRAXA_INTEGRATIONS_TEST_DB_URL`; no usa `PRAXA_INTEGRATIONS_DB_URL` como fallback. Un `test:app` verde sin ella no aprueba M06.3a.
- **Q11/TLS:** S §5 rechaza `sslmode`, `sslcert`, `sslkey`, `sslrootcert`, `ssl`, `sslnegotiation` y `uselibpqcompat` antes de conectar; además fija la negociación en código. La huella SHA-256 documenta procedencia/sustitución del PEM, no agrega pinning del certificado remoto en runtime.
- **Q10/Q6:** S §6 conserva `keyVersion` del material realmente leído y descifrado. Un transporte incierto durante rewrap devuelve credencial válida con `rewrap: unconfirmed`, sin afirmar persistencia de versión nueva ni reintentar automáticamente.
- **Hallazgos:** H-E1-17 resuelto por convención de mock por suite, cuya aplicación se probará; H-E1-36 permanece diferido a M16c para endurecimiento, con verificación de acceso aquí; H-E1-37 sigue como mitigación/límite aceptado a nivel repository, no RESUELTO integralmente; H-E1-41 queda resuelto por categorías de autoridad, con matriz exacta en migraciones/pgTAP.

## Contradicciones

| Elemento de la spec | Contradice a (fuente y ubicación) | Evidencia | Cómo se resuelve |
|---|---|---|---|
| S §6:323 «once propiedades de SecretCredential» y T-52:589 «once campos K04» | K04 entregado en `src/modules/integrations/contract/credential.ts:37-60` | La lista de S y el `z.strictObject` contienen los mismos diez nombres: `connection_id`, `company_id`, `ciphertext`, `iv`, `auth_tag`, `key_version`, `token_type`, `issued_for_app_id`, `granted_scopes`, `expires_at`. Un campo adicional sería rechazado. | Corregir ambas apariciones a **diez**; T-52 debe comprobar la proyección exacta a esos diez campos y mantener los campos de lifecycle solo fuera del objeto K04. No hace falta decisión nueva. |

## Hallazgos

| ID | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-01 | alta | Diseño §6; T-52 | La spec pide literalmente once propiedades/campos K04 cuando el contrato estricto entregado tiene diez. La prueba especificada no puede pasar tal como está redactada. | S:323,589; `src/modules/integrations/contract/credential.ts:37-60`. | Sustituir «once» por «diez» en ambos lugares, sin cambiar nombres, tipos, validaciones ni alcance. | No; es corrección técnica contra K04 existente. |

## Comprobaciones y siguiente paso

`npm run verify` pasó con exit 0: lint, typegen, typecheck, Vitest (8 archivos, 145 pruebas) y build. `git diff --check` pasó. No se corrieron `db:check:test`, `test:app` ni pgTAP: la suite nueva y su acceso con el rol todavía no están implementados; el baseline verde no constituye G-CRYPTO.

Corregir A-01 en la spec, conservando Q1–Q11, y volver a auditar el nuevo hash. Hasta un veredicto APROBABLE y aprobación visible del usuario, la spec sigue **BORRADOR** y no habilita plan-audit ni implementación. El corte ya está fijado por la ruta; esta auditoría no aporta evidencia suficiente para concluir que excede el límite de 8 horas y no propone subdividirlo.
