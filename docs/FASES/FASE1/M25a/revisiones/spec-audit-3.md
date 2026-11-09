# Auditoría de la spec de M25a — ronda 3

- **Fecha:** 2026-11-08 (America/Buenos_Aires).
- **Commit:** `336a5f0` (`docs/m25a-spec`; árbol limpio antes de escribir este informe).
- **Hash de contenido de `M25a/spec.md`, excluida la línea `**Estado:**`:** `4be22633ba44fca501614fc27352845bd6b291b1`. Calculado sobre los bytes UTF-8, preservando los LF del archivo, y pasado a `git hash-object --stdin` desde Node; el pipe de PowerShell agregaba un salto y daba otro hash.
- **Estado:** `BORRADOR`. Próximo informe: `spec-audit-3.md`, porque ya existen `spec-audit-1.md` y `spec-audit-2.md`.

## Veredicto

**REQUIERE CAMBIOS.** 13 PASS y 5 FAIL. Quedan **7 hallazgos**: 3 de severidad alta, 3 media y 1 baja. De los hallazgos de la ronda 2, `A-08` sigue abierto en su parte contractual; los demás tienen corrección concreta en la versión actual. El fallo de `npm run verify` es operativo y no se atribuye al diseño de M25a: el mismo árbol compiló con webpack.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---|---|---|---|
| 1 | Trazabilidad | PASS | `spec.md:532-565` resume CA-48 a CA-55, CA-61 a CA-66, CA-69 a CA-73, VR-02 y los CA transversales de la ficha (`meta_first/plan.md:342`). |
| 2 | Alcance | PASS | `spec.md:29-65`, `:498-528`; coincide con `plan.md` II.12, II.13 y II.13b y su enmienda de línea 20. `M25a-H-07` ya no permite recortar alcance (`spec.md:817`). |
| 3 | Coherencia con la spec general | FAIL | La respuesta/abstención sin cuenta no puede cumplir literalmente CA-51 y CA-52 (`meta_first/spec.md:468-470`): `A-29`. `M28.3a` consume `G-CHAT` según `plan.md:358-371`; no aparece otra incompatibilidad con la sucesora. |
| 4 | Decisiones | PASS | `spec.md:788-805` atribuye D-M25a-01 a -14 al usuario. La enmienda de `plan.md:20` y `meta_first/sesiones/enmienda-spec-m25a-2026-11-08.md` coordinan D-01, -02, -03, -04, -10, -12 y -14 con la ruta. |
| 5 | Trampas | PASS | `spec.md:767-786` refleja las de `plan.md` II.12 y II.13; la guarda y VR-02 conservan la distinción entre cifra respaldada y fidelidad semántica. |
| 6 | Intervenciones y acciones reservadas | PASS | `spec.md:751-765`, `plan.md:346`, `:838-858`. El usuario tiene `db:push:test`, `db:push` en `app`, commits, push, despliegue, clave y acta, con comprobaciones posteriores. |
| 7 | Verificación | PASS | `spec.md:739-749`, `plan.md:350-354`, `:860-882`, `meta_first/spec.md:566-589`. Exige las suites de cada etapa, VR-02 y CB-06. |
| 8 | Dependencias | PASS | `PROJECT_STATE.md`, «Cerradas» y «Siguiente habilitada»: `G-SYNC` aprobado, M25a habilitada. La base contiene `0016`, `0017`, contratos, K01 y código de M16c. |
| 9 | Lo entregado de verdad | PASS | `spec.md:67-112`, `:260`, `:284`, `:292`, `:528` ya acomodan las diferencias comprobadas en `0016`, `0017`, `insights.ts:840-903` y la prueba de sesión de páginas. |
| 10 | Pendientes y hallazgos | PASS | `spec.md:807-841` asigna `H-E1-189`, -194, -190, -187, -202 y -185; los dos primeros quedan explícitamente para la primera sincronización con filas. `PROJECT_STATE.md` no marca un bloqueo de entrada. |
| 11 | Contexto real | PASS | Se revalidaron las referencias de `spec.md:67-112` con `connections.ts`, `insights.ts`, `worker-api.ts`, `0016`, `0017`, componentes, pruebas y docs transversales. Las citas invertidas y corridas de la ronda 2 están corregidas. |
| 12 | Archivos previstos | PASS | `spec.md:498-528`, `plan.md:20` y `:710-770`. Incluye `app-paginas-sesion.test.tsx`, que faltaba en la ronda 2. |
| 13 | Diseño suficiente | FAIL | El esquema plano del modelo no llega a los Zod estrictos por herramienta (`A-26`); quedan contratos de `extra`, claims, bloques y DTO por definir (`A-08`); el caso sin cuenta carece de presentación posible bajo CA-52 (`A-29`). |
| 14 | Verificable | FAIL | `T-64` no acredita todo CB-02 (`A-30`); faltan casos y resultados para sanear cifras en preguntas anteriores (`A-27`) y para los datos ausentes distintos del período (`A-28`). Los criterios C-01 a C-75 tienen al menos una fila T-NN. |
| 15 | Sin nada abierto | PASS | `spec.md:825-827`: preguntas abiertas vacías. `H-01` a `H-11` tienen paso de verificación (`:807-821`); `H-07` frena si no converge. Los hallazgos de este informe son defectos detectados, no preguntas declaradas como pendientes por la spec. |
| 16 | Ejecutable ahora | FAIL | `npm run verify` terminó con exit 1 dos veces: lint, typegen, typecheck y 28 archivos/765 pruebas pasaron; `next build` (Turbopack) falló al crear un proceso en `globals.css`. `npm run build -- --webpack` pasó (13 páginas). Ver `A-31`. Scripts actuales están en `package.json`; `test:eval` y `DEEPINFRA_API_KEY` se crean en M25a. No se leyó `.env.local`. |
| 17 | Consistencia interna | FAIL | `redactQuestion` preserva montos y fechas, pero D-07/C-64 dicen que las preguntas anteriores viajan sin cifras (`A-27`); §10 promete valor por defecto para «otro dato» y §4 solo define el período (`A-28`); §Auditorías aún dice «Sin auditorías todavía» (`spec.md:843-845`, corrección editorial junto a los cambios). |
| 18 | Reglas no negociables | PASS | `spec.md:145-170`, `:288-292`, `:300-319`, `:374-385`, `:739-765`: K01 interno, sin datos reales o secretos en fixtures, migración nueva `0018`, suites contra desechable, `worker_api` para escrituras y errores redactados. |

## Contradicciones

| Elemento de la spec | Contradice a (fuente y ubicación) | Evidencia | Cómo se resuelve |
|---|---|---|---|
| `C-40`: toda respuesta lleva cuenta truncada y período (`spec.md:610`) | CA-52 de la ruta (`meta_first/spec.md:470`) y estado `pending_selection` definido en CA-08 (`:229`) | `spec.md:340`, `:441-450`, `:462` producen abstención registrada sin conexión activa; `readConnectionRecord` puede devolver `pending_selection` con `external_account_id`, zona y moneda nulos (`connections.ts:67-86`). Sin conexión devuelve `null`. No hay cuenta que truncar ni zona para el período por defecto. | Definir y autorizar la presentación para sin conexión y pendiente, incluida la excepción precisa a CA-51/52 si se mantienen sus requisitos literales. Requiere decisión del usuario y coordinación con la ruta. |
| «Preguntas anteriores ... sin cifras» (`spec.md:430`, C-64, D-07) | La propia regla de redacción de la spec (`:302-307`, `:553`, `:782`) | `redactQuestion` conserva montos y fechas. Reaplicarla a una pregunta anterior no los elimina; el modelo sí recibiría esas cifras. | Definir el saneamiento específico del historial (por ejemplo, descartar una pregunta anterior con candidatos numéricos) y probarlo. |
| «Falta el período u otro dato → usa valor por defecto» (`spec.md:421-424`) | Diseño §4 (`spec.md:286`, `:268-283`) | Solo `period` tiene sustitución, y `period_a`/`period_b` se rechazan si faltan. No hay valor declarado para métrica, nivel, entidad u otro dato requerido. | Limitar la fila al período y definir aclaración/rechazo para los otros campos, o declarar y mostrar cada valor por defecto autorizado. |

## Hallazgos

| ID (A-NN) | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-08 | Media | Diseño §3, §8 y §9 | La corrección de la ronda 2 define identidad, fechas y ejemplos, pero aún deja al implementador elegir el esquema de `extra.shares`/`trends`/`last_result`, las dos referencias exactas de `qualitative_comparison`, las `options` cerradas por cada tipo de bloque y la forma serializable completa de `ChatTurnView` y de sus bloques. Un «por ejemplo» no cierra las demás variantes. | `spec.md:201-220`, `:356-368`, `:387-415`; `M25a-C-18`, C-50 y T-55 | Completar esos tipos, cardinalidades y referencias con un ejemplo entero por familia que viaje SQL → resultado → claim/bloque → DTO; conservar el catálogo y alcance ya aprobados. | No |
| A-26 | Alta | Diseño §4 y §7 | El modelo entrega un objeto con **todas** las claves de argumentos en nulo, mientras cada herramienta usa `z.strictObject`. Pasar ese objeto directamente a Zod rechaza las claves ajenas y los `null` de opciones; las trece herramientas fallan como `tool_error`. `resolveToolPeriod` solo sustituye el período, no proyecta ni elimina las demás claves. | `spec.md:266-286`, `:290`, `:341-342`, `:350`; `M25a-C-14`, T-13 y T-35 | Definir el adaptador determinístico entre salida plana y argumento específico: claves admitidas por herramienta, descarte de nulos, campos obligatorios, resolución del período y orden de validación. Probar al menos una llamada válida por herramienta desde el esquema plano. | No |
| A-27 | Media | Historia, redacción y D-07 | El procedimiento de «redactar otra vez» preguntas anteriores no asegura «sin cifras»: CA-66 conserva montos y fechas. Es una contradicción interna y con la decisión registrada. | `spec.md:302-307`, `:430`, `:634`, `:721`, `:798`, `:782`; `meta_first/spec.md:492-505` | Especificar un filtro de cifras distinto de la redacción de secretos y añadir a T-69 una pregunta previa con monto y otra con fecha. No usar esos datos para claims del turno nuevo. | No, si se conserva D-07 |
| A-28 | Media | Casos dudosos y valor por defecto | «Otro dato» carece de valor por defecto y de salida definida, aunque `level`, `metric`, `entity_ref` y otros argumentos son obligatorios. El implementador debe elegir si aclarar, abstenerse o inventar un valor. | `spec.md:268-286`, `:421-426`, `:624`, `:711`, `:722`; CA-72 de la ruta (`meta_first/spec.md:410`) | Enumerar cuáles datos se resuelven con un defecto visible y cuáles requieren `clarify`; probar una pregunta sin métrica/nivel/entidad y una comparación sin períodos. | No, si se usa `clarify` conforme CA-72 |
| A-29 | Alta | Salida, pantalla y C-40 | Sin conexión o en `pending_selection` falta cuenta externa y zona. La spec promete siempre un pie con cuenta truncada, período y zona y una abstención registrada con voto; esa combinación no puede construirse con el registro real. CA-51/52 tampoco declaran excepción. | `spec.md:340`, `:389`, `:441-450`, `:462`, `:610`; `connections.ts:67-86`; `meta_first/spec.md:229`, `:468-470` | Fijar DTO y texto para ambos estados. Si el usuario quiere conservar respuestas sin cuenta, coordinar una excepción explícita a CA-51/52 en la ruta, como se hizo con CA-62/69. Añadir pruebas para `null` y `pending_selection`. | **Sí**, por la excepción a la ruta |
| A-30 | Baja | T-64 / CB-02 | La prueba `no-secrets-in-tree` busca patrones de secretos, pero no puede demostrar que el diff carece de montos reales o IDs de cuentas completos. T-64 asigna CB-02 a `verify` y las suites sin revisión del diff. | `spec.md:565`, `:716`; `meta_first/spec.md:582-586`; `tests/unit/no-secrets-in-tree.test.ts:9-31` | Añadir una revisión manual redactada del diff para CB-02, con resultado en `sesiones/M25a.md`; conservar la prueba automática como control parcial. | No |
| A-31 | Alta | Entrada / verificación | El comando obligatorio `npm run verify` no completa en este entorno; el build de Turbopack falla al crear un proceso. Es un bloqueo operativo de la auditoría, no evidencia de un error de la spec o del CSS. | Dos corridas de `npm run verify`: exit 1 tras 28 archivos y 765 pruebas; `npm run build -- --webpack`: exit 0 y 13 páginas. Mismo `HEAD`, sin cambios de código. | Diagnosticar/restaurar Turbopack y repetir el comando literal `npm run verify` antes de aprobar. No sustituirlo por webpack en la evidencia del gate. | No |

## Verificaciones y límites

- `git status --short` estaba vacío al comenzar; `git diff --check` salió 0. Solo se escribió este informe. No se tocó la spec, la ruta, código, migraciones ni gates.
- Se contrastaron `AGENTS.md`, la spec de M25a completa, Parte I y secciones II.12, II.13, II.13b, III.2, III.3 y III.9 de la ruta, la spec general completa, `PROJECT_STATE.md`, `HALLAZGOS.md`, sesiones de las dependencias y la enmienda de M25a, `SECURITY.md`, `ARCHITECTURE.md`, las migraciones y las interfaces citadas. `spec-audit-1.md` y `spec-audit-2.md` sirvieron para comprobar correcciones, sin heredar su veredicto.
- `npm run verify` se ejecutó primero en el sandbox y luego fuera de él. Ambos fallaron en `next build` con el mismo panic de Turbopack: `globals.css`, «creating new process / node process exited before we could connect». En ambas corridas pasaron lint, typegen, typecheck, 28 archivos y 765 pruebas. No se inspeccionó ni mostró el contenido de `.env.local`; Next solo informó que cargó ese entorno.
- `npm run build -- --webpack` fuera del sandbox: exit 0, 13 páginas estáticas. Es diagnóstico, no reemplazo de `verify`.
- No se ejecutaron `db:push`, `db:push:test`, `test:policies`, `test:app`, evaluaciones pagas ni consultas al proyecto `app`; aún no existe la implementación de M25a. No se usaron datos reales ni se hizo commit, push o despliegue.
- DEC-24 autoriza expresamente que M25a supere 8 horas. No corresponde proponer otra partición de la microfase.

## Siguiente paso

Corregir los contratos y casos de `A-08`, `A-26`, `A-27`, `A-28` y `A-30` en la spec; resolver con el usuario `A-29` y coordinar la ruta; restaurar `npm run verify` (`A-31`). Después, volver a auditar la nueva versión. Este informe no aprueba la spec ni inicia M25a.
