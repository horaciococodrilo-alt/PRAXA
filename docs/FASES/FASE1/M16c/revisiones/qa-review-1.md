# M16c — QA final 1

Fecha: 2026-11-08, America/Argentina/Buenos_Aires.

## Estado y veredicto

- Rama `mf/M16c`; HEAD `cd752622f7a906d3c464720a45a2fc2d4f2dd4ea`; main local `718970a4a0623fa3c45c6c79aa44452bc6c1abc7`.
- Base integral autorizada por el usuario: `a27f7270310034cc3e64346684b1f5c5e5a20ae3`. La implementación ya está integrada en main; el merge-base no es una base útil para visualizarla.
- Hash literal de estado de la skill, comparado con main y excluyendo revisiones: `556426d9104555caaaea8909689e81fe1587f6da`. Hash adicional con la base autorizada: `e8ac557e825e90f37a32131f21599b4be8c25e0a`. Ambos coinciden con `implementation-review-2.md`; el código no cambió desde esa revisión.
- Foto inicial de `git status --porcelain`: únicamente `?? docs/FASES/FASE1/M16c/revisiones/implementation-review-2.md`. Se preservó ese archivo del trabajo anterior.
- Última revisión de implementación: **APROBABLE**. Entrada `G-VR01` aprobada; `G-SYNC` pendiente.

**Veredicto: REQUIERE CAMBIOS.** El comportamiento especificado, las suites y el recorrido manual comprobado pasan. `PROJECT_STATE.md`, que se presenta como estado actual, aún afirma que las etapas .1–.3 están pendientes de implementación y que Q-04 se fijará en M16c. Eso contradice el estado verificado de la misma sección, la spec y la sesión. Es el hallazgo Q-01, corregible dentro de M16c. La skill de QA permite escribir únicamente este informe y `pr.md` si el veredicto fuera LISTO PARA PR; por eso no edité `PROJECT_STATE.md` ni generé `pr.md`.

La aprobación visible de `G-SYNC` sigue reservada al usuario. M25a.1 no queda habilitada por este QA.

## Matriz de comportamiento

En cada fila, P es un caso positivo, N negativo y B de borde. La columna «Tipo» registra los tres tipos; cada caso tiene al menos una prueba existente o el ensayo exploratorio indicado. PASS significa que el comportamiento se observó en la suite completa, en el ensayo o en la evidencia manual citada; no equivale a aprobar el gate. Los IDs T remiten a `M16c/spec.md`.

| Criterio | Caso | Tipo (positivo/negativo/borde) | Cubierto por | Resultado |
|---|---|---|---|---|
| C-01 | P: JWT propio lee; N: ajena/anon no accede; B: ref opaca adulterada no revela calendario | P/N/B | T-01/02/35 | PASS |
| C-02 | P: cobertura propia y resumen legibles; N: tablas ocultas sin SELECT; B: cascada borra siete tablas | P/N/B | T-01/24/31 | PASS |
| C-03 | P: inicia un run; N: segundo concurrente choca; B: A vencida cede a B sin renovar lease | P/N/B | T-03/04 | PASS |
| C-04 | P: propietario vigente publica; N: desplazado no publica/falla/reauth; B: escritura bloqueada hasta vencimiento se rechaza | P/N/B | T-04/05 | PASS |
| C-05 | P: publicación atómica; N: payload distinto o fila inválida rechaza; B: reintento idéntico no duplica | P/N/B | T-06/20/38 | PASS |
| C-06 | P: cuatro niveles completos dan éxito; N: uno fallido deja parcial; B: cero páginas válidas, página vacía válida y no intentado se distinguen | P/N/B | T-07/08/38 | PASS |
| C-07 | P: cero explícito sigue siendo cero; N: ausencia no se vuelve cero; B: null, sin fila y no observado distintos aun en captura vacía | P/N/B | T-08/09/10/31 | PASS |
| C-08 | P: metadata histórica conservada; N: UPDATE histórico rechazado; B: cambio de nombre/estado no se atribuye al día anterior | P/N/B | T-10/11/12 | PASS |
| C-09 | P: decimales y enteros exactos atraviesan SQL/API/TS; N: JSON numérico o formato inválido rechazado; B: bigint máximo y cadenas de 128/129 caracteres | P/N/B | T-13/14 | PASS |
| C-10 | P: captura parcial persiste al releer; N: instante futuro/anterior rechazado; B: medianoche, DST y reloj local atrasado | P/N/B | T-15/16/37 | PASS |
| C-11 | P: cuatro niveles y 28 fechas locales; N: sin breakdown/date_preset ni ID de nivel equivocado; B: 29 de febrero y cambio de día por zona | P/N/B | T-16/17/36/37; exploratorio QA-01 | PASS |
| C-12 | P: páginas/metadata agotadas; N: cursor repetido, metadata faltante o duplicada dejan incompleto; B: tope con/sin siguiente | P/N/B | T-17/18 y regresiones de metadata | PASS |
| C-13 | P: temporal/transporte reintenta acotado; N: rate/auth no reintenta; B: presupuesto, timeout de cuerpo y reserva SQL | P/N/B | T-19/20/33/34 | PASS con límite real vacío |
| C-14 | P: error no reauth persiste; N: run viejo/ajeno no pisa; B: partial conserva y completed limpia error | P/N/B | T-21/22/38 | PASS |
| C-15 | P: run activo termina; N: desconexión/reauth impide escritura tardía; B: purga y reemplazo real durante llamada | P/N/B | T-03/05/23 | PASS |
| C-16 | P: purga/cascada quita siete tablas; N: conexión viva no se purga; B: segunda purga devuelve false | P/N/B | T-11/23/24; pgTAP 10 | PASS |
| C-17 | P: catálogo y rol reales operan; N: grant/nombre arbitrario o error con DETAIL rechazado; B: normalizar rol limpio conserva contraseña/grants | P/N/B | T-25/26; pgTAP 09 | PASS |
| C-18 | P: activa ve botón, cuatro niveles y cobertura; N: pendiente/desconectada no sincroniza ni expone datos; B: primer fallo/parcial y query de éxito no falsean resumen | P/N/B | T-27/28/35; recorrido manual | PASS |
| C-19 | P: logs y DTO cerrados; N: sin token, IDs externos, importes ni nombres libres; B: metadata escapada y `paging.next` descartado | P/N/B | T-18/27/29 | PASS; límite externo H-08 |
| C-20 | P: tipo, variante y atribución conservados; N: duplicados/tipos inválidos rechazados; B: atribución no acreditada queda unknown, null distinto de cero | P/N/B | T-12/14/30/31/36 | PASS con límite real sin filas |
| C-21 | P: listado de cuentas paginado; N: página/cursor inválidos rechazados; B: límite de páginas sin siguiente/con siguiente | P/N/B | T-32 | PASS |
| C-22 | P: controles de tres etapas y captura real; N: prueba requerida omitida no acredita gate; B: cuatro niveles completos con cero filas son válidos por D-M16c-02 | P/N/B | T-33/34; sesión; CB-06 | PASS de comportamiento; G-SYNC pendiente |

Los CA heredados se verifican mediante los casos P/N/B de los C indicados, con esta correspondencia:

| Criterio | Caso | Tipo (positivo/negativo/borde) | Cubierto por | Resultado |
|---|---|---|---|---|
| CA-39 | Error Graph clasificado; clase no reauth persistida; generación vieja no pisa | P/N/B | C-14/15, T-21/22 | PASS |
| CA-41 | Snapshot tipado; crudo/secretos ausentes; metadata histórica | P/N/B | C-06/08/19, T-10/11/31 | PASS |
| CA-42 | Cuatro niveles completos; fallo intermedio; página vacía válida | P/N/B | C-06/12, T-07/08/38 | PASS |
| CA-43 | Cobertura propia; ausencia distinta de cero; reemplazo completo | P/N/B | C-05/07, T-09/10/31 | PASS |
| CA-43b | Flag parcial; captura inválida; DST/medianoche | P/N/B | C-10, T-15/37 | PASS |
| CA-44 | Unidad/moneda/atribución; estado no atribuido al pasado; unknown | P/N/B | C-08/20, T-12/30/31 | PASS |
| CA-44b | Texto decimal exacto; número JSON rechazado; bigint/128 caracteres | P/N/B | C-09, T-13/14 | PASS |
| CA-45 | Snapshot completo sustituye; parcial conserva; reintento idéntico | P/N/B | C-05/06, T-06/07/38 | PASS |
| CA-46 | Lectura opaca propia; ajena rechazada; never/expired/primer fallo | P/N/B | C-01/18, T-02/27/35 | PASS |
| CA-47 | Agotamiento acredita completo; cursor repetido no; tope de páginas | P/N/B | C-12, T-17/18 | PASS |
| CA-47b | Relectura 28 días; sin fecha futura inventada; DST/bisiesto | P/N/B | C-10/11, T-16/37; QA-01 | PASS |
| CA-56 | Presupuesto configurado; tope deja incompleto; margen/reserva | P/N/B | C-13, T-19/20/34 | PASS con límite real vacío |
| CA-57 | Retry temporal; auth/rate sin retry; espera fuera de presupuesto no inicia | P/N/B | C-13, T-19 | PASS |
| CA-58 | Un run vigente; segundo choca; lease vencido y posesión B | P/N/B | C-03/04, T-03/04/05 | PASS |
| CA-59 | Publicación con posesión; A vieja no escribe; reauth/fallo transaccional | P/N/B | C-04/14/15, T-05/22/23 | PASS |
| CA-60 | Listado paginado; cursor/límite adversos; límite sin siguiente | P/N/B | C-21, T-32 | PASS |

## Ensayos exploratorios y UI

El caso sin cobertura específica QA-01 ejercitó interfaces exportadas: `isEntityId` con 32/33 dígitos y cuenta prefijada, `normalizeAccountId` con 60/61 dígitos, y `localSyncWindow` en el 29 de febrero y dos zonas. Se creó temporalmente `tests/unit/__qa__/M16c-behavior.test.ts`. Primera invocación `npm run test:unit -- tests/unit/__qa__/`: exit 1 antes de descubrir pruebas, por faltar el mock del marcador `server-only` en el test exploratorio; fue un error de preparación, sin aserción fallida. Se añadió al test el mismo mock que emplea la suite unitaria existente. Segunda invocación: exit 0, **3/3**. Se borraron test y directorio `__qa__`; `git status --porcelain` volvió exactamente a la foto inicial antes de escribir este informe. No se propone prueba permanente porque los tres bordes pasaron.

Guion manual de QA, sin datos reales:

1. Con una conexión activa legítima, abrir Integraciones y pulsar **Sincronizar ahora**. Esperado: pendiente visible mientras corre y, al completar los cuatro niveles, aviso «Sincronización completa.»; capturar solo el texto del aviso y los estados por nivel.
2. Seleccionar **Anuncios → Todas**. Esperado: cobertura hasta el último día de la ventana local, con fecha final visible y sin error de lectura; capturar solo fecha y etiquetas de presencia, nunca nombres, montos ni IDs.
3. Comprobar que la pantalla declara sincronización manual y que cada nivel muestra su resultado; capturar las etiquetas. Si no hay filas, «Sin fila reportada» y no un cero inventado.

El usuario confirmó en este QA que, sobre la versión corregida, vio el aviso, los cuatro niveles completos y la fecha final en Anuncios → Todas. Se registra **por declaración, sin captura adjunta**. La sesión ya contiene dos sincronizaciones reales redactadas; la segunda, sobre `718970a`, terminó con los cuatro niveles completos y cero filas. No se repitió una operación externa desde QA.

## Verificación completa

| Comando | Resultado |
|---|---|
| `npm run verify`, primera y segunda invocación | Exit 1 en build: Turbopack no pudo crear un subproceso para procesar `globals.css`. Lint, typegen, typecheck y 726 pruebas habían pasado. La segunda invocación coincidió con pgTAP; se aisló la comprobación antes de atribuir un defecto al proyecto. |
| `npm run build`, aislado | Exit 0; 13 páginas generadas. |
| `npm run verify`, aislado final | **Exit 0**; lint, typegen, typecheck, 28 archivos/726 pruebas y build de 13 páginas. Es el mismo comando que corre `.github/workflows/verify.yml`. |
| `npm run db:check:test` | Exit 0; destino desechable y rol C verificados. No se muestra la referencia del proyecto. |
| `npm run test:policies` | Exit 0; 14 archivos, 15 ejecuciones, 727 aserciones, 0 problemas. |
| `npm run test:app -- --reporter=verbose` | Exit 0; 11 archivos, 75 aprobadas y 7 omitidas. Duración 441,74 s. |
| `npm run test:unit -- tests/unit/__qa__/` | Primer intento: setup fallido, cero pruebas ejecutadas; tras ajustar el test temporal: exit 0, 3 aprobadas. |
| `git diff --check` | Exit 0. |

Las siete omisiones de app son tres pruebas opt-in de `email-flows.test.ts` que consumen cuota de correo, y cuatro centinelas de ausencia de configuración en `concurrency.test.ts`, `onboarding.test.ts`, `integrations-data-api.test.ts` e `isolation.test.ts`. Las suites positivas de esos cuatro archivos se ejecutaron; no hubo prueba requerida de M16c omitida (CB-06). Las suites de app/pgTAP corrieron solo contra el desechable verificado. No se ejecutó `db:push`.

## Evidencia de cierre y condición del gate

| Parte exigida | Estado | Evidencia o límite |
|---|---|---|
| Unitarias/componentes y build | Cumplida | `verify` final exit 0; 726 pruebas, build completo. |
| pgTAP y app en desechable | Cumplida | 727 aserciones y 75 pruebas app pasan; siete omisiones ajenas identificadas. |
| Tres etapas y controles respectivos | Cumplida | `sesiones/M16c.md` registra controles y commits de .1/.2/.3; QA reejecutó suites completas sobre HEAD. |
| Comunicación previa al dueño | Cumplida por declaración | Sesión, paso 17: el usuario informó comunicación y conformidad antes de la primera captura ampliada. |
| Migración en app, despliegue y orden | Cumplida con evidencia de la sesión | La salida aportada por el usuario ubica 0016 antes del merge/despliegue; la corrección posterior no cambió SQL. QA no operó producción. |
| Sincronización real redactada de cuatro niveles | Cumplida | Segunda corrida sobre versión corregida: account/campaign/adset/ad completos, cero filas, resultado general completa; suma de duraciones de nivel 3683 ms. |
| Q-04 y límite de hosting | Cumplida con límite | Spec fija 28 días y presupuesto 240 s bajo 300 s acreditados por el usuario; corrida vacía no mide holgura con actividad. |
| Recorrido de UI | Cumplida por declaración | Confirmación en este QA del aviso, cuatro niveles y fecha final en Anuncios → Todas. |
| Campos/tipos reales con filas | No verificable ahora; riesgo previsto | Cuenta sin actividad; D-M16c-02 permite cuatro niveles con cero filas. H-E1-189/H-E1-194 siguen abiertos y se verifican en la primera captura con filas. No se infieren ceros. |
| Consistencia de `PROJECT_STATE.md` y sesión | **No cumplida** | La sesión es cronológica y su último estado es VERIFICADO — PENDIENTE DE APROBACIÓN. `PROJECT_STATE.md` contiene afirmaciones actuales obsoletas (Q-01). |
| Condición para avanzar `G-SYNC` | Pendiente del usuario | Tras corregir Q-01 y revalidar, el usuario decide visiblemente el gate. Este QA no lo aprueba ni habilita M25a.1. |

## Hallazgos

| ID | Severidad | Criterio | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| Q-01 | Baja, documental; asignada a M16c | Consistencia del estado y C-22 | `PROJECT_STATE.md` afirma que las etapas .1–.3 siguen pendientes de implementación y que Q-04 se fijará en M16c, aunque el mismo apartado las llama VERIFICADO, la spec ya fija Q-04 y la sesión registra implementación, controles y sincronización. | `docs/PROJECT_STATE.md:28-33`; `M16c/spec.md` «Q-04 fijado»; `sesiones/M16c.md` últimos controles y estado. | Actualizar solo las frases obsoletas del estado, preservando `G-SYNC` pendiente y la secuencia futura. Como el cambio altera el hash de revisión, repetir `/implementation-review M16c` y luego este QA antes de declarar LISTO PARA PR. |

No hay hallazgos funcionales nuevos. La falta de filas reales, la consulta `ids` no ejercitada contra Meta y la holgura no medida con actividad permanecen como límites previstos en la spec/sesión, no como defectos acreditados por esta revisión.

## Preservación y pendientes

La única escritura persistente autorizada por este QA es `qa-review-1.md`. El test exploratorio se eliminó. `implementation-review-2.md` ya era no rastreado al entrar y se preservó. No se creó `pr.md` por el veredicto. Sin código corregido, commit, push, despliegue ni operaciones de migración.

Pendiente: corregir Q-01 en una intervención de M16c, revalidar el hash con una nueva revisión de implementación y repetir QA; después, con evidencia suficiente, el usuario decide `G-SYNC`.
