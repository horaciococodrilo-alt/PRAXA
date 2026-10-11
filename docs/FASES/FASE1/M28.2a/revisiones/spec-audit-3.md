# Auditoría de spec — M28.2a — 2026-10-03 (tercera ronda)

- **Commit auditado:** `7b2a30f`.
- **Árbol de trabajo:** se evalúa la spec del árbol de trabajo. Ya tenía cambios sin commit en `docs/FASES/FASE1/M28.2a/spec.md` y `docs/FASES/FASE1/meta_first/spec.md`, más `spec-audit-1.md` y `spec-audit-2.md` sin seguimiento. Se preservaron todos.
- **Hash de contenido de la spec, sin la línea de estado:** `cb4ab933b0bcdf480a5ef699c278f7b96dbf55ec`.
- **Estado de entrada:** `BORRADOR`. Cumple la precondición.
- **Veredicto: APROBABLE.** Los 18 ítems están en PASS. A-01, A-02 y A-03 de la ronda anterior quedaron corregidos y verificados.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---:|---|---|---|
| 1 | Trazabilidad | PASS | La ficha M28.2a tiene tres condiciones de aceptación sin ID de CA (`meta_first/plan.md:234`); están resumidas en `M28.2a/spec.md:125-133`. |
| 2 | Alcance | PASS | `M28.2a/spec.md:33-48` mantiene el alcance de la ficha (`plan.md:230-238`) y de II.7 (`plan.md:530-551`). La verificación de `private` además de `worker_api` es consistente con DEC-03 y `SECURITY.md:98`, que ya exige verificar ambos esquemas en el panel. |
| 3 | Coherencia con la spec general | PASS | DEC-03/07/08/18, P-06, secciones 5, 5b, 13b y CB-01–CB-06 son compatibles con el diseño. La excepción manual figura en DEC-18 (`meta_first/spec.md:58,509`) y CB-04 la delimita a M28.2a, sin suites ni fixtures (`:539`). M16.1 solo consume G-ENTORNO (`plan.md:267`). |
| 4 | Decisiones | PASS | D-M28.2a-01 a 03 constan como decisiones del usuario en el grill del 2026-10-03 (`M28.2a/spec.md:205-213`). No contradicen DEC-07, DEC-08 ni DEC-18. |
| 5 | Trampas | PASS | La prueba externa de correo y el SMTP propio cubren la trampa de direcciones de equipo (`plan.md:553`, `M28.2a/spec.md:195`). La restricción Hobby y su riesgo quedan declarados (`plan.md:555`, `M28.2a/spec.md:201`). Las fuentes oficiales abiertas durante esta auditoría confirman el límite actual de dos mensajes por hora del SMTP por defecto y que Hobby es para uso personal no comercial: [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Vercel Fair Use](https://vercel.com/docs/limits/fair-use-guidelines). |
| 6 | Intervenciones y acciones reservadas | PASS | `M28.2a/spec.md:178-191` asigna las tareas de cuentas al usuario y reserva para él push, despliegue, `db:push` en `app` y `db:push:test`; pasos y comprobaciones corresponden a II.7 y III.2 (`plan.md:536-551,777`). |
| 7 | Verificación | PASS | Incluye `npm run verify`, checklist manual y registro externo (`M28.2a/spec.md:168-176`), de acuerdo con III.3 (`plan.md:787-800`) y CB-06. `db:check`/`db:push` quedan asignados al usuario (`:170,183-189`). |
| 8 | Dependencias | PASS | `PROJECT_STATE.md` registra G-CRYPTO aprobado y M28.2a habilitada, sin empezar (`:20,24`). `git merge-base --is-ancestor d3db802017b8367edba40e0a6ca9641167edb771 HEAD` tuvo éxito. |
| 9 | Lo entregado de verdad | PASS | Las firmas citadas coinciden con el código actual: `parseCredentialKeyring` (`keyring.ts:43`), `validateConnectionString` (`worker-api.ts:108`) y validación de destino (`scripts/check-target.mjs:15`, `scripts/lib/target.mjs:194`). La spec usa contratos existentes y no inventa APIs. |
| 10 | Pendientes y hallazgos | PASS | H-E1-08 está asignado y pendiente (`HALLAZGOS.md:25,357`) y queda sujeto a evidencia real de correo externo (`M28.2a/spec.md:237`). H-E1-23 se declara antecedente fuera de este corte (`:238`; `HALLAZGOS.md:40,395`). Los pendientes generales de `PROJECT_STATE.md` no afectan a M28.2a. |
| 11 | Contexto real | PASS | Se contrastaron las referencias de `M28.2a/spec.md:52-70` con el código: scripts de Auth y callback, shell de sesión/empresa, pantalla de Integraciones, migración 0012, scripts de destino, cliente del rol, llavero y suite opt-in de correo. Las líneas corregidas en A-03 apuntan a las declaraciones citadas. |
| 12 | Archivos previstos | PASS | `entorno.md` está autorizado por II.7 paso 9; los archivos de sesión/estado/hallazgos lo están por III.3, el contrato documental y el protocolo de cierre (`M28.2a/spec.md:110-121`). No se necesita editar SECURITY ni ARCHITECTURE: la verificación remota ya está contemplada en `SECURITY.md:98`. |
| 13 | Diseño suficiente | PASS | Define variables, destinos, callbacks, esquemas, orden de migración, comprobaciones Auth y respuestas negativas (`M28.2a/spec.md:74-108,137-166`). El usuario puede ejecutar el recorrido sin inventar nombres o resultados esperados. |
| 14 | Verificable | PASS | C-01–C-10 tienen casos T-01–T-11 con comandos existentes o pasos manuales reproducibles y resultados esperados (`M28.2a/spec.md:137-166`). Incluye rechazos de login/registro, callbacks incompletos y verificación de ambos esquemas. |
| 15 | Sin nada abierto | PASS | Las preguntas del grill están marcadas resueltas y vinculadas con decisiones (`M28.2a/spec.md:223-233`). Las hipótesis declaran cómo/cuándo comprobarse (`:215-221`); no bloquean el diseño. |
| 16 | Ejecutable ahora | PASS | Scripts `verify`, `db:check`, `db:preview` y `db:push` están definidos en `package.json`; variables del gate existen por nombre en `.env.example:21,27,30,87,90,94`. `npm run verify` terminó con exit 0: lint, typegen, typecheck, 11 archivos/222 pruebas y build. La primera corrida en sandbox falló al crear proceso (`spawn EPERM`); la repetición fuera del sandbox completó satisfactoriamente. |
| 17 | Consistencia interna | PASS | Alcance, criterio C-04, caso T-04 y pasos II.7.4–5 comprueban consistentemente que ni `worker_api` ni `private` estén expuestos (`M28.2a/spec.md:38,142,159`; `plan.md:539-540`). Las exclusiones no contradicen pasos obligatorios. |
| 18 | Reglas no negociables | PASS | No hay escritura de producto ni entrada de `company_id` del cliente; no hay secretos o datos reales; no se editan migraciones; CB-04 y D-M28.2a-03 limitan las acciones sobre `app` al recorrido manual; no se introduce una vía de credenciales fuera de `worker_api`; se exige evidencia redactada (`M28.2a/spec.md:43-48,174,187-203`). |

## Contradicciones

Ninguna. Las discrepancias A-01 (excepción manual vs. DEC-18), A-02 (omisión de `private`) y A-03 (referencias incorrectas) de la ronda 1 ya no aparecen en el texto auditado; se verificaron en el diff y en las fuentes actuales.

## Hallazgos

Ninguno nuevo. H-E1-08 sigue pendiente hasta que se compruebe el envío externo durante la implementación.

## Observación de tamaño

No se recomienda partir la microfase. El trabajo de implementación es documental y de verificación manual, con operaciones externas que el plan asigna al usuario; la spec conserva el límite de ocho horas de implementación.

## Siguiente paso

La spec es APROBABLE. El usuario puede aprobarla para pasarla a `APROBADA` y continuar con el plan de M28.2a. Esta auditoría no cierra G-ENTORNO ni inicia la microfase.

## Nota aclaratoria posterior (2026-10-03, añadida fuera de ronda)

Al auditar el plan de M28.2a (`/plan-auditor`), se detectó que el hash `cb4ab933b0bcdf480a5ef699c278f7b96dbf55ec` registrado arriba no corresponde al contenido que terminó comiteado en `7b2a30f` ni en `8cc58eb` (el commit que fijó `spec.md` en estado `APROBADA`). Se buscó ese contenido en los dos commits que tocan `spec.md` y en todos los blobs colgantes del repositorio (`git fsck --unreachable --no-reflogs`, recalculando el hash de cada uno sin la línea de estado): no se encontró ninguna coincidencia. Esa versión solo existió transitoriamente en el árbol de trabajo durante esta tercera ronda y nunca quedó comiteada.

El contenido vigente de `spec.md` (hash `7517041448d9579977406bf7c8cd6d39a954e922`, el mismo desde `7b2a30f` hasta hoy) es el que audita `revisiones/spec-audit-2.md`, también con veredicto APROBABLE. A efectos de identidad de contenido para auditorías posteriores del plan, debe tratarse `spec-audit-2.md` como la auditoría de spec vigente para ese hash, pese a no ser la de número más alto — esta nota dentro de `spec-audit-3.md` deja registrada la razón para no bloquear por ese desfase de numeración.
