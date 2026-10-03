# M06.3a — Auditoría de plan 1

- Fecha: 2026-10-01.
- Commit base: `f96b3b3a0c49e6e67d132724fee7ba629e60170f` (`main`).
- Spec: `docs/FASES/FASE1/M06.3a/spec.md`, **APROBADA**.
- Hash de contenido de la spec, excluida la línea `**Estado:**`: `73916504c73990df7a2d38ff18b7ea7f3c592375`.
- Plan: `docs/FASES/FASE1/M06.3a/plan.md`, **BORRADOR**.
- Hash de contenido del plan, excluida la línea `**Estado:**`: `41e59d872e417b616fd9c2a3895f626594a4c25e`.
- Alcance de escritura de esta auditoría: únicamente este informe. Se preservan el plan, las modificaciones preexistentes de la spec, la spec general y HALLAZGOS, y todas las auditorías anteriores.

## Precondiciones

Las cuatro precondiciones pasan: la spec está APROBADA; la última auditoría, `spec-audit-5.md`, es APROBABLE; su hash coincide con el contenido actual; el plan existe. El cambio de estado posterior a esa auditoría no altera el hash de contenido. Las menciones históricas a BORRADOR no se toman como el estado vigente ni se reescriben.

Los hashes se calcularon en memoria con el formato de objeto Git (`blob`, longitud en bytes, NUL y contenido), quitando exclusivamente la línea de estado y preservando los restantes bytes. Es equivalente a la fórmula de las plantillas y no escribe objetos Git ni archivos temporales.

En este informe, **P** es el plan de M06.3a; **S**, su spec; **R**, `docs/FASES/FASE1/meta_first/plan.md`.

## Veredicto

**REQUIERE CAMBIOS.** La cobertura es completa, pero dos verificaciones intermedias se exigen antes de que existan sus prerrequisitos. Debe corregirse el orden de comprobación del build y de T-24. No hace falta ampliar archivos, cambiar contratos ni modificar la spec para resolver estos hallazgos.

El plan permanece BORRADOR y G-CRYPTO sigue pendiente. Esta auditoría no ejecuta la implementación ni acredita las pruebas futuras.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---|---|---|---|
| 1 | Spec base | PASS | P:7 cita S y el hash `73916504...`; coincide con el cálculo actual y con `spec-audit-5.md`. |
| 2 | Cobertura | PASS | P:54 declara rangos inclusivos y conservación de resultados esperados. Expansión de la columna de trazabilidad: 27 criterios y 53 casos, sin faltantes. Matriz de cobertura más abajo; se contrastaron además los criterios heredados de S §Criterios de aceptación. |
| 3 | TDD | PASS | P pasos 1–4 escriben pruebas antes de los módulos de 5–7 y de las guardas de 9. El scanner justifica que recorrer un árbol ya limpio no exige fabricar secretos para producir un rojo. La documentación y las comprobaciones manuales tienen revisión/diff. T-37 distingue el fallo esperado de una falla de arranque. Los problemas de orden de las verificaciones se califican en el ítem 5. |
| 4 | Archivos | PASS | P §Archivos coincide con R II.6 para código, suites, dependencias y documentación. Seguimiento autorizado por precondición 8; plan y revisiones autorizados expresamente por precondición 9. README mantiene el recorte de II.6.12. Los cuatro módulos nuevos y las nuevas suites no existen todavía; la sesión M06.3a sí existe, correctamente marcada como modificada. |
| 5 | Pasos y verificaciones | **FAIL** | P paso 8 exige build verde antes de implementar el export del resolvedor en 9, aunque sus consumidores de prueba ya se escriben en 3–4 (P-02). P paso 9 exige T-24 limpio antes de retirar la excepción de SECURITY en 13 (P-01). Las demás dependencias principales están ordenadas: intervención 11 antes de integración 12, documentación de controles vigentes en 13 y gate después de verificación final. |
| 6 | Migraciones | PASS | P §Migraciones no crea ni modifica SQL. El directorio real contiene `0001`–`0012`; `0013` queda para M16c. T-39 exige diff vacío y revisión de archivos nuevos. La reversión de un eventual cambio futuro se haría mediante migración nueva. |
| 7 | Comandos | PASS | Todos los `npm run` citados existen en `package.json`: build, env:prepare, db:check:test, test:app, test:unit, verify y las dos acciones reservadas db:push. P §Verificación final incluye las suites de R III.3 y CB-06; verify no se confunde con test:app. `npm ci --dry-run` es un comando npm, no un script faltante. |
| 8 | Acciones reservadas | PASS | P pasos 11, 15 y 16 y su tabla de intervenciones sitúan contraseña/URL/llavero antes de la prueba real y la aprobación del gate después. Push, despliegue y ambos db:push tienen responsable y comprobación posterior; los db:push no se ejecutan en este corte. |
| 9 | Reglas | PASS | P pasos 1–4 y 9 usan material sintético y pruebas locales sin red; 11–12 requieren destino desechable. Paso 7 conserva K01 y el contrato de S §6; no acepta tenant del navegador. Credenciales por worker_api, consultas directas de tablas únicamente como pruebas negativas de privilegios. No lectura de .env.local por el asistente. |
| 10 | Trampas | PASS | IV/tag y versión ausente: pasos 1/5. URL del rol, refFromDbUrl y exclusión de app: 3/6/9. Date/bigint y errores: 2/6/7. Scanner/fixtures: 3/9. Pool, TLS y server-only: 2/4/6/8/14. Conteo global, concurrencia y reintento exacto: 2/4/7/12. Llavero memoizado: 5 y S §2 incorporado. Lockfile: 8. Variables: 10. Inestabilidad de Vitest y límites de gate: verificación final. |
| 11 | Git | PASS | P paso 0 exige preparar `mf/M06.3a` preservando cambios ajenos, sin reset ni limpieza. Paso 16 reserva push al usuario. La auditoría documental actual en main no ejecuta ese paso de implementación ni publica cambios. |
| 12 | Fidelidad | PASS | P conserva las interfaces y resultados de S §§2–7, la proyección de diez campos K04, Q10/Q11, las operaciones preparadas y el límite de H-E1-37. No introduce OAuth, SQL nuevo, retry automático, infraestructura de retiro, alias global ni dependencias adicionales. Las sondas del pool real son pruebas previstas por T-31/T-32, no una ampliación de la API de producción. |

## Cobertura comprobada

Se expandieron los rangos de la columna «Criterios y casos que cubre». Para criterios operativos se excluyeron las menciones globales de los pasos 14 y 15, evitando que «C-01–27» ocultara un criterio sin trabajo concreto. Resultado: **27/27** criterios operativos y **53/53** casos con paso asignado. Después se revisó la correspondencia semántica; esta cobertura no subsana el orden defectuoso señalado en P-01/P-02.

| Criterios operativos | Pasos concretos |
|---|---|
| C-01–04, C-10 | 1, 5; C-10 también 7 |
| C-05–06, C-09 | 2, 7; C-06 también 4 y 12 |
| C-07–08 | 2, 6 |
| C-11 | 8 |
| C-12–15 | 3, 9; C-13 también 11 |
| C-16 | 13 |
| C-17 | 10 |
| C-18 | 4, 11, 12 |
| C-19 | 4, 8, y revisión final 14 |
| C-20 | 0, 16; comprobación efectiva final 14/T-39 |
| C-21 | 2, 4, 7, 12 |
| C-22 | 7, 13 |
| C-23 | 2, 7 |
| C-24, C-26 | 2, 3, 6, 9 |
| C-25 | 2, 4, 6, 12 |
| C-27 | 2, 6, 7 |

| Casos de prueba | Pasos de preparación/implementación/verificación |
|---|---|
| T-01–11, T-20 | 1 y 5 |
| T-12–16, T-19 | 2 y 7 |
| T-17–18 | 2 y 6 |
| T-21–26 | 3 y 9; T-24 también 14 |
| T-27 | 11 y 14 |
| T-28 | 8 y 14 |
| T-29 | 13 y 14 |
| T-30 | 10 y 14 |
| T-31–36 | 4 y 12 |
| T-37 | 4 y 14 |
| T-38 | 4, 8 y 14 |
| T-39–40 | 14 |
| T-41, T-43 | 4 y 12 |
| T-42 | 2 y 7 |
| T-44 | 13 |
| T-45–46, T-51–52 | 2 y 7 |
| T-47, T-49 | 2, 3, 6 y 9 |
| T-48 | 2, 4, 6 y 12 |
| T-50 | 2 y 6 |
| T-53 | 2, 6 y 7 |

Los criterios heredados quedan cubiertos así:

| Exigencia heredada de S | Pasos |
|---|---|
| CA-21 | 7, 12 y test:app completo en 14, que incluye las restricciones existentes de la Data API |
| CA-23, CA-24, CA-11b | 1, 5, 12 |
| CA-25 | 1, 2, 5, 7, 12, 13 |
| CA-26, CA-27 reescrita | 1–3, 5–7, 9, 14; la parte HTTP de CA-26 sigue fuera de este corte |
| Ficha: implementación y pruebas | 1–14 |
| II.6.4: cliente server-only/pooler/sin name | 2, 6, 12 |
| II.6.7b/T09: guarda del rol | 3, 9, 11, 12 |
| II.6.7c: retiro de excepción de app | 3, 9, 13, 14; con el defecto temporal P-01 |
| II.6.9: documentación de capacidades y componentes | 13 |
| II.6.10: variables sin valores | 10 |
| Trampas de IV y versión ausente | 1, 5 |
| H-E1-36: login real y parada ante fallo | 11, 12 |
| CB-01–06 | 0, 4, 11, 12, 14, 15; suite real obligatoria y evidencia sin secretos |

## Hallazgos

| ID | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| P-01 | media | 9 y 13 | El paso 9 exige que T-24 solo encuentre el literal de la excepción dentro de T-23, pero SECURITY todavía lo contiene y su edición está programada para el paso 13. La verificación de salida del paso 9 no puede pasar en ese estado. | P:37 asigna SECURITY al paso 13; P:67 exige T-24 limpio en 9; P:71 sitúa documentación en 13. `docs/SECURITY.md:291-293` mantiene la excepción, y el comando T-24 de P:109 incluye expresamente ese archivo. S Diseño §8 y T-24 exigen eliminar también esa aparición operativa. | Conservar en 9 la comprobación de guardas y la revisión de la regresión T-23; mover la exigencia de T-24 completo sin coincidencias adicionales al final de 13, después de retirar la excepción de SECURITY, y mantener su repetición final en 14. Actualizar la trazabilidad del paso 13 para incluir C-14/T-24. |
| P-02 | media | 3–4, 8 y 9 | El paso 8 exige `npm run build` verde después de escribir consumidores de `resolveIntegrationsTestTarget`, pero ese export recién se implementa en 9. El build de Next comprueba TypeScript y las suites están incluidas en tsconfig: una importación válida del API proyectado aún no resuelve. | P:61-62 crea pruebas del resolvedor y la suite real; P:66 exige build verde; P:67 implementa el resolvedor. `scripts/lib/sql-target.mjs` solo exporta DISPOSABLE_ACK y resolveSqlTestTarget; `tsconfig.json` incluye `**/*.ts` y no excluye tests; `next.config.ts` no desactiva chequeos. S §12 requiere que la suite use el nuevo resolvedor. Una sonda TypeScript en memoria contra el archivo actual confirmó TS2305 para ese import. | En 8 verificar el movimiento de pg y sincronización del lockfile con los comandos de T-28. Exigir el build verde después de implementar 9, aprovechando el build ya incluido en `npm run verify` del paso 14. Hacer explícito ese traslado, sin añadir stubs, ts-ignore ni desactivar typecheck. |

## Comprobaciones realizadas y límites

- Lectura y contraste de AGENTS, plan/spec de M06.3a, última auditoría de spec, ficha y II.6 de la ruta, precondiciones 8–9, III.2/III.3/III.9, PROJECT_STATE y archivos existentes afectados.
- Inspección de contratos K01/K04, scripts de destino, helpers, suites unitarias actuales, package.json/lockfile, .env.example, README, SECURITY y ARCHITECTURE. Los nuevos módulos y suites se comprobaron como pendientes, no como evidencia de implementación.
- Cálculo de hashes y expansión en memoria de las referencias C/T de la tabla de pasos: sin IDs faltantes. Todos los nombres de scripts npm citados existen.
- Inspección de `supabase/migrations/`: último archivo `0012_integrations.sql`; `git diff --name-only main -- supabase/` sin salida.
- `git diff --check`: exit 0; Git emitió únicamente avisos de normalización LF/CRLF para archivos documentales preexistentes.
- Sonda del compilador TypeScript con un archivo **virtual en memoria** que importa el resolvedor nuevo desde la ubicación de tests/unit. Se usaron las opciones del tsconfig actual con `noEmit: true` e `incremental: false`. Resultado: TS2305, export ausente. No se creó el archivo virtual, caché ni artefacto en disco. Es una comprobación del prerrequisito de P-02, no una ejecución anticipada del build futuro.
- No se ejecutaron verify, test:app, db:check:test, pgTAP, npm install ni migraciones. No se abrió .env.local, no hubo conexiones a bases ni se manipuló Git. Las pruebas de implementación todavía no existen y no se declaran pasadas.

## Observación sobre tamaño

El corte concentra pruebas criptográficas, guardas y acceso remoto, pero esta auditoría documental no aporta evidencia suficiente para afirmar que excederá el límite de ocho horas ni para recomendar una subdivisión concreta. Esta observación no interviene en el veredicto.

## Siguiente paso

Volver a plan mode, corregir P-01 y P-02 y auditar nuevamente el nuevo hash. No editar la spec ni ampliar el alcance para resolverlos. Hasta obtener APROBABLE y aprobación visible del usuario, el plan sigue BORRADOR y no se inicia `$microfase M06.3a`.
