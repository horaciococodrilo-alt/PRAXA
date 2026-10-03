# M06.3a — Auditoría de spec 3

- Fecha: 2026-10-01.
- Commit base: `f96b3b3`.
- Spec auditada: `docs/FASES/FASE1/M06.3a/spec.md`, **BORRADOR**.
- Hash Git del contenido de la spec, excluida la línea `**Estado:**`: `73916504c73990df7a2d38ff18b7ea7f3c592375`.
- Alcance de esta pasada: verificar A-01 de `spec-audit-2` y repetir el checklist completo sobre el nuevo contenido. Solo se escribe este informe; se preservan los demás cambios del árbol.

## Veredicto

**APROBABLE.** Los 18 ítems pasan. A-01 de `spec-audit-2` está corregido en los dos lugares, sin alterar el contrato K04 ni incorporar campos de lifecycle/contexto al objeto estricto. Las decisiones Q1–Q11 y las correcciones A-01–A-09 de `spec-audit-1` permanecen. El veredicto no cambia el estado de la spec ni aprueba `G-CRYPTO`.

En la tabla, **S** es `docs/FASES/FASE1/M06.3a/spec.md`, **P** es `docs/FASES/FASE1/meta_first/plan.md` y **R** es `docs/FASES/FASE1/meta_first/spec.md`.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---|---|---|---|
| 1 | Trazabilidad | PASS | P, ficha M06.3a y II.6; S §Criterios de aceptación, «Heredados de la ruta»: CA-21 y CA-23–27, con la porción HTTP de CA-26 asignada a M16.1. |
| 2 | Alcance | PASS | P II.6; S §Alcance, §Fuera de alcance y §Archivos previstos. Q1/Q2 autorizan suite permanente, lockfile, sql-target y README acotado; no hay migración ni caller OAuth. |
| 3 | Coherencia con spec general | PASS | R §§5, 7–9, 13b y 14; S §Diseño/§Verificación. R §14 incluye `db:check:test` y `test:app` para Cifrado. Los contratos de M16.1, M16c y M28.2a siguen separados. |
| 4 | Decisiones | PASS | S §Decisiones de la microfase, D-M06.3a-01–11; Q1–Q11 confirmadas por el usuario y sin contradicción con CA/DEC de la ruta. |
| 5 | Trampas | PASS | P II.6; S §Trampas y riesgos, T-04/T-10 y §Diseño: IV aleatorio por sellado, versión ausente diferenciada, pooler, recifrado y `server-only` en Vitest. |
| 6 | Intervenciones y acciones reservadas | PASS | P III.2/ficha; S §Intervenciones del usuario y acciones reservadas: contraseña y variables tienen pasos; push, despliegue y `db:push` de ambos proyectos siguen reservados al usuario, con comprobaciones posteriores. |
| 7 | Verificación | PASS | P III.3; R §14; S §Verificación, §12 y T-31/T-37: `db:check:test` + `test:app` efectivos, suite real del rol sin skip, sin URL runtime como fallback y fallo ante variable faltante/inválida/otro proyecto (CB-06). |
| 8 | Dependencias | PASS | `docs/PROJECT_STATE.md`: G-K01, G-K02-K04 y G-DB-META aprobados; K01–K04 y migración 0012 presentes. Sesiones M05.1.1, M05.1.2–M05.1.4 y M06.1a–M06.2a registran el cierre. |
| 9 | Lo entregado de verdad | PASS | S:323 y T-52:589 dicen **diez**, igual que el `z.strictObject` entregado en `src/modules/integrations/contract/credential.ts:37-60`. S proyecta exactamente los diez nombres de ese contrato; status/provider/generation quedan fuera. SQL 0012 y K01/K04 se consumen según sus interfaces reales. |
| 10 | Pendientes y hallazgos | PASS | S §Hallazgos relacionados y `docs/HALLAZGOS.md`: H-E1-17 resuelto como convención de test; H-E1-36 con login aquí y endurecimiento en M16c; H-E1-37 mitigación futura solo a nivel repository, SQL más amplio; H-E1-41 resuelto documentalmente por categorías. |
| 11 | Contexto real | PASS | Referencias `archivo:línea` de S §Contexto verificado contrastadas con K01/K04, `0012_integrations.sql`, scripts y pruebas; la anterior referencia errónea a H-E1-36 fue reemplazada por la entrada estable. |
| 12 | Archivos previstos | PASS | S §Archivos previstos frente a P II.6 y Q2: `package-lock.json`, `scripts/lib/sql-target.mjs`, README limitado, `.env.example` y suite app tienen autorización. |
| 13 | Diseño suficiente | PASS | S §§5–7 y C-27: `Queryable`, errores tipados, respuesta SQL, estados y proyección K04 están definidos. S:322–325 distingue lifecycle/contexto validado fuera de K04 y objeto nuevo de diez campos antes de `secretCredentialSchema`. |
| 14 | Verificable | PASS | S §Casos de prueba T-01–T-53, comandos de `package.json` y resultados concretos, incluidos negativos. T-52:589 exige proyección a **diez** campos K04, ahora satisfacible con el contrato entregado. |
| 15 | Sin nada abierto | PASS | S §Preguntas abiertas: Q1–Q11 y grill cerrados, spec aún BORRADOR. H-S-01–06 tienen prueba o microfase asignada; H-S-05 verifica TLS del endpoint sin sustituir T-31 de login. |
| 16 | Ejecutable ahora | PASS | `npm run verify` terminó con exit 0 tras repetición fuera del sandbox: lint, typegen, typecheck, Vitest 8 archivos/145 pruebas y build. Scripts existentes; variables futuras se añaden en `.env.example` durante II.6 paso 10, antes de utilizarlas. |
| 17 | Consistencia interna | PASS | S §6:323 y T-52:589 coinciden en diez campos; C-27 pide proyección K04 exacta. §Fuera de alcance no excluye nada exigido por los criterios. |
| 18 | Reglas no negociables | PASS | S §§5–7, 10, 12 y §Trampas: empresa de K01, credenciales solo por `worker_api`, proyecto desechable, errores redactados y ninguna migración. TLS rechaza parámetros de URL, fija `sslnegotiation: 'postgres'` y conserva validación de CA/hostname. |

## Puntos críticos conservados

- **A-01 de spec-audit-2:** S:323 dice «diez propiedades» y T-52:589 «diez campos K04». `SecretCredential` tiene exactamente `connection_id`, `company_id`, `ciphertext`, `iv`, `auth_tag`, `key_version`, `token_type`, `issued_for_app_id`, `granted_scopes` y `expires_at`. La fila SQL valida provider/status/generation fuera del objeto K04 y solo después valida la proyección estricta y descifra.
- **Q1:** el gate exige `db:check:test` y `test:app` sin skip ni fallback. Este audit no ejecuta la suite nueva: todavía no existe.
- **Q11 y Q5:** ambas URLs rechazan los parámetros que `pg` interpreta como TLS, incluido `sslnegotiation`; `PGSSLNEGOTIATION` no sustituye la configuración explícita. La huella de la CA es evidencia del PEM versionado, no pinning del peer en runtime.
- **Q10/Q6:** una credencial ya autenticada puede devolverse con `rewrap: unconfirmed`; `keyVersion` conserva la versión realmente leída, sin afirmar persistencia del rewrap ni reintentar automáticamente.
- **H-E1-17/H-E1-36/H-E1-37/H-E1-41:** respectivamente convención de mock resuelta y pendiente de aplicar en suites; login real obligatorio aquí con endurecimiento SQL diferido a M16c; mitigación/límite aceptado solo en repository, no resolución integral de SQL; resolución documental por categorías con matriz exacta en migraciones/pgTAP.

## Contradicciones

Ninguna.

## Hallazgos

Ninguno.

## Comprobaciones y siguiente paso

`git diff --check`: exit 0. La primera ejecución de `npm run verify` pasó lint/typegen/typecheck y se detuvo al cargar Vitest por `spawn EPERM` del sandbox; la repetición autorizada fuera de él terminó con **exit 0**: 8 archivos, 145 pruebas y build completo. No se corrieron `db:check:test`, `test:app` ni pgTAP: son evidencia futura de la implementación, no del baseline documental. No se inspeccionó manualmente `.env.local` ni se imprimieron valores de entorno.

El usuario puede revisar este veredicto y, si aprueba la spec, pasarla visiblemente a **APROBADA** antes del siguiente paso del pipeline. Esta auditoría no cambia `**Estado:** BORRADOR`, no aprueba `G-CRYPTO`, no inicia plan-audit ni implementación. No hay evidencia suficiente de que el corte exceda el límite de 8 horas; no se propone dividirlo.
