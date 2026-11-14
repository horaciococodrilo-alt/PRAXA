# M26a — Revisión de implementación 1

- **Fecha:** 2026-11-13
- **Rama:** `mf/M26a`
- **Commit revisado:** `6c54f6e37578ea4c53c97dfa8aff63ffbddcdcae` («M26a.3: pantalla, PDF, descarga y documentos del diagnóstico»)
- **Base fija (`git merge-base main HEAD`):** `b0c854dbe47b007adddcecb2a7be30f4b6295309`. **El `main` local está desactualizado.** Va detrás de `origin/main` y no contiene la base documental. Por eso esta base arrastra todo M25a: 163 archivos. La base real de la rama es `origin/main@88fc5b7` (`git merge-base origin/main HEAD`), la que registran la sesión (paso 1) y `PROJECT_STATE.md`. El diff revisado es `88fc5b7..6c54f6e`: 50 archivos, 8363 inserciones y 207 borrados. Ver «Pendientes del usuario».
- **Revisor:** asistente independiente; no corrigió código ni documentos.

## Veredicto

**BLOQUEADO.**

1. **Precondición de estado no cumplida.** La microfase no figura como `VERIFICADO — PENDIENTE DE APROBACIÓN` ni en `docs/PROJECT_STATE.md` (`:30`, «EN CURSO») ni en la sesión (`sesiones/M26a.md:3`, «EN CURSO, etapa .1»).
2. **Orden del plan.** El paso 23 (esta revisión) exige el commit del paso 22b. El 22b exige el acta aprobada (paso 21) y el control 22 en verde (`M26a/plan.md:66-67`). La sesión registra el paso 21 como pendiente del usuario: revisión de los 3 PDF sintéticos, aprobación del acta en sus propiedades de M26a y declaración de comunicación al dueño (`sesiones/M26a.md:317-320`, `:335`). El commit `6c54f6e` existe, pero el paso 22b no está registrado en la sesión.

3. **Entorno:** `test:app` no está en verde por M25a T-28 (`H-E1-216`, R-10), ajeno al código de M26a.

Además, hay hallazgos corregibles dentro de la microfase que llevarían el veredicto a REQUIERE CAMBIOS una vez levantado el bloqueo: R-01 y R-02 (media) y R-03 a R-09 (baja).

## Checklist

| # | Ítem | Resultado | Evidencia |
|---|---|---|---|
| 1 | Alcance | PASS | Los 50 archivos del diff `88fc5b7..HEAD` están en los grupos A–N del plan (`M26a/plan.md:21-36`) y en la lista de II.14. `AGENTS.md` cambia en una sola línea (D-M26a-R6). No se tocaron `next.config.ts`, `scripts/`, `vitest.config.mts`, el chat ni migraciones existentes. No hay funcionalidad de más. `SECURITY.md` (§1, 2, 3, 4, 5, 6, 8, 9 y 12) y `ARCHITECTURE.md` (sistemas externos, módulos, concurrencia y flujo) reflejan las propiedades nuevas, sin conteos ni TTL. `PROJECT_STATE.md` solo registra estado. Observación: el corpus del paso 20 no está escrito (ver R-08); queda bajo la excepción `H-E1-242`. |
| 2 | Criterios | FAIL | Matriz abajo. C-19 / T-21 (unitaria) cubre nombres con instrucciones pero no páginas web con instrucciones (R-02). C-17, T-19, T-20, T-21 eval y T-31 no se ejecutaron por decisión del usuario (`H-E1-242`): cuentan como no ejecutadas (CB-06) y `G-DIAG` solo puede aprobarse con esa excepción explícita. |
| 3 | Roturas detectadas | PASS | 3 de 3 roturas detectadas en un worktree aislado del commit revisado (tabla abajo). El worktree se eliminó. |
| 4 | Reejecución | BLOQUEO (entorno, preexistente) | `verify`, `db:check:test` y `test:policies` coinciden con la sesión. `test:app` da 13 de 14 archivos OK, incluido `meta-diagnostics`, con 90 pasadas, 7 omitidas y **1 fallida**: M25a T-28 de `chat-tools` (ranking de 500 anuncios × 93 días), con `57014` por el timeout del rol. Se reprodujo al repetirlo solo. M26a no cambia el chat, sus migraciones `0018`–`0021`, índices ni tablas compartidas, y `meta-diagnostics` verifica su limpieza (`pendingCleanupCount() === 0`). Es el margen estrecho ya abierto como `H-E1-216` (~7 s frente a 8 s), ahora cruzado: 7744 y 7811 ms en la primera consulta (R-10). |
| 5 | Seguridad y reglas | PASS | Sin claves `sk-ant-…` completas en el árbol. Sin asignaciones literales de `ANTHROPIC_API_KEY`. `ANTHROPIC_API_KEY` solo en `provider.ts` dentro de `src/`. Los `act_9000…` de `17_meta_diagnostics.test.sql` son sintéticos (misma convención que `13`–`16`). Ninguna lectura de `.env.local` en `src/`; el arnés eval usa `loadEnv()` como el del chat. Sin `service_role` ni `sb_secret`. Migraciones: solo `A 0022_meta_diagnostics.sql`, ningún renombre ni modificación. Tenant por K01 en acciones, página, ruta y `app-data`. Errores con clase o texto fijo (`DiagnosticReadError`, `DiagnosticWriteError`, `DiagnosticProviderError`; el cuerpo de un error HTTP no se lee). `server-only` en `provider`, `orchestrator`, `eligibility` y `pdf`; el componente cliente importa solo tipos y las Server Actions. |
| 6 | Calidad funcional | FAIL | Están implementados los caminos de error de la spec: liberación única, reparación única, `too_large`, `timeout`, `sync_changed`, `connection_changed`, 404/307/500 de la descarga y error de lectura visible. Tipos estrictos, sin `any`; sin TODO. **R-01:** el catálogo que valida el guardado del objetivo no es el que muestra la pantalla. Menores: R-03, R-06 y R-07. |
| 7 | Evidencia | FAIL | La sesión registra comandos y resultados reales hasta el paso 22, y los hallazgos nuevos tienen ID (`H-E1-240` a `H-E1-242`). Pero falta el paso 22b. El encabezado de la sesión, `PROJECT_STATE.md` y `H-E1-240` quedaron desactualizados (R-05). `git diff --check` contra la base no está limpio, aunque la sesión lo declara limpio (R-04). El gate `G-DIAG` no figura como aprobado: correcto. |
| 8 | Contradicciones | BLOQUEO | El commit `.3` y esta revisión se adelantan al paso 21 (acta aprobada y PDF revisados), contra el orden de `M26a/plan.md:66-67`. No hay otra contradicción con la spec (hashes de spec y plan sin cambios: `6c2f2f65…` y `8fa7cd4b…`, iguales a `PROJECT_STATE.md`) ni con `AGENTS.md`. |

## Matriz de criterios

| Criterio | Prueba | ¿La aserción verifica el criterio? | Resultado |
|---|---|---|---|
| C-01 objetivo por empresa, lista del servidor | T-01 `diagnostics-goal.test.ts` (7 casos); T-02 pgTAP `17`; T-27 `diagnostico.test.tsx` | Sí (forma, catálogo y campos extra). No cubre que el catálogo validado sea el mismo que el mostrado (R-01). | Pasa |
| C-02 bloqueos con motivo de la base | T-03 pgTAP `17` (24 aserciones); T-04 app; T-33 orquestador; T-26; T-29 | Sí | Pasa (pgTAP y unit; app: ver reejecución) |
| C-03 plazo de 24 h, concurrencia e idempotencia | T-05 app; T-06/T-07 pgTAP; T-33 | Sí | Pasa |
| C-04 cero actividad y falta de cobertura | T-08 evidencia; T-33 «cero actividad / falta de cobertura: sin reserva ni modelo»; T-26 | Sí | Pasa |
| C-05 todas las entidades, por clave, manifiesto | T-09, T-10 (recorrido, bucle, lotes, `too_large`); T-11 app (más de 1000 entidades) | Sí | Pasa |
| C-06 ventana, comparación, días abiertos e inmutabilidad | T-09; T-06 pgTAP (inmutable tras sincronización nueva); `diagnostics-evidence` «ventana» | Sí | Pasa |
| C-07 cifras exactas y no calculable | T-12 y T-13 pgTAP; T-13 unit; T-11 app (decimales fuera de `number`) | Sí | Pasa |
| C-08 desgloses estimados | T-14 pgTAP y unit | Sí | Pasa |
| C-09 paso web separado y validado | T-15 `diagnostics-web.test.ts`; T-16 | Sí | Pasa |
| C-10 validación de la salida | T-17, T-18 `diagnostics-contract.test.ts`; T-33 (reparación única) | Sí (rotura 1 y 3 detectadas) | Pasa |
| C-11 plantilla, hasta 3 oportunidades, causas cerradas | T-17; T-24 «plantilla de secciones fijas» | Sí | Pasa |
| C-12 publicación atómica | T-06 pgTAP (md5 del anterior tras cada fallo); T-23 app; T-33 | Sí (rotura 2 detectada) | Pasa |
| C-13 oculto tras desconectar, cascada | T-22 pgTAP; T-23/T-25 app | Sí | Pasa (pgTAP; app: ver reejecución) |
| C-14 PDF fiel | T-24 `diagnostics-pdf.test.ts` (árbol igual al modelo, acentos/ñ, más de una página, bytes); T-25 app (cabeceras); T-32 manual **pendiente** | Sí. La ruta `route.ts` se prueba a través de `diagnosticDownload` con dependencias inyectadas, no por HTTP; el cableado real queda para el paso 24. | Pasa (automático); T-32 pendiente del usuario |
| C-15 solo el dueño; sin IDs del cliente | T-01; T-02; T-23; T-27 | Sí | Pasa |
| C-16 documentos antes de datos reales | T-30 (documental) | Sí; el acta está **pendiente de aprobación** | Documentos actualizados; aprobación pendiente |
| C-17 evaluación con Anthropic real | T-19, T-20, T-31 | No ejecutada (`H-E1-242`); el corpus del paso 20 no está escrito (R-08) | **No ejecutada** (CB-06) |
| C-18 clave y logs | T-28 `diagnostics-secrets.test.ts`; T-16 | Sí | Pasa |
| C-19 adversarios de nombres y web | T-21 unitaria (solo nombres) | **Parcial**: no hay caso de página web con instrucciones (R-02); la parte eval no se ejecutó (`H-E1-242`) | Pasa lo existente; cobertura incompleta |
| Heredados: ficha, §16.1–§16.7, CA-00/00b, CA-38/38b/38c, CA-40, CA-41–CA-47b, §11, CA-67/68, CB-01–06 | pgTAP `09`, `10`, `17`; app; unit | Sí, salvo «prueba adversaria de web y proveedor» (R-02, `H-E1-242`) y CB-06 (excepción del usuario) | Ver arriba |

## Roturas (worktree aislado `../praxa-review-M26a`, commit `6c54f6e`, `npm ci`)

Línea de base en el worktree: `diagnostics-contract` y `diagnostics-orchestrator`, 87/87.

| Criterio | Rotura | Prueba que la detectó | ¿Probada en worktree? |
|---|---|---|---|
| C-10 (sin numerales libres) | `validate.ts`: quitar `'veinti'` de `PREFIXES` | `diagnostics-contract.test.ts` › T-18 «rechaza «Fueron veintidós días»» (1 fallida) | Sí; restaurada con `git checkout --` |
| C-03/C-12 (liberación única tras la reserva) | `orchestrator.ts:379`: quitar `await release()` en `fail` | `diagnostics-orchestrator.test.ts` › T-33: 4 fallidas (proveedor, salida inválida dos veces, plazo vencido, lote inválido) | Sí; restaurada |
| C-10/§16.4 (baja muestra solo como hipótesis) | `validate.ts`: quitar `cited.some((e) => e.sample === 'low_sample')` | `diagnostics-contract.test.ts` › T-18 «un hecho sin evidencia de sistema o con baja muestra se rechaza» | Sí; restaurada |
| C-14 (cabeceras `private, no-store`) | — | Solo la cubre T-25 en `test:app` | No: necesita el desechable y variables de `.env.local` |

`git worktree remove ../praxa-review-M26a` ejecutado; `git worktree list` ya no lo muestra.

## Comandos reejecutados (directorio del usuario, sin modificarlo)

| Comando | Resultado | Sesión (paso 22) | ¿Coincide? |
|---|---|---|---|
| `powershell -NoProfile -Command "npm run verify"` | Exit 0: lint, typegen, typecheck, **49 archivos / 1198 pruebas**, build | 49 / 1198, exit 0 | Sí |
| `npm run db:check:test` | «Destino verificado.», exit 0 | Igual | Sí |
| `npm run test:policies` | 18 archivos, 19 ejecuciones, **1087** aserciones, 0 problemas (`17` 127/127) | 1087/1087 | Sí |
| `powershell -NoProfile -Command "npm run test:app"` | Exit 1: 14 archivos, **13 OK, 1 con fallo**; 98 pruebas: **90 pasadas, 1 fallida, 7 omitidas** (las mismas omisiones conocidas). Falla M25a T-28 de `chat-tools`: «T-28 ranking Data API sin tendencia: 7744 ms», y la segunda consulta da `57014 canceling statement due to statement timeout`. | 14 OK; 91 pasadas, 7 omitidas | **No** (diferencia de resultado, ver R-10) |
| `powershell -NoProfile -Command "npm run test:app -- tests/app/chat-tools.test.ts"` (repetición) | 1 fallida, 4 pasadas; 7811 ms y el mismo `57014` | — | Se reproduce |
| `npm run test:eval -- tests/eval/diagnostics-eval.test.ts` | **No ejecutado:** decisión del usuario `H-E1-242` (pruebas pagas) | No ejecutado | Pendiente del usuario |
| `git diff --check 88fc5b7 HEAD` | `src/modules/diagnostics/orchestrator.ts:500: new blank line at EOF.` | «Sin problemas» | **No** (R-04) |
| Hash de contenido de spec y plan sin `**Estado:**` | `6c2f2f65999ffd4c9904861aeaa43932a56aa2cb` / `8fa7cd4b74a8684e4da303abc22ed54adbdb2166` | Iguales | Sí |

## Hallazgos

| ID | Severidad | Archivo:línea | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| R-01 | media | `src/modules/diagnostics/actions.ts:37`; `src/modules/app-data/index.ts:139-141` | El guardado del objetivo valida contra otro catálogo que el que muestra la pantalla. La pantalla ofrece los tipos de acción de la ventana que termina en el `window_to` de la elegibilidad. La Server Action valida siempre contra la ventana que termina ayer en UTC (`catalogWindowTo(null)`). Contradice la decisión registrada en `sesiones/M26a.md:269`. | `window_to` suele ser el día local abierto (spec §2), así que las ventanas se desplazan. Un tipo observado solo en el último día de la ventana visible aparece en la lista y al guardarlo da `objetivo_invalido`. Con una sincronización vieja la diferencia es mayor. Ninguna prueba compara las dos ventanas: los mocks de `readActionTypes` ignoran la ventana. | En la acción, leer la elegibilidad de la conexión viva y usar `catalogWindowTo(eligibility.window_to)`, igual que `getDiagnostico`. Agregar una prueba que fije que ambos usan la misma ventana. |
| R-02 | media | `tests/unit/diagnostics-contract.test.ts:350-370`; `tests/unit/diagnostics-web.test.ts` | T-21 unitaria cubre solo nombres de entidad con instrucciones. La spec exige también «páginas web con instrucciones» (T-21, C-19, «prueba adversaria de web» de la ficha). La excepción `H-E1-242` abarca solo la parte eval de T-21, no la unitaria. | `grep -i "instrucc\|ignor\|SELECT"` en las suites web y del orquestador no encuentra casos web. Un extracto sin cifras con «ignorá lo anterior…» pasa `extractWebContext` y viaja al modelo; no hay prueba que fije que no altera esquema, referencias ni valores. | Agregar casos unitarios con extractos y títulos web adversarios. Fijar que viajan solo dentro del bloque de datos `FUENTES_WEB`, que no cambian el esquema enviado y que una salida que los obedece (evidencia o índice inventados, cifras) se rechaza. |
| R-03 | baja | `src/modules/diagnostics/validate.ts:105` | `/\d/` sin bandera `u` solo detecta dígitos ASCII. La spec rechaza «todo dígito». Los dígitos de ancho completo (`５`), los superíndices (`²`) y los de otros sistemas pasan, porque `normalize('NFD')` no los convierte. | `node -e "/\d/.test('５')"` da `false`; también `'²'` y `'٣'`. | Usar `/\p{Nd}|\p{No}/u` (o normalizar con NFKD antes del chequeo) y agregar el caso a T-18. |
| R-04 | baja | `src/modules/diagnostics/orchestrator.ts:500` | Línea en blanco al final del archivo. `git diff --check` de la microfase no está limpio, aunque la sesión lo declara limpio. Probablemente se corrió sin rango, sobre el árbol, después del commit de `.2`. | `git diff --check 88fc5b7 HEAD`. | Quitar la línea y registrar el comando con el rango de la base en la sesión. |
| R-05 | baja | `sesiones/M26a.md:3`; `docs/PROJECT_STATE.md:30`; `docs/HALLAZGOS.md` (`H-E1-240`) | El seguimiento quedó desactualizado o contradictorio. La sesión dice «EN CURSO, etapa .1». `PROJECT_STATE` dice «`.2` commiteada» y, en la misma entrada, «implementación de `.2` sin commit» y «`.3` … sin commit», aunque `6c54f6e` existe. `H-E1-240` sigue «falta reaplicar en el desechable», pero el paso 5 bis lo declara resuelto. Falta el paso 22b. | Lectura de los tres archivos contra `git log`. | Al cerrar el paso 21, registrar el 22b (hash y rutas), actualizar el encabezado, la entrada de `PROJECT_STATE` y el estado de `H-E1-240`. |
| R-06 | baja | `src/modules/diagnostics/orchestrator.ts:389-399`, `:486-496` | `levelStatus` (cobertura por nivel) se lee del resumen en `loadGenerationContext`, antes de la elegibilidad. Si una sincronización termina entre las dos lecturas, la ventana y la reserva quedan fijadas a la sincronización nueva. La cobertura por nivel y el límite `partial_coverage` quedan, en cambio, con la anterior. | Carrera estrecha; no la detecta ninguna prueba. | Leer los niveles con la elegibilidad, o comparar `finished_at` del resumen leído con `eligibility.sync_finished_at` y fallar con `sync_changed` si difieren. |
| R-07 | baja | `src/modules/diagnostics/compose.ts:226-227`, `:254`, `:313` | Redacción del documento. (a) El aviso de atribución desconocida en «Rendimiento general» también se dispara por los desgloses, que siempre son `unknown`, aun con atribución de cuenta informada. (b) El estado de la entidad sale crudo (`ACTIVE`, `PAUSED`). (c) «publicada hace: March 5, 2025» o «3 days ago»: `page_age` en inglés y con una preposición que no corresponde a una fecha absoluta. | Lectura del código. | (a) Limitar el aviso a la evidencia de cuenta sin segmento. (b) Traducir los estados conocidos. (c) Rotular «antigüedad informada por la fuente: …» o normalizar la fecha. Verificar en la revisión visible (T-32). |
| R-08 | baja | `tests/eval/diagnostics-eval.test.ts:133-` ; `docs/HALLAZGOS.md` (`H-E1-242`) | El archivo eval contiene solo la evaluación inicial de `.2`: T-19 y las 7 categorías con una corrida. No contiene el corpus del paso 20 (13 casos, 6 adversarios con nombres y páginas web, 3 corridas, los 7 umbrales de C-17) ni la salida de T-31 (PDF y texto en un directorio temporal). `H-E1-242` dice que el archivo «queda en el árbol y no se corre», pero no dice que el corpus no está escrito. | `grep` de `ADVERSARIAL`, `T-31` y corridas en `tests/eval/`. | Declararlo en `H-E1-242` (la revaluación con el modelo real exige escribir el corpus antes), o escribir el arnés sin ejecutarlo. Decisión del usuario. |
| R-09 | baja | `src/modules/diagnostics/web.ts:85` | `allowedHost` acepta cualquier subdominio de `cace.org.ar` y de `www.indec.gob.ar`, mientras la sesión registra que «un host nuevo requiere una aprobación nueva» (`sesiones/M26a.md:115`). Coincide con la semántica de `allowed_domains` de la herramienta, pero la aprobación fue por dominio, sin decir nada de los subdominios. | `host.endsWith(\`.${d}\`)`. | Que el usuario confirme si los subdominios quedan aprobados. Si no, exigir igualdad de host y probarlo en T-15. |

| R-10 | media (entorno, preexistente; no atribuible a M26a) | `tests/app/chat-tools.test.ts:198` (M25a) | El control final de M26a no está en verde: falla M25a T-28 por el timeout de 8 s del rol en el desechable. `H-E1-216` registraba un margen de unos 7 s; hoy la primera consulta mide 7,7–7,8 s y la segunda se cancela. | Dos corridas: completa y aislada. `git diff 88fc5b7 HEAD` no toca `src/modules/chat`, `0018`–`0021` ni `chat-tools.test.ts`. `0022` no crea índices ni modifica tablas compartidas. | No corregir dentro de M26a. Actualizar `H-E1-216` con estas mediciones y decidir (usuario) si se trata en una microfase de M25a o se acepta como excepción de entorno. Repetir `test:app` antes de la próxima revisión. |

## Pendientes del usuario

1. **Paso 21:** revisar los 3 PDF sintéticos con la lista de T-32. Aprobar o rechazar el acta M03a solo en sus propiedades de M26a y declarar la comunicación al dueño. Después, registrar el paso 22b y dejar la microfase en `VERIFICADO — PENDIENTE DE APROBACIÓN` antes de repetir esta revisión.
2. **`main` local:** actualizarlo (`git switch main && git pull --ff-only`, en el worktree que lo tiene tomado), para que `git merge-base main HEAD` dé `88fc5b7` y el manifiesto de `qa-review` sea el de la microfase.
3. **`H-E1-242`:** mantener o revisar la excepción. `test:eval` del diagnóstico no se ejecutó y `G-DIAG` solo puede aprobarse con la excepción explícita (CB-06). Decidir también lo de R-08 y R-09.
4. **R-10 / `H-E1-216`:** decidir el tratamiento del timeout de M25a T-28 en el desechable. Mientras siga, `test:app` no queda en verde.
5. Corregir R-01 y R-02 (y, si se decide, R-03 a R-07) dentro de M26a con `/microfase M26a`, commitear con rutas explícitas y repetir esta revisión sobre el commit nuevo.

## Comprobación final

- `git rev-parse HEAD` al terminar: `6c54f6e37578ea4c53c97dfa8aff63ffbddcdcae`, sin cambios.
- El comando de árbol limpio del paso 1 no devuelve nada; el único archivo nuevo es este informe.
- `git worktree list` no muestra `../praxa-review-M26a`. Los worktrees preexistentes del usuario (`praxa-fix-124` y `praxa-review-m25a-audit13`, este último con `main`) no se tocaron.
