# Propuesta de enmienda M25a — H-E1-211 / 0019

**Estado:** PROPUESTA, NO APLICADA. La decisión del usuario autoriza preparar la salida B, la prueba roja y el ensayo reversible de `0019`; no autoriza todavía editar los tres documentos de abajo ni aplicar la migración al desechable. `0018` permanece intacta. Esta propuesta no aprueba el gate ni habilita la etapa .2.

## Motivo y alcance

`0018` ya aplicada deja `chat_ranking.composition.partial=false` cuando una entidad parcial precede a otra completa. La nueva pgTAP falla con `0018` y pasa con `0019`. La corrección reemplaza solo `public.chat_ranking` con la misma firma y grants. No hay tablas, helpers ni cambios de privilegios nuevos. Se conservan los resultados y las tendencias, con una ejecución por conjunto para estas últimas.

La jerarquía de `AGENTS.md` obliga a enmendar también **la Parte I del plan de la ruta**: su enmienda del chat declara «migración única `0018`». La spec y el plan de M25a solos no podrían autorizar `0019`. Los textos históricos de las enmiendas de numeración se conservan; una nueva enmienda prevalece sobre la frase de migración única.

## 1. `docs/FASES/FASE1/meta_first/plan.md` — enmienda de ruta

Añadir al bloque de enmiendas, antes de la ficha de M25a:

> **Enmienda correctiva H-E1-211 (pendiente de aprobación):** después de aplicar `0018` al desechable, una prueba nueva reprodujo un defecto de `chat_ranking`: `composition.partial` puede perder la parcialidad de una entidad anterior. Por decisión del usuario, M25a.1 incorpora `0019_chat_ranking_composition.sql`, que reemplaza únicamente `public.chat_ranking` con la misma firma y grants. `0018` no se edita. Esta excepción sustituye «migración única `0018`» solo para M25a; no autoriza otra migración. La prueba roja contra `0018` y el ensayo de `0019` con rollback preceden al `db:push:test` de `0019` por el usuario. Tras aplicarla, se repiten `test:policies`, `test:app` y el control de etapa. En `app`, el usuario aplica `0018` y `0019`, en ese orden, antes de integrar el código en `main`.

En la ficha I.5, cambiar la intervención y la frase de orden para nombrar **ambas** migraciones. En II.12, añadir un paso correctivo al final de la tabla: prueba pgTAP de A parcial primero/B completa última, `0019` solo para `chat_ranking`, ensayo con rollback y medición de `include_trend=false/true`; después, `db:push:test` de `0019` por el usuario y repetición de políticas y Data API. El control de etapa requiere `0018` y `0019` aplicadas en el desechable. En el cierre de II.13b y la tabla de intervención de III.2, sustituir «`0018` en `app`» por «`0018` y `0019` en `app`, en orden». Las menciones históricas de `0018` como base de tablas y de `purge_connection` no cambian.

## 2. `docs/FASES/FASE1/M25a/spec.md`

- Resumen y cierre: `0018` sigue creando el esquema y las funciones; `0019` corrige solo `chat_ranking`. El usuario aplicará las dos migraciones, en orden, en `app` antes del código.
- Diseño §2: reemplazar la frase «no se crea `0019`, que no está autorizada» por esta excepción expresa: «El defecto H-E1-211, descubierto después de aplicar `0018` al desechable, se corrige exclusivamente en `0019_chat_ranking_composition.sql`, autorizado por decisión del usuario y por esta enmienda. `0018` no se modifica. Antes de aplicar `0019`, pgTAP debe fallar contra `0018` y pasar en una transacción que aplique `0019` y termine con rollback; se miden ambas opciones de tendencia. Después del `db:push:test` del usuario, se repiten historial, `test:policies`, `test:app` y el control completo. Cualquier otro defecto SQL posterior vuelve a detener la corrida y requiere nueva decisión; no se crea `0020` automáticamente».
- «Archivos previstos»: añadir `supabase/migrations/0019_chat_ranking_composition.sql` como nuevo, con propósito «reemplazo exclusivo de `public.chat_ranking`: composición acumulada y tendencia por conjunto» y autorización por esta enmienda de la ruta. La pgTAP 15, `tests/app/chat-tools.test.ts`, `results.ts` y `tests/unit/chat-tools.test.ts` ya figuran en la lista.
- C-76 y T-84: añadir el segundo ensayo reversible y la segunda aplicación por el usuario. T-27: exigir que A tenga 1/2 días y mayor valor, B 2/2 y sea la última, y que `composition.partial` del **resultado** sea `true`. T-28: medir también `include_trend=true` con 93 días, 500 anuncios y 20 entidades por Data API, conservando valores y tendencias. H-07: registrar la medición de ambas variantes y que la optimización correctiva está en `0019`.
- **T-82:** cambiar la expectativa «Solo `A` de `0018`; ninguna modificada» por «Solo `A` de `0018_chat_queries.sql` y `A` de `0019_chat_ranking_composition.sql`; ninguna migración existente modificada». Antes del commit, usar también `git status --short -- supabase/migrations/` porque `git diff` no muestra archivos nuevos sin seguimiento.
- Control .1, intervenciones y publicación: exigir `0019` aplicada al desechable antes de declarar verde; en `app`, aplicar `0018` y `0019` antes del código. No se declara .1 cerrada ni se pide commit hasta ese control.

## 3. `docs/FASES/FASE1/M25a/plan.md`

- Tabla «Archivos»: añadir `supabase/migrations/0019_chat_ranking_composition.sql`, nuevo, etapa .1, autorizado por la enmienda de la ruta y spec. Los tests y `results.ts` ya están previstos.
- Tras el paso 6 y antes del 7, añadir **6b**: prueba roja en `15` sobre `0018` aplicada; `0019` reemplaza solo `chat_ranking`; ensayo completo con rollback, paridad de tendencias y medición de `include_trend=false/true` bajo el timeout del rol. Añadir **6c (usuario)**: `npm run db:check:test` y `npm run db:push:test` para `0019`; asistente comprueba historial y repite `test:policies`, T-28 por Data API y `npm run test:app`.
- Paso 7 y «Verificación final»: el control completo incluye `0019` aplicada y T-82 revisa exactamente dos archivos añadidos, `0018` y `0019`. El commit del usuario sigue después del control verde.
- Paso 25 e intervenciones: `db:preview` y `db:push` en `app` comprueban/aplican `0018` y `0019` en orden, antes de integrar código.
- «Migraciones»: conservar que `0018` fue ensayada y aplicada; añadir «`0019_chat_ranking_composition.sql` es la corrección excepcional de H-E1-211, sin editar `0018`, solo `create or replace public.chat_ranking` con grants idénticos. Requiere ensayo con rollback, aprobación de esta enmienda y `db:push:test` del usuario; no se crea otra migración sin decisión y autorización documental».

## Efecto sobre aprobaciones

Al aplicar el texto aprobado, cambian los hashes de contenido de la spec y el plan. Se recalculan y se repiten las auditorías del pipeline para que sus veredictos correspondan a las versiones nuevas; la aprobación de la enmienda no aprueba `G-CHAT` ni sustituye las pruebas posteriores al push.
