# M16c — QA final 2

Fecha: 2026-11-08, America/Argentina/Buenos_Aires.

## Estado y veredicto

- Rama `mf/M16c`; HEAD `cd752622f7a906d3c464720a45a2fc2d4f2dd4ea`; main local `718970a4a0623fa3c45c6c79aa44452bc6c1abc7`. La base integral `a27f7270310034cc3e64346684b1f5c5e5a20ae3` fue autorizada por el usuario porque la implementación ya está en main.
- Última revisión de implementación: `implementation-review-3.md`, **APROBABLE**. Hash de estado de la skill frente a main: **`50e061b80b6104104c979840d60bb147ade157a8`**, igual al actual; hash integral frente a la base autorizada: **`b4ed0902de91294a63bf1a61afebf867416833b0`**. Los informes en `revisiones/` están excluidos del cálculo.
- Foto inicial de `git status --porcelain`: tres documentos de seguimiento modificados (`PROJECT_STATE.md`, `HALLAZGOS.md`, `sesiones/M16c.md`) y tres informes no rastreados (`implementation-review-2.md`, `implementation-review-3.md`, `qa-review-1.md`). Se preservaron.
- Q-01 de `qa-review-1.md` fue corregido en `PROJECT_STATE.md` y registrado como `H-E1-201`. El documento ahora dice que las tres etapas están implementadas y verificadas y que Q-04 ya está fijado. El código, las pruebas y la migración no cambiaron.

**Veredicto: LISTO PARA PR.** Pasan todos los criterios funcionales, la verificación completa, el ensayo real admitido por D-M16c-02 y el recorrido manual. No queda una acción del usuario necesaria para acreditar este QA: el usuario confirmó la UI y autorizó expresamente aprobar `G-SYNC` y cerrar M16c. El registro formal del gate en `PROJECT_STATE.md`, `HALLAZGOS.md` y la sesión se hace después de este QA; no se inicia M25a.1.

Como la implementación ya se integró en main, `pr.md` queda como descripción de revisión del cambio y del seguimiento documental; no se supone que exista un PR nuevo con el diff de implementación.

## Matriz de comportamiento

P = positivo, N = negativo, B = borde. Cada fila define los tres casos con fuente y resultado; la matriz detallada de escenarios y sus aserciones está en `qa-review-1.md` y no cambió el código desde entonces. T-NN son los casos de la spec.

| Criterio | Caso | Tipo (positivo/negativo/borde) | Cubierto por | Resultado |
|---|---|---|---|---|
| C-01 | P: JWT propio; N: ajena/anon; B: ref adulterada | P/N/B | T-01/02/35 | PASS |
| C-02 | P: cobertura RLS; N: tabla oculta sin SELECT; B: cascada siete tablas | P/N/B | T-01/24/31 | PASS |
| C-03 | P: inicio único; N: competencia; B: lease vencido A→B | P/N/B | T-03/04 | PASS |
| C-04 | P: posesión vigente; N: desplazada no publica; B: espera hasta vencer | P/N/B | T-04/05 | PASS |
| C-05 | P: publicación atómica; N: payload distinto; B: retry idéntico | P/N/B | T-06/20/38 | PASS |
| C-06 | P: cuatro completos; N: parcial; B: cero páginas vs página vacía válida | P/N/B | T-07/08/38 | PASS |
| C-07 | P: cero explícito; N: ausencia no es cero; B: null/sin fila/no observado | P/N/B | T-08/09/10/31 | PASS |
| C-08 | P: metadata histórica; N: UPDATE rechazado; B: cambio de nombre posterior | P/N/B | T-10/11/12 | PASS |
| C-09 | P: decimal exacto; N: número JSON inválido; B: límites 128/bigint | P/N/B | T-13/14 | PASS |
| C-10 | P: flag parcial; N: instante inválido; B: DST/medianoche/reloj | P/N/B | T-15/16/37 | PASS |
| C-11 | P: cuatro niveles locales; N: sin breakdown; B: 29 de febrero | P/N/B | T-16/17/36/37; exploratorio QA-02 | PASS |
| C-12 | P: paginación completa; N: cursor/metadata repetidos; B: tope con/sin next | P/N/B | T-17/18 | PASS |
| C-13 | P: retry temporal; N: rate/auth sin retry; B: reserva/presupuesto | P/N/B | T-19/20/33/34 | PASS con límite real vacío |
| C-14 | P: fallo persistido; N: viejo no pisa; B: completed limpia/partial conserva | P/N/B | T-21/22/38 | PASS |
| C-15 | P: run activo; N: desconexión corta; B: purga/reauth en vuelo | P/N/B | T-03/05/23 | PASS |
| C-16 | P: purga/cascada; N: conexión viva no se purga; B: repetición false | P/N/B | T-11/23/24 | PASS |
| C-17 | P: rol/catálogo; N: grant/nombre/DETAIL; B: rol limpio normalizado | P/N/B | T-25/26; pgTAP 09 | PASS |
| C-18 | P: botón y vista activos; N: pendiente/desconectada; B: primer fallo/query engañosa | P/N/B | T-27/28/35; manual | PASS |
| C-19 | P: logs/DTO cerrados; N: datos sensibles ausentes; B: escape/next | P/N/B | T-18/27/29 | PASS con límite H-08 |
| C-20 | P: tipos/variantes; N: duplicados; B: atribución unknown/null | P/N/B | T-12/14/30/31/36 | PASS con límite real vacío |
| C-21 | P: listado paginado; N: cursor inválido; B: tope con/sin next | P/N/B | T-32 | PASS |
| C-22 | P: tres controles y ensayo; N: skip requerido no acredita; B: 0 filas permitido | P/N/B | T-33/34; sesión; CB-06 | PASS |

| Criterio | Caso | Tipo (positivo/negativo/borde) | Cubierto por | Resultado |
|---|---|---|---|---|
| CA-39 | Error clasificado; clase ajena no cambia estado; generación vieja | P/N/B | C-14/15, T-21/22 | PASS |
| CA-41 | Snapshot/metadata; sin crudo; historia | P/N/B | C-06/08/19, T-10/11/31 | PASS |
| CA-42 | Cuatro niveles; fallo intermedio; vacío válido | P/N/B | C-06/12, T-07/08/38 | PASS |
| CA-43 | Cobertura; ausencia no cero; sustitución | P/N/B | C-05/07, T-09/10/31 | PASS |
| CA-43b | Flag; instante inválido; DST | P/N/B | C-10, T-15/37 | PASS |
| CA-44 | Unidad/atribución; estado histórico; unknown | P/N/B | C-08/20, T-12/30/31 | PASS |
| CA-44b | Texto decimal; JSON numérico rechazado; bigint/128 | P/N/B | C-09, T-13/14 | PASS |
| CA-45 | Sustituye; parcial conserva; retry idéntico | P/N/B | C-05/06, T-06/07/38 | PASS |
| CA-46 | Lectura propia; ajena; never/expired | P/N/B | C-01/18, T-02/27/35 | PASS |
| CA-47 | Agotamiento; cursor repetido; tope | P/N/B | C-12, T-17/18 | PASS |
| CA-47b | 28 días; no futuro inventado; bisiesto/DST | P/N/B | C-10/11, T-16/37; QA-02 | PASS |
| CA-56 | Presupuesto; tope incompleto; reserva | P/N/B | C-13, T-19/20/34 | PASS con límite real vacío |
| CA-57 | Temporal retry; rate/auth no; espera fuera de presupuesto | P/N/B | C-13, T-19 | PASS |
| CA-58 | Un run; conflicto; lease vencido | P/N/B | C-03/04, T-03/04/05 | PASS |
| CA-59 | Dueño publica; A vieja no escribe; reauth protegido | P/N/B | C-04/14/15, T-05/22/23 | PASS |
| CA-60 | Listado paginado; cursor adverso; límite | P/N/B | C-21, T-32 | PASS |

## Exploración temporal y recorrido manual

QA-02 probó mediante funciones exportadas la frontera de 32/33 dígitos para entidades, 60/61 para cuenta y la ventana de 28 días al cruzar el 29 de febrero en dos zonas. Archivo temporal `tests/unit/__qa__/M16c-boundaries.test.ts`; `npm run test:unit -- tests/unit/__qa__/` terminó exit 0, **3/3**. Se borraron el archivo y el directorio; `git status --porcelain` volvió a la foto inicial antes de escribir este informe. Ningún caso exploratorio falló y no se propone prueba permanente.

Guion manual sin datos reales: (1) en Integraciones con conexión activa, pulsar **Sincronizar ahora** y capturar solo aviso y estados de los cuatro niveles; esperado «Sincronización completa.» con los cuatro completos; (2) elegir Anuncios → Todas y capturar solo la fecha final y etiquetas de presencia; esperado último día de la ventana sin error; (3) comprobar el aviso de operación manual y que una captura sin filas dice «Sin fila reportada», sin inventar ceros. El usuario confirmó durante QA 1 que vio aviso, cuatro niveles y fecha final sobre la versión corregida. Consta por declaración, sin captura adjunta. No se repitió una sincronización real desde el asistente.

## Comandos y resultados

Los comandos de cierre se ejecutaron en este turno después de la corrección documental y antes de añadir informes, que están excluidos del hash:

| Comando | Resultado |
|---|---|
| `npm run verify` | Exit 0; 28 archivos, 726 pruebas, lint/typecheck y build de 13 páginas. Coincide con CI `.github/workflows/verify.yml`. |
| `npm run db:check:test` | Exit 0; desechable y rol C confirmados. |
| `npm run test:policies` | Exit 0; 14 archivos, 15 ejecuciones, 727 aserciones, 0 problemas. |
| `npm run test:app -- --reporter=verbose` | Exit 0; 11 archivos, 75 aprobadas y 7 omitidas, 443,49 s. |
| `npm run test:unit -- tests/unit/__qa__/` | Exit 0; 3 exploratorias aprobadas y borradas. |
| `git diff --check` | Exit 0. |

Omisiones CB-06: tres casos opt-in de `email-flows.test.ts` que consumirían correo y cuatro centinelas de «falta proyecto remoto» en concurrency, onboarding, integrations-data-api e isolation. Las pruebas positivas de estos cuatro archivos sí corrieron. Ninguna prueba requerida de M16c se omitió. App y pgTAP solo usaron el desechable verificado; no se ejecutó `db:push`.

## Evidencia de cierre y gate

| Parte | Estado | Evidencia y límite |
|---|---|---|
| Pruebas en verde | Cumplida | verify, policies y app reejecutados con resultados anteriores. |
| Tres controles de etapa y revisión de implementación | Cumplida | Sesión cronológica; `implementation-review-3.md` APROBABLE sobre hash idéntico. |
| Comunicación previa y orden migración → despliegue | Cumplida por evidencia de sesión/declaración | Se comunicó al dueño antes de captura; 0016 precedió a despliegue; QA no operó producción. |
| Sincronización real de cuatro niveles | Cumplida | Segunda corrida sobre `718970a`: cuatro completos, cero filas, resultado general completa, suma de nivel 3683 ms. |
| Q-04 y límite | Cumplida con limitación | 28 días y presupuesto 240 s frente a 300 s acreditados; cuenta vacía no mide holgura con actividad. |
| UI | Cumplida por declaración | Aviso, cuatro niveles y fecha final confirmados por el usuario. |
| Consistencia de PROJECT_STATE y sesión | Cumplida | Q-01 corregido; `H-E1-201` registrado y resuelto. La sesión conserva su cronología. |
| `G-SYNC` | Aprobación del usuario recibida; registro posterior | El usuario indicó explícitamente «Aprobar G-SYNC y cerrar M16c». El estado se actualizará tras este QA. |

Con cero filas no se validaron campos/tipos reales ni ceros; `H-E1-189` pasa a riesgo aceptado temporal al cerrar el gate, y `H-E1-194` queda para la primera captura con filas. La consulta `ids` y la holgura con actividad tampoco quedaron verificadas en cuenta real. Son límites declarados por D-M16c-02 y la sesión, sin inferir resultados.

## Hallazgos y preservación

| ID (Q-NN) | Severidad | Criterio | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| — | — | — | Ningún hallazgo nuevo; Q-01 resuelto | Diff documental, `H-E1-201`, suites y recorrido | — |

La escritura de QA 2 se limita a este informe y `pr.md`. El test temporal se eliminó. No se corrigió código, ni se hizo commit, push, despliegue o migración. El siguiente paso operativo es registrar el gate ya aprobado y marcar M25a.1 como habilitada **sin iniciarla**. La implementación ya está integrada en main, así que no hace falta abrir un PR duplicado para el código.
