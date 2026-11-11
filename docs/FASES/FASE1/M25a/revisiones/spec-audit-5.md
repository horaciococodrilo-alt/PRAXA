# Auditoría de la spec de M25a — ronda 5

- **Fecha:** 2026-11-09 (America/Buenos_Aires).
- **Commit:** `45ba01f` (`docs/m25a-spec`); árbol limpio al comenzar.
- **Hash de contenido de `M25a/spec.md` sin la línea `**Estado:**`:** `d380cb76dfbc102ebb7a2c4133409d40d55e830f`. Se preservaron los LF originales y se pasó el contenido UTF-8 a `git hash-object --stdin` desde Node.
- **Precondición:** `spec.md:3` sigue en `BORRADOR`. Ya existe `spec-audit-4.md`, por lo que este informe es `spec-audit-5.md`.

## Veredicto

**REQUIERE CAMBIOS.** El checklist tiene **13 PASS y 5 FAIL**. Hay **8 hallazgos**: 3 altos, 3 medios y 2 bajos. Las decisiones D-M25a-15 y D-M25a-16 y la enmienda de CA-51/52 resuelven la necesidad de autorización de la ronda 4, pero el texto de D-M25a-15 aún contradice un caso de presentación. La base de código no cambió en el commit auditado; el `verify` literal volvió a fallar por Turbopack en este árbol, aunque la ronda 4 lo había hecho pasar en un worktree de `main`.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---|---|---|---|
| 1 | Trazabilidad | FAIL | `spec.md:607`, `:609` resumen CA-51 y CA-52 como «toda respuesta» y «siempre», pero la ruta enmendada ahora dice «toda respuesta con datos» y condiciona la cuenta (`meta_first/spec.md:468-470`): A-50. Los demás CA de la ficha de `plan.md:342` están en `spec.md:598-631`. |
| 2 | Alcance | PASS | `spec.md:29-65`, `:564-594` y `plan.md:20`, `:333-354`, II.12, II.13 y II.13b. El turno en curso figura ahora en el alcance (`spec.md:33`); Inicio está autorizado por D-M25a-16. |
| 3 | Coherencia con la spec general | PASS | CA-51/52, CA-62/69 y CA-38c se enmendaron en `meta_first/spec.md`; el diseño de M25a no necesita un nuevo componente para `M28.3a` (`plan.md:358-371`). La fidelidad del resumen heredado se trata en ítem 1; la representación de dos períodos en el propio documento se trata en A-34. |
| 4 | Decisiones | PASS | D-M25a-01 a -16 constan como del usuario (`spec.md:865-884`). D-15 y D-16 están en `meta_first/plan.md:20` y `sesiones/enmienda-spec-m25a-2026-11-08.md`; sus decisiones no contradicen la ruta. La implementación propuesta de D-15 se contradice internamente: A-47. |
| 5 | Trampas | PASS | `spec.md:844-863` recoge las de `plan.md` II.12 y II.13; CA-50b conserva pruebas adversarias y VR-02 (`spec.md:761-765`, `:775`, `:784`). |
| 6 | Intervenciones y acciones reservadas | PASS | `spec.md:827-842`, ficha `plan.md:346` y III.2. `db:push:test`, `db:push` en `app`, commits, push, despliegue, cuenta y clave de DeepInfra, acta y recorrido del usuario tienen intervención y comprobación posterior. |
| 7 | Verificación | PASS | `spec.md:815-825` incluye `verify`, `db:check:test`, `test:policies`, `test:app`, adversarias, VR-02 y recorrido; coincide con `plan.md:350-354`, III.3 y CB-06 de la spec general. El orden del ensayo previo y T-28 no es ejecutable como está: A-39. |
| 8 | Dependencias | PASS | `PROJECT_STATE.md`, «Cerradas» y «Siguiente habilitada»: `G-SYNC` aprobado. La base contiene K01, `0016`, `0017` y las interfaces de M16c; `git diff HEAD^ HEAD --name-only` muestra solo documentación. |
| 9 | Lo entregado de verdad | PASS | `spec.md:67-112`, `:269`, `:293`, `:308`, `:348` se contrastaron con `connections.ts`, `insights.ts`, `worker-api.ts`, `0016` y `0017`. La falta de `AbortSignal` de `entities` y `connection_status` ya tiene tratamiento explícito. |
| 10 | Pendientes y hallazgos | PASS | `spec.md:886-920`, `PROJECT_STATE.md` y los H-E1-187, -189, -190, -194, -202 y -185 de `HALLAZGOS.md`. La validación con filas reales queda diferida con motivo y paso. |
| 11 | Contexto real | PASS | Las referencias de código de `spec.md:67-112`, las migraciones y pruebas citadas existen. La cita corrida a `plan.md:351` fue sustituida por la fila de M25a.2 (`spec.md:917`). |
| 12 | Archivos previstos | PASS | `spec.md:564-594`; Parte II y enmienda de `plan.md:20`. `src/app/(app)/app/page.tsx` tiene D-M25a-16 y `app-paginas-sesion.test.tsx` D-M25a-14. |
| 13 | Diseño suficiente | FAIL | El esquema de salida plano aún no define proyección por `kind` y tipo de bloque, `shares` no tiene referencia unívoca, falta `presence` en el resultado que C-18 exige y `period_a`/`period_b` no aparecen en el contrato del claim: A-08, A-33, A-34. El ensayo de T-28 antes del push tampoco puede implementarse como está: A-39. |
| 14 | Verificable | FAIL | Los C-01 a C-80 tienen caso T-01 a T-88, con comandos y resultados en general concretos. Pero T-28 es `test:app`, mientras H-07 y T-84 lo ubican dentro de una transacción con rollback anterior al push: A-39. |
| 15 | Sin nada abierto | PASS | `spec.md:904-906` no tiene preguntas abiertas. H-01 a H-11 tienen cómo y cuándo verificar (`:886-900`); H-07 ahora manda frenar después de un push si aparece un defecto SQL. |
| 16 | Ejecutable ahora | FAIL | `npm run verify` en este árbol: exit 1. Pasaron lint, typegen, typecheck y 28 archivos/765 pruebas; `next build` falló en Turbopack al crear un proceso al transformar `src/app/globals.css`. Es el mismo fallo operativo de A-31 de la ronda 3. La ronda 4 registró `verify` exit 0 en worktree de `main@b0c854d`; este commit solo cambió docs. Scripts actuales están en `package.json` y los previstos se crean en M25a. No se leyó `.env.local`. |
| 17 | Consistencia interna | FAIL | D-M25a-15 dice que una abstención con cuenta conectada muestra solo la cuenta, pero la fila `no_coverage` añade período y zona (A-47). `C-18` exige `presence` que la forma común omite (A-33), y la tabla de presentación contiene una celda extra (A-45). |
| 18 | Reglas no negociables | PASS | `spec.md:126-170`, `:304-308`, `:314-335`, `:392-403`, `:533-542`, `:815-842`: K01 interno, migración `0018` nueva, fixtures sintéticos en desechable, `worker_api` para escrituras, `service_role` solo para fixtures administrativos de prueba según `SECURITY.md:190`, `:345-354`, errores redactados y sin secretos en evidencia. |

## Contradicciones

| Elemento de la spec | Contradice a (fuente y ubicación) | Evidencia | Cómo se resuelve |
|---|---|---|---|
| Resumen heredado «Toda respuesta» / «siempre» (`spec.md:607`, `:609`) | CA-51 y CA-52 ya enmendados (`meta_first/spec.md:468-470`) | Omite las condiciones «con datos», «cuando haya cuenta» y las salidas sin datos de D-M25a-15 | Actualizar los dos resúmenes sin cambiar la ruta. A-50. |
| Pie de `no_coverage` con cuenta, período y zona (`spec.md:412`) | D-M25a-15 (`spec.md:883`) | La decisión dice «repregunta o abstención con cuenta conectada, solo la cuenta»; `no_coverage` es una abstención | Precisar con el usuario si `no_coverage` es una excepción con período y zona, o cambiar esa fila para mostrar solo cuenta. A-47. |
| `C-18` exige presencia por valor (`spec.md:654`) | Forma común del resultado (`spec.md:187-198`) | `values` tiene `absence` y `temporal_status`, pero no `presence`; `chat_entity_days` sí la obtiene (`spec.md:176`) | Agregar `presence` y su enum a `values`, o cambiar C-18 y justificar cómo se representa sin pérdida. A-33. |
| T-28 antes del push con rollback (`spec.md:896`, `:807`) | T-28 es `test:app` por Data API (`spec.md:751`); el ensayo precedente de M16c corrió pgTAP dentro de la transacción (`sesiones/M16c.md:181`) | La Data API usa otra conexión y no ve una migración aún no confirmada; T-28 no puede medir esas funciones en el ensayo con rollback | Ensayar SQL y pgTAP dentro de la transacción; ejecutar T-28 después del push. Si T-28 falla por SQL, frenar y consultar, sin editar `0018`. A-39. |

## Hallazgos

| ID (A-NN) | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-08 | Media | Contratos de resultado y salida | Queda una parte sin cierre: `shares` usa `path_key`, pero los segmentos de ejemplo repiten `path_key: segment`, de modo que la participación no identifica una fila. El esquema de redacción trae todos los campos de `kind` y bloque en nulo cuando no aplican, pero no define la proyección/validación previa a los esquemas por variante, como sí hace `projectToolArgs` para herramientas. El implementador debe inventar esa transición o rechazar salidas válidas. | `spec.md:213`, `:226`, `:295-300`, `:372-384`, `:458` | Referir `shares` mediante `/values/N` o hacer `path_key` único; definir la proyección del objeto plano por `kind` y `type`, incluidos nulos admisibles, con un caso válido y uno de campo ajeno. | No |
| A-31 | Alta | Entrada / verificación | Reapareció el fallo operativo de Turbopack en el árbol actual: `verify` obligatorio no termina. No prueba un defecto del CSS ni de la spec; en la ronda 4 pasó desde un worktree de `main` con el mismo código. | `npm run verify`: exit 1 tras 765 pruebas, panic «creating new process / node process exited before we could connect» en `globals.css`; `git diff HEAD^ HEAD --name-only` sin código | Restaurar el entorno de build y repetir el comando literal `npm run verify` antes de aprobar. | No |
| A-33 | Media | Forma común y C-18 | Sigue faltando la presencia de fila por valor. `absence = no_informado` indica falta de métrica, pero no reemplaza al estado de presencia que C-18 promete. | `spec.md:176`, `:187-198`, `:654`; `meta_first/spec.md:356`, `:360` | Agregar `presence: con_datos | sin_fila_reportada | no_observado` a cada valor y probar los tres estados en T-18/T-22; o cambiar el criterio y conservar la distinción por otra forma explícita. | No |
| A-34 | Media | Dos períodos y claims | §3 ahora exige `period_a` y `period_b` en el claim de `difference`/`change`, pero §8 enumera los campos del claim y solo incluye `period`. T-40 promete comparar los dos campos que el contrato de salida no declara. | `spec.md:203-204`, `:210-211`, `:372`, `:763`; `meta_first/spec.md:417`, `:434` | Declarar los campos en `output-schema.ts` y su nulabilidad por `kind`, conservando `period` donde hay uno; fijar la comparación exacta de ambos y un caso negativo. Si se altera el contrato del CA-50 de la ruta, coordinarlo allí. | No para una precisión compatible |
| A-39 | Alta | Ensayo previo, H-07 y T-28 | La corrección de la ronda 4 ubica T-28, que es `test:app`, en el ensayo transaccional anterior a `db:push:test`. Una conexión HTTP independiente no ve objetos SQL no confirmados. La condición de rendimiento de H-07 no queda medida antes del push como promete. | `spec.md:128`, `:751`, `:807`, `:896`; `sesiones/M16c.md:181`; `scripts/db-push.mjs:9-12` | Separar ensayo transaccional de SQL/pgTAP y prueba real de Data API posterior al push. Aclarar que un fallo posterior frena y requiere una salida autorizada, sin editar `0018`. | No para corregir el orden; sí si se autoriza `0019` después |
| A-45 | Baja | Tabla del pie | La última fila de la tabla tiene tres celdas con un encabezado de dos. La frase sobre totales parciales queda absorbida como tercera celda. | `spec.md:407-415` | Cerrar la fila de «Mensajes fijos» tras «Sin pie» y pasar la frase a un párrafo. | No |
| A-47 | Alta | D-M25a-15 y pie | La nueva decisión del usuario fija «solo la cuenta» para toda abstención con cuenta conectada, mientras `no_coverage` incluye período y zona. Es una excepción que la decisión no declara. | `spec.md:409-415`, `:883`; `meta_first/spec.md:468-470` | Pedir al usuario que precise D-15 para `no_coverage` y alinear la tabla y T-44 con esa elección. | **Sí** |
| A-50 | Baja | CA heredados | El resumen de CA-51 y CA-52 quedó con la redacción anterior a la enmienda y ya no es fiel a la ruta. | `spec.md:607`, `:609`; `meta_first/spec.md:468-470`; `plan.md:20` | Copiar el alcance de las condiciones nuevas en dos resúmenes breves. | No |

## Verificaciones y límites

- `git status --short` estaba vacío al empezar; `git diff --check` salió 0. El commit `45ba01f` solo cambió la spec, dos auditorías anteriores y la ruta documental. Solo se escribió este informe.
- Se contrastaron `AGENTS.md`, la spec completa, la ficha de M25a y de M28.3a, Parte II.12/13/13b y III.2/3/9 del plan, la spec general completa, `PROJECT_STATE.md`, `HALLAZGOS.md`, sesiones de dependencias (incluido el ensayo de M16c), `SECURITY.md`, `ARCHITECTURE.md` y contratos/código real citados. Las rondas 1 a 4 se usaron para comprobar correcciones, no para heredar su veredicto.
- `npm run verify` fuera del sandbox: exit 1. Lint, typegen, typecheck y 28 archivos/765 pruebas pasaron; `next build` produjo un panic de Turbopack al crear un proceso. La ronda 4 registró exit 0 de `verify` en un worktree de `main@b0c854d`, con 13 páginas. El fallo actual queda atribuido a este entorno, no a M25a.
- No se corrieron `test:policies`, `test:app`, `db:push`, `db:push:test`, evaluaciones pagas ni consultas a `app`; M25a sigue sin implementación. No se leyó `.env.local`, ni se imprimieron valores de entorno.
- DEC-24 y la ficha exceptúan M25a del límite de 8 horas; no corresponde proponer otro corte sin reabrir esa decisión.

## Siguiente paso

Corregir A-08, A-33, A-34, A-39, A-45 y A-50 en la spec; resolver con el usuario A-47; repetir `npm run verify` en un entorno donde Turbopack complete (A-31). Después se audita de nuevo. Este informe no aprueba la spec, no inicia M25a y no modifica el gate.
