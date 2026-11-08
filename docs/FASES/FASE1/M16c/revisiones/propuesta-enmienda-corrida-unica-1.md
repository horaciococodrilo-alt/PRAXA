# Propuesta de enmienda de la ruta: M16c en una sola corrida

**Estado:** APROBADA por el usuario e integrada el 2026-11-07 ([sesión](../../meta_first/sesiones/enmienda-corrida-unica-2026-11-07.md)). Las líneas citadas son las anteriores a la integración.  
**Fecha:** 2026-11-07.  
**Origen:** elección del usuario en el chat: «una spec, un plan, una corrida» (futura D-M16c-05).

## Qué cambia

Hoy la ruta exige que M16c.1, M16c.2 y M16c.3 tengan cada uno su spec y su plan aprobados, su corrida de `/microfase` de hasta 8 horas y su gate (`G-SYNC-DB`, `G-SYNC-EXTRACT` y `G-SYNC`).

Con la enmienda:

- **Una spec:** `M16c/spec.md`, ya aprobada, vale para las tres partes. No se escriben specs por corte.
- **Un plan:** `M16c/plan.md`, con las tres partes como **etapas** en orden: .1 base de datos, .2 extractor, .3 acción, UI y validación real.
- **Una corrida:** una sola ejecución de `/microfase M16c` en la rama `mf/M16c`.
- **Un solo gate:** `G-SYNC`, al final. `G-SYNC-DB` y `G-SYNC-EXTRACT` dejan de ser gates y pasan a ser **controles de etapa**.
- **Excepción puntual al límite de 8 horas de `AGENTS.md`** solo para M16c, con el mismo mecanismo que se usó en M16.2 (`plan.md:283`). `AGENTS.md` no se modifica.

## Reglas que conserva la corrida única

1. **Control al final de cada etapa.** Antes de pasar a la siguiente: `npm run verify`, `db:check:test`, `test:policies` y `test:app` completos y en verde contra el desechable; evidencia en `meta_first/sesiones/M16c.md`, y commit de la etapa en `mf/M16c` hecho por el usuario. Si un control falla, la corrida se detiene y el fallo se diagnostica antes de seguir. No se pasa a la etapa siguiente con pruebas en rojo.
2. **Pausas obligatorias por intervención del usuario.** La corrida se detiene y espera en estos puntos:
   - etapa .1, cuando 0016 esté lista: aplicar 0016 al desechable (`db:push:test`);
   - fin de cada etapa: commit en la rama;
   - etapa .3, antes de la captura real: comunicar el acta ampliada al dueño;
   - etapa .3: `db:push` de 0016 en `app`, después integrar en `main` y hacer push (D-M16c-03), y coordinar la sincronización real.
3. **Reanudable.** La corrida puede continuar en otra sesión, después de `/clear` o de un resumen de contexto, a partir del último control registrado en la sesión y del último commit de la rama. El plan tiene que indicar el punto de reanudación de cada etapa.
4. **Orden de publicación sin cambios (D-M16c-03).** Ningún código de las etapas .1 y .2 llega a `main` antes de que 0016 esté en `app`. Con una rama única, eso se cumple de forma natural.
5. **Revisiones.** `/implementation-review` y `/qa-review` revisan M16c completa al final, sobre el último commit de la rama. Si se prefiere detectar problemas antes, el usuario puede pedir una `/implementation-review` parcial al final de una etapa; no es obligatoria.

## Lo que se pierde y se acepta

- **Aprobaciones intermedias.** Los controles de etapa no esperan la aprobación del usuario. El usuario aprueba una sola vez, en `G-SYNC`. Un defecto de diseño de la base que se detecte en la etapa .3 obliga a retroceder dentro de la misma corrida.
- **Revisión grande.** La revisión final cubre una migración, el extractor y la UI juntos: es más larga y más difícil de revisar que tres revisiones chicas.
- **Contexto.** Una corrida de este tamaño casi seguro supera una sesión. La regla de reanudación existe por eso.

## Cambios propuestos

| # | Archivo y ubicación | Cambio |
|---|---|---|
| 1 | `meta_first/plan.md:298`, ficha M16c, ID | «`M16c` — conjunto dividido en `M16c.1`, `M16c.2` y `M16c.3`, cada corte ≤8 h» → «`M16c` — microfase única en tres etapas (`M16c.1`, `M16c.2` y `M16c.3`), con una spec, un plan y una corrida; excepción puntual al límite de 8 horas de `AGENTS.md` aprobada por el usuario el 2026-11-07 (D-M16c-05)» |
| 2 | `meta_first/plan.md:309-313`, «Cortes obligatorios de M16c» | Título: «Etapas obligatorias de M16c (DEC-22)». El párrafo de specs y planes por corte se reemplaza por las reglas 1 a 5 de esta propuesta, en forma resumida. «Antes de implementar, se preparan las specs de cada corte en sus directorios. `M16c/spec.md` pasa a ser ficha de conjunto» → «`M16c/spec.md` es la spec única de las tres etapas y `M16c/plan.md` su plan único; no se preparan specs ni planes por etapa» |
| 3 | `meta_first/plan.md:315-317`, tabla de cortes | Columna de evidencia: «Sesión propia; … `G-SYNC-DB`» y «… `G-SYNC-EXTRACT`» → «Control de etapa en `sesiones/M16c.md`; …». La fila .3 conserva `G-SYNC`. Columna de dependencias: .1, «G-VR01 y spec/plan propios aprobados / M16c.2» → «G-VR01; spec y plan de M16c aprobados / etapa .2»; .2, «G-SYNC-DB / M16c.3» → «control de la etapa .1 / etapa .3»; .3, «G-SYNC-EXTRACT / M25a.1» → «control de la etapa .2 / M25a.1» |
| 4 | `meta_first/plan.md:694`, II.11, fila M16c.3 | «Specs de los cortes y `meta_first/sesiones/M16c.3.md`» → «`M16c/spec.md` y `meta_first/sesiones/M16c.md`» |
| 5 | `meta_first/plan.md:696`, II.11, Cierre | «cada corte corre verify, policies y app» → «cada etapa termina con verify, policies y app en verde (control de etapa)» |
| 6 | `meta_first/plan.md:827`, III.2, y `:850-851`, III.3 | Las filas `M16c.1`, `M16c.2` y `M16c.3` pasan a nombrar las etapas de `M16c`, sin cambiar sus acciones ni sus suites |
| 7 | `meta_first/plan.md`, encabezado | Línea de la enmienda, como las anteriores. Se agrega también la de la enmienda G-SYNC del 2026-11-07, que la auditoría 6 notó que faltaba |
| 8 | `docs/PROJECT_STATE.md:28`, `:32` y `:38` | Siguiente habilitada: «M16c — preparar y aprobar su plan». Secuencia: «M16c (etapas .1 → .2 → .3, una corrida) → M25a.1 → M25a.2 → M28.3a». En `:28-30`, «la medición de Q-04» → «fijar Q-04» (observación de la auditoría 6) |
| 9 | `M16c/spec.md` | Línea 5 (specs y planes por corte), Entrada (gates intermedios), «Archivos previstos» (specs y planes por corte → `M16c/plan.md`; sesiones por corte → `sesiones/M16c.md`), C-22, T-33, intervenciones «Antes de cada corte» y «Cada gate», punto 1 de D-M16c-03 (rama única `mf/M16c` con un commit por etapa), «Verificación» y la trampa de subdividir planes. Se registra D-M16c-05. Como cambia el contenido, la spec vuelve a BORRADOR, se audita de nuevo y la aprobás otra vez |

## Lo que no cambia

- El contenido técnico de la spec: datos, tablas, funciones, reglas, criterios y casos de prueba.
- `G-SYNC` y su condición, D-M16c-02 y D-M16c-03.
- `AGENTS.md`: el límite general de 8 horas sigue vigente para todas las demás microfases.
- `SECURITY.md`, `ARCHITECTURE.md` y el acta.
- Las acciones reservadas al usuario y sus verificaciones.

## Para integrar, una vez aprobada

1. Aplicar los cambios 1 a 8 en la ruta y en PROJECT_STATE.
2. Aplicar el cambio 9 en la spec de M16c, volver a ponerla en BORRADOR y registrar D-M16c-05.
3. Registrar la integración en `meta_first/sesiones/`.
4. Correr `/spec-auditor M16c`, aprobar la spec y seguir con el plan único.
