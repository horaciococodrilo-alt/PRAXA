# Auditoría de spec — M06.1a-M06.2a

- **Fecha:** 2026-09-26
- **Commit auditado:** `5bc7472`
- **Hash de contenido de la spec:** `a79fff1a843af0905cf98dde97d97e19b8ec3d58`
- **Spec:** `docs/FASES/FASE1/M06.1a-M06.2a/spec.md`
- **Precondición:** cumplida; la spec existe y figura en `BORRADOR` (`spec.md:1-5`).

## Veredicto

**REQUIERE CAMBIOS.** Hay siete hallazgos: dos altos, cuatro medios y uno bajo. La base en `main@5bc7472` está en verde; el veredicto se debe a defectos de la spec, no a un bloqueo del entorno.

## Checklist

| # | Ítem | PASS/FAIL/BLOQUEO | Evidencia |
|---:|---|---|---|
| 1 | Trazabilidad | PASS | Los CA de las fichas (`plan.md:189`, `:204`) aparecen en Heredados (`spec.md:386-420`), incluidos CA-02c, CA-03, CA-07, CA-08, CA-14 a CA-22 y CA-68. |
| 2 | Alcance | PASS | El alcance y los archivos (`spec.md:27-56`, `:368-382`) corresponden a las fichas y a II.4–II.5 (`plan.md:180-208`, `:429-497`); las extensiones están trazadas a CA, hallazgos o decisiones del usuario. |
| 3 | Coherencia con la spec general | FAIL | El predicado de purga usa `<= 10 minutos` aunque la ruta exige **más de** 10 minutos (A-03). Además, el diseño SQL de K04 no conserva todas las invariantes del contrato entregado (A-01). |
| 4 | Decisiones | PASS | `D-M06.1a-M06.2a-01` a `-06` figuran como decisiones del usuario o de la ruta y no contradicen un DEC cerrado (`spec.md:570-579`). |
| 5 | Trampas | PASS | Las tres trampas de II.4 y las tres de II.5, incluida la hipótesis de PostgreSQL 16+, están reflejadas (`spec.md:540-562`; `plan.md:470-497`). |
| 6 | Intervenciones y acciones reservadas | FAIL | La spec asigna `db:push:test` al usuario (`spec.md:525-536`), pero las dos fichas de mayor jerarquía dicen que no hay intervención del usuario (`plan.md:193`, `:208`) y III.2 no incluye este grupo (`plan.md:760-776`) (A-02). |
| 7 | Verificación | PASS | Incluye `db:check:test`, `db:push:test`, `test:policies`, `test:app` y `verify`, y declara que una suite omitida no cuenta (`spec.md:512-523`), conforme a III.3 y CB-01–CB-06. |
| 8 | Dependencias | PASS | `G-K01` y `G-K02-K04` constan aprobados (`PROJECT_STATE.md:12-14`) y sus entregables están en `HEAD`; las evidencias de M05.1.1 y M05.1.2–M05.1.4 fueron revisadas completas. |
| 9 | Lo entregado de verdad | FAIL | K04 exige IV de 12 bytes y scopes con forma cerrada y sin repetidos (`credential.ts:21-23`, `:35-55`); la tabla propuesta no los garantiza (`spec.md:198-213`) (A-01). |
| 10 | Pendientes y hallazgos | PASS | La spec resuelve o difiere expresamente `H-E1-05`, `-06`, `-07`, `-11`, `-12`, `-18`, `-19`, `-20`, `-21` y `H-M04.1-02` (`spec.md:599-610`), de acuerdo con `HALLAZGOS.md`. |
| 11 | Contexto real | FAIL | La cita `HALLAZGOS.md:68` usada para el TTL (`spec.md:90`) apunta a una línea vacía; la evidencia está en `HALLAZGOS.md:69` (A-07). Las demás referencias verificadas existen y sostienen lo afirmado. |
| 12 | Archivos previstos | PASS | Todos los archivos de `spec.md:368-382` están autorizados por II.4–II.5 o por las precondiciones 8 y 9 (`plan.md:370-371`). |
| 13 | Diseño suficiente | FAIL | Las contradicciones sobre K04, el umbral de purga, el cerrojo de `consume_oauth_attempt` y el resultado de `purge_connection` obligan al implementador a elegir entre instrucciones incompatibles (A-01, A-03, A-05 y A-06). |
| 14 | Verificable | FAIL | Faltan negativos de K04 y del borde exacto de 10 minutos; además, T-01, T-03, T-38 y T-40 no inspeccionan archivos nuevos sin seguimiento (`spec.md:470-472`, `:507-509`) (A-01, A-03 y A-04). |
| 15 | Sin nada abierto | PASS | Preguntas abiertas está vacía (`spec.md:595-597`) y cada hipótesis declara cuándo se verifica o dónde queda diferida (`spec.md:581-593`). |
| 16 | Ejecutable ahora | PASS | Las dependencias y scripts existen, y las variables que usa el grupo figuran por nombre en `.env.example`. En un worktree limpio de `5bc7472`, `npm ci` terminó con exit 0 y `npm run verify` terminó con exit 0: lint, typegen, typecheck, 8 archivos/145 pruebas y build en verde. |
| 17 | Consistencia interna | FAIL | El SQL de purga contradice C-37; la regla común de cerrojo contradice la excepción de consumo; y el catálogo de errores contradice el retorno de purga (A-03, A-05 y A-06). |
| 18 | Reglas no negociables | PASS | El tenant se resuelve por membresía; no se aceptan datos reales ni secretos; solo se crea `0012`; las pruebas apuntan al proyecto desechable; las credenciales solo son accesibles por `worker_api`; y los mensajes son fijos y redactados (`spec.md:27-56`, `:103-109`, `:215-290`, `:512-536`). |

## Contradicciones

| Elemento de la spec | Contradice a (fuente y ubicación) | Evidencia | Cómo se resuelve |
|---|---|---|---|
| El usuario ejecuta `npm run db:push:test` (`spec.md:530`). | Fichas de M06.1a y M06.2a (`plan.md:193`, `:208`) e intervenciones de III.2 (`plan.md:760-776`). | Las fichas dicen “Ninguna” y III.2 empieza la siguiente intervención en M06.3a. | Requiere decisión del usuario: si `db:push:test` queda reservado, actualizar la fuente de mayor jerarquía y III.2; si no, asignarlo al asistente y corregir la spec. |
| K04 se describe como coincidente con el contrato, pero `iv` se limita a longitud 16 y forma base64 y `granted_scopes` solo exige cardinalidad y `ads_read` (`spec.md:204-213`). | Contrato entregado (`credential.ts:21-23`, `:35-55`) y el propio contexto de la spec (`spec.md:96`, `:213`). | Una cadena base64 de 16 caracteres puede decodificar a 10, 11 o 12 bytes; además, la tabla admite scopes repetidos o con forma inválida. | Definir checks/helpers SQL exactos para bytes decodificados, forma de cada scope y ausencia de duplicados; agregar negativos pgTAP. |
| La sentencia de purga elimina con `consumed_at <= now() - interval '10 minutes'` (`spec.md:279`). | Ruta (`plan.md:456`), Heredados (`spec.md:411`) y C-37 (`spec.md:443`). | Esas tres fuentes exigen borrar solo los consumidos hace **más de** 10 minutos y conservar los de 10 minutos o menos. | Cambiar el comparador a `<` y probar explícitamente el borde exacto de 10 minutos. |
| Regla común: toda función que escribe toma `lock_company` (`spec.md:268`). | Diseño específico de `consume_oauth_attempt` (`spec.md:280`). | `consume_oauth_attempt` escribe y la spec ordena expresamente que no tome el cerrojo. | Declarar la excepción en la regla común y conservar la justificación de atomicidad de la fila. |
| El catálogo hace indistinguibles conexión inexistente y ajena mediante `PX001` (`spec.md:241`). | `purge_connection` (`spec.md:287`) y sus criterios (`spec.md:441`, `:450`). | Para purga, inexistente devuelve `false`, mientras ajena devuelve `PX001`; por tanto se distinguen. | Fijar una sola semántica segura para purga y alinear catálogo, C-16/C-24 y pruebas. |

## Hallazgos

| ID | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-01 | alta | Diseño concreto §5.3; C-07; casos | La persistencia K04 acepta valores que el contrato real rechaza: el check propuesto del IV no garantiza 12 bytes y `granted_scopes` no garantiza forma ni unicidad. Tampoco hay casos negativos para esas invariantes. | `spec.md:198-213`, `:432`, `:486`; `credential.ts:21-23`, `:35-55`; `primitives.ts:17-25`. Como comprobación, `AAAAAAAAAAAAAA==` tiene 16 caracteres y decodifica a 10 bytes. | Especificar los checks/helpers SQL exactos y agregar pgTAP para IV de 10/11 bytes, scope inválido y scope repetido. | No. |
| A-02 | alta | Intervenciones | La spec agrega una intervención del usuario que la ficha de mayor jerarquía niega. Esto activa la condición de parada de `AGENTS.md`. | `spec.md:525-536`; `plan.md:193`, `:208`, `:760-776`; `AGENTS.md:24-38`. | Resolver por decisión explícita y alinear Parte I, III.2 y spec. | Sí. |
| A-03 | media | Función `create_oauth_attempt`; C-37 | El comparador `<=` borra el intento exactamente a los 10 minutos, pero el criterio ordena conservarlo. T-39 no prueba ese borde. | `spec.md:279`, `:411`, `:443`, `:508`; `plan.md:456`. | Usar `< now() - interval '10 minutes'` y agregar el caso exacto de 10 minutos. | No. |
| A-04 | media | Casos T-01, T-03, T-38 y T-40 | Los comandos basados en `git diff` y `git grep` omiten archivos nuevos sin seguimiento; por tanto pueden dar un falso verde sobre `0012` y las pruebas nuevas. | `spec.md:470-472`, `:507-509`. Reproducción en este árbol: `git diff` y `git grep` no mostraron la spec no rastreada, mientras `git ls-files --others --exclude-standard` sí. | Usar comandos que incluyan tracked y untracked (`git ls-files -co --exclude-standard` más lectura/búsqueda directa), o declarar y verificar un `git add -N` reversible antes de los diffs. | No. |
| A-05 | media | Reglas comunes de funciones | La regla general exige cerrojo a toda escritura, pero `consume_oauth_attempt` ordena no tomarlo. | `spec.md:268`, `:280`. | Escribir “todas las que escriben, excepto `consume_oauth_attempt`” y mantener su serialización por `UPDATE ... RETURNING`. | No. |
| A-06 | media | Catálogo de errores y `purge_connection` | La spec no fija si una conexión inexistente y una ajena deben ser indistinguibles en la purga; actualmente exige resultados distintos. | `spec.md:241`, `:287`, `:441`, `:450`, `:494`, `:499`. | Elegir una semántica que no revele existencia entre tenants y alinear función, criterios y casos. | No. |
| A-07 | baja | Contexto verificado | Una referencia de línea es falsa. | `spec.md:90` cita `HALLAZGOS.md:68`; la evidencia está en `HALLAZGOS.md:69`. | Corregir la cita o reemplazarla por la sección/ID estable `H-E1-19`. | No. |

## Observación de tamaño (no afecta el veredicto)

El grupo contiene dos microfases con límite independiente de hasta 8 horas, pero cada mitad sigue siendo amplia: M06.1a incluye el esquema, tres tablas y doce funciones; M06.2a incluye cuatro archivos pgTAP, una prueba remota y el procedimiento condicional de cierre. Si al planificar no caben en sus límites, conviene subdividir cada ID en cortes revisables (tablas/privilegios y funciones para M06.1a; aislamiento/privilegios y ciclo de vida/cierre para M06.2a) sin adelantar `G-DB-META`.

## Verificaciones ejecutadas

| Comando | Resultado |
|---|---|
| `git status --short --branch` | `main...origin/main`; solo la carpeta documental `docs/FASES/FASE1/M06.1a-M06.2a/` estaba sin seguimiento antes del informe. |
| `git rev-parse --short HEAD` | `5bc7472`. |
| `grep -v '^\*\*Estado:\*\*' .../spec.md \| git hash-object --stdin` | `a79fff1a843af0905cf98dde97d97e19b8ec3d58`. |
| `git worktree add --detach <temporal> HEAD` | Worktree limpio creado desde `5bc7472`. |
| `npm ci` en el worktree | Exit 0; 471 paquetes, 0 vulnerabilidades informadas. |
| `npm run verify` en el worktree, sandbox | Fallo de entorno al iniciar Vitest: `spawn EPERM`; no fue un fallo de código. |
| `npm run verify` en el mismo worktree, reejecución fuera del sandbox | **Exit 0.** Lint, typegen y typecheck en verde; 8 archivos y 145 pruebas pasaron; `next build` terminó correctamente. |
| Comprobación de longitudes base64 con Node | 16 caracteres pueden decodificar a 10 o 12 bytes; confirma A-01. |
| Comprobación de `git diff`/`git grep` contra un archivo no rastreado | No lo inspeccionan; `git ls-files --others --exclude-standard` sí lo lista. Confirma A-04. |

No se leyó `.env.local`, no se ejecutó ninguna prueba contra una base remota y no se expuso ningún secreto.

## Siguiente paso

Resolver A-02 mediante decisión del usuario; aplicar las correcciones técnicas A-01 y A-03 a A-07 en la spec; luego ejecutar una nueva auditoría. La spec no debe pasar a `APROBADA` todavía.
