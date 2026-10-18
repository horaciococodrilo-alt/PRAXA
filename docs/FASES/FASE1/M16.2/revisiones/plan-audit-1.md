# M16.2 — Auditoría del plan, ronda 1

- **Fecha:** 2026-10-16 (America/Buenos_Aires).
- **Repositorio:** `C:\Users\Simon\dev\PRAXA`.
- **Commit inspeccionado:** `65404aa100788a4eab5e98dbcfa6c116c8fa0bc1`, rama `main`.
- **Spec base:** `docs/FASES/FASE1/M16.2/spec.md`, estado `APROBADA`.
- **Última auditoría de spec:** `revisiones/spec-audit-4.md`, **APROBABLE**.
- **Hash de contenido de la spec:** `0b92d68f3042983fb37fd0339d9715071758cc7b`.
- **Plan auditado:** `docs/FASES/FASE1/M16.2/plan.md`, estado `BORRADOR`.
- **Hash de contenido del plan:** `48dfdd92552fb1adda653887755d097b067a7710`.

Los hashes excluyen únicamente las líneas que empiezan por `**Estado:**`. Se calcularon sobre los bytes UTF-8 restantes con el encabezado de objeto Git `blob <longitud>\0`, equivalente al procedimiento `grep -v '^\*\*Estado:\*\*' <archivo> | git hash-object --stdin`. El hash actual de la spec coincide tanto con el de spec-audit-4 como con el citado por el plan.

## Veredicto

**APROBABLE. Los 12 ítems están en PASS.**

Las cuatro precondiciones se cumplen: spec APROBADA, última auditoría APROBABLE, coincidencia del hash de contenido y existencia del plan. La aprobación de la spec fue reflejada por el usuario antes de continuar esta auditoría. La frase introductoria del plan que describe el anterior estado BORRADOR quedó superada por ese cambio; su paso 0 exige comprobar el estado vigente y el hash antes de implementar.

## Fuentes y alcance de la verificación

Se contrastaron la spec completa y el plan de M16.2 con `AGENTS.md`; la ficha de M16.2 de Parte I, II.10, III.3 y III.9 del plan meta_first; las enmiendas aprobadas de la ruta y la reasignación a M16c; `package.json`; la secuencia de migraciones; `PROJECT_STATE.md`, `HALLAZGOS.md`, `SECURITY.md` y `ARCHITECTURE.md`.

Se inspeccionaron los módulos existentes que el plan modifica (`meta/api`, `client`, `tokens`, `errors`, `oauth`, `outcomes`, `repository/connections`, la página Integraciones y `app-data`), sus pruebas unitarias, de componentes y de aplicación afectadas, y los contratos de credenciales y funciones de ciclo de vida de `0012` que reutilizan. Los archivos nuevos se contrastaron con sus interfaces y pruebas definidas en la spec.

La comprobación estática de las referencias de la tabla de pasos encontró **45/45 criterios operativos y 51/51 casos activos**, sin IDs sin paso. La comparación de rutas encontró **31 archivos previstos**, todos contenidos en II.10 o en el seguimiento permitido. Los seis comandos npm de verificación existen en `package.json`.

`git status --short` y `git diff --stat` identificaron cambios documentales preexistentes en el plan y la spec de meta_first, HALLAZGOS y la carpeta M16.2 sin seguimiento. Se preservaron. `git diff --check` terminó con exit 0 sobre el diff seguido; ese comando no acredita el contenido de archivos nuevos sin seguimiento. La inspección de la spec y del plan incluyó sus archivos reales en disco.

Esta es una auditoría del plan: no se ejecutaron suites de implementación, preflight, llamadas a Meta, migraciones ni pruebas contra bases de datos. Los PASS siguientes acreditan que el plan cumple el checklist, no que M16.2 esté implementada ni que G-VR01 esté aprobado.

## Checklist

| # | Ítem | Resultado | Evidencia |
|---:|---|---|---|
| 1 | Spec base | PASS | Encabezado del plan cita la spec y `0b92d68f…`; el hash recalculado coincide con spec-audit-4. La spec actual está APROBADA. Paso 0 vuelve a comprobar estado, auditorías y hashes. |
| 2 | Cobertura | PASS | Tabla de pasos 0–17: los 45 criterios C-01 a C-46, salvo C-43 retirado, y los 51 casos T-01 a T-52, salvo T-49 retirado, tienen destino. Los criterios heredados se cubren por los pasos y comprobaciones detallados abajo. VD-01 conserva su condición de verificación posterior al despliegue. |
| 3 | TDD | PASS | Regla TDD anterior a la tabla: pruebas y rojo por comportamiento antes del código. T-30 a T-38 se preparan en 0; los pasos 1–8 y 10 escriben primero sus pruebas. Verificación final distingue guardas, regresión, corridas de cierre, documentación y recorridos manuales, para los que no exige un rojo artificial. |
| 4 | Archivos | PASS | F01–F28 están en la tabla vigente de II.10. F29–F31 son HALLAZGOS, PROJECT_STATE y meta_first/sesiones/M16.2.md. II.10.9d ya está aplicado y aprobado: 0 y 11 verifican su contenido. El plan no agrega archivos de implementación por fuera de esa lista. |
| 5 | Pasos | PASS | Preparación de pruebas → transporte/revocación → cuentas/probe → adaptadores → purga → selección → reautorización → efectos → UI → integración → preflight → documentación y verificación → intervenciones reales. Cada fila tiene verificación propia; 13–16 bloquean sus dependientes si falta el resultado exigido. Las interfaces de detalle se remiten expresamente a Diseño §§2b–13 y §20 de la spec. |
| 6 | Migraciones | PASS | No aplica una migración nueva en M16.2. El directorio termina en `0014_profile_photos.sql`; `0015` queda para M16c. La sección Migraciones prohíbe editar las existentes y exige otra migración nueva para una reversión de esquema. Pasos 0 y 12 verifican que no haya cambios SQL. |
| 7 | Comandos | PASS | `test:unit`, `test:component`, `db:check:test`, `test:policies`, `test:app` y `verify` existen. `verify` contiene lint, typegen, typecheck, unit/component y build. Se incluyen las suites de III.3, alta y VR-01. CB-06 aparece en 0, 12, 17 y Verificación final: una prueba obligatoria omitida bloquea; las opt-in ajenas se individualizan. El preflight usa Node directo, como exige la spec, sin inventar un script npm. |
| 8 | Acciones reservadas | PASS | Tabla de intervenciones: preflight real en 13; acta/P-04, publicación, merge/push/despliegue y VD-01 en 14; alta y cierre de registro en 15; recorrido real en 16; aprobación de G-VR01 en 17. Cada intervención tiene resultado posterior exigido. `db:push` a app y `db:push:test` se declaran no aplicables y se verifican mediante ausencia de migraciones. La reparación de un entorno desechable incompleto queda al usuario. |
| 9 | Reglas | PASS | 3 y 5 construyen/validan K01 y usan RLS para estado; credenciales y escrituras pasan por worker_api. 0 y 9 usan proyecto desechable, Meta simulada y guardas sin respaldo a la URL del runtime. 1, 7, 10 y 12 limitan URLs, registros y evidencia; 16 conserva solo el resumen permitido del probe. No se pide leer .env.local ni pegar secretos. |
| 10 | Trampas | PASS | Revocación anterior a purga y reanudación: 4/9; clasificación Graph: 1/7; registro temporal: 15; paginación sin seguir next: 2; dependencias simuladas: 4/6; pendiente vigente/vencida: 4/5/9; límites de logs y evidencia: 7/12/16; escritura ambigua: 6/T-52. El resto se detalla en la matriz de trampas. |
| 11 | Git | PASS | Paso 0 crea o retoma `mf/M16.2` desde la base con M16.1 preservando cambios; prohíbe stash y operaciones destructivas. Verificación final se ejecuta en esa rama. Push, merge y despliegue se reservan al usuario en 14. Que la preparación documental y esta auditoría estén en main no sustituye la rama exigida para implementar. |
| 12 | Fidelidad | PASS | Se mantienen listado, selección, probe, purga, reautorización, recuperación A/B y escritura ambigua, CA-39, estado compartido, preflight, documentación y VR-01. Se respetan las decisiones aprobadas y la reasignación de persistencia de H-E1-22 y pruebas durante sincronización a M16c. No se agregan sincronización, snapshots, variables, dependencias, páginas ni cambios de esquema. |

## Trazabilidad de criterios heredados

| Criterios de la spec | Pasos del plan y evidencia prevista |
|---|---|
| CA-29b, CA-37c | 6 y 9; T-15 a T-20, T-31/T-32 y T-52: consumo, generación, delegación, reemplazo y recuperación. |
| CA-35, CA-36, CA-60 | 2, 5, 8, 9 y 16: paginación completa o fallo, elección explícita, nuevo listado del servidor, UI y recorrido real. |
| CA-37, CA-08 | 2, 3, 5 y 9: validación K03, probe antes de confirmar, vencimiento decidido también por SQL, regresión pgTAP 09b. |
| CA-37b, CA-38, DEC-17 | 4, 5, 8, 9 y 17: bloqueo, revocación, purga acotada/reanudable, cancelación y cierre activo o purgado. |
| CA-38b | 8 y 14, T-50: advertencia en UI y resultado, más verificación del acta antes de VR-01. |
| CA-38c | 6, 7 y 9: carreras, generación esperada y desconexión parcial/completa; T-18, T-21, T-30, T-31 y T-37. |
| CA-39, CA-09 | 1, 3 y 7: clasificación existente, efectos por clase, mensaje redactado, registro sin transición y regresión. |
| CA-40, CA-26 | 1, 2, 5, 7, 8, 10, 12 y 16: secretos fuera de URL, cuenta truncada y clave ligada a conexión, ausencia de valores de Insights y registros cerrados. |
| VR-01, DEC-18, P-04 y P-05 | 13–17: preflight, gates, despliegue/VD-01, alta con registro cerrado después, guion de VR-01 y evidencia de cierre. |
| CB-01 a CB-06 | 0, 9, 12 y 17, más Verificación final: suites, revisión del diff y archivos nuevos, migraciones intactas, destino desechable, evidencia real y omisiones bloqueantes. |

## Trazabilidad de trampas

La numeración corresponde a «Trampas y riesgos» de la spec; 1–4 provienen de II.10.

| Trampas | Paso o verificación que las cubre |
|---|---|
| 1: borrado local frente a revocación/desinstalación | 4, 8, 9 y 16; orden de purga, fallo registrado, texto fijo y revocación real exigida. |
| 2: clasificación por código, no por HTTP | 1 y 7; se conserva classifyGraphError y se prueban las nueve clases. |
| 3–4: registro cerrado y prerrequisitos Meta | 14–16 y paradas de III.9; comprobación del registro cerrado y recuperación conforme a §18. |
| 5–6: consultas con secretos y paging.next | 1, 2, 10, 13 y 16; transporte por lote, cursores, preflight y revocación real, sin fallback con secretos en URL. |
| 7 y 14: límites del hosting y conservación de evidencia | 7, 12, 16 y Riesgos; registros cerrados, evidencia conforme a §18 y copia pronta de logs redactados. El plan no promete controlar los registros del proveedor. |
| 8–10: vencimiento en pruebas, ventana de reauth y zona SQL | 3, 5, 6, 9 y 12; pgTAP 09b, reauth en el callback, validación K03 y traducción de invalid_argument. |
| 11–13: render con efectos, mocks y regresiones de M16.1 | 4, 8 y 9; purga acotada, sin loading.tsx nuevo, mocks de servidor, aserciones de sesión conservadas y ajustes autorizados de las pruebas afectadas. |
| 15–16: credencial pendiente y recifrado al leer | 4, 9 y 17; reutiliza readCredential y verifica estado final. El repositorio existente no recifra disconnected y permanece sin cambios. |
| 17–18: Origin y selección sin identificadores | 5, 8 y 14; formularios POST, VD-01, SHA-256 de conexión:cuenta y HTML sin UUID ni id completo. |
| 19–21: fixtures, estado compartido y preflight local | 0, 7–10, 12 y 13; fixtures sintéticos de la spec, guardas existentes, getIntegraciones sin efectos y con degradación a false, preflight a cargo del usuario. |
| 22: escritura ambigua | 6/T-52; misma operación preparada, relectura antes de revocar y tres resoluciones, sin token ni hash en registros. |

## Hallazgos

| ID (P-NN) | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| — | — | — | Ningún hallazgo del checklist. | Los doce ítems están en PASS. | — |

## Observación de tamaño

M16.2 probablemente excede ocho horas. D-M16.2-11 y la enmienda aprobada de la ruta registran la decisión del usuario de conservar un único corte. Las etapas verificables del plan permiten separar el trabajo dentro de esa microfase: transporte y adaptadores (1–3), ciclo de vida y recuperación (4–7), UI e integración (8–10), y documentación/verificación antes del recorrido real (11–17). Esta observación no modifica el veredicto ni reabre la decisión de tamaño.

## Siguiente paso

El usuario puede aprobar el plan identificado por el hash de este informe y pasar su estado a APROBADO. Después corresponde elegir modelo y esfuerzo, abrir una sesión nueva y ejecutar `$microfase M16.2`.

G-ACTA-META, P-04, preflight real, despliegue, VD-01 y VR-01 conservan sus bloqueos en los pasos correspondientes; esta auditoría no los acredita. No se implementó M16.2 ni se modificó el plan. El único archivo creado por esta auditoría es este informe.
