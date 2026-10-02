# Revisión de implementación M06.3a — 11

Fecha: 2026-10-02
Rama: `mf/M06.3a`
HEAD al momento de abrir esta revisión: `0327ad647381a8c22737dc0899e18717f57e18fe`
`git merge-base main HEAD`: `80e5bf33c344da08f3648c0af10f7cfdbee2605e`

## Veredicto

**BLOQUEADO** en la precondición 1 (árbol sucio). No se pasó a leer el resto de las fuentes,
a diffear contra la base, a montar el worktree aislado ni a reejecutar `npm run verify` /
`npm run test:unit`, porque la skill exige detenerse ahí: "Si hay cambios sin commitear,
staged o archivos nuevos, pedile al usuario que commitee en la rama y frená."

## 1. Precondiciones

| Precondición | Resultado | Evidencia |
|---|---|---|
| Rama `mf/M06.3a` | PASS | `git branch --show-current` → `mf/M06.3a` |
| Microfase verificada/pendiente | PASS | `docs/PROJECT_STATE.md:23-26`: "VERIFICADO — PENDIENTE DE NUEVA REVISIÓN Y QA tras la corrección de Q-02." Coincide con la sesión. |
| Árbol limpio (excluidas `revisiones/*` y `sesiones/*-review-*`) | **FAIL** | El comando exacto de la skill devuelve 6 archivos modificados sin commitear (ver abajo). |

Comando ejecutado:

```
git status --porcelain --untracked-files=all -- . ':(exclude)docs/FASES/FASE1/*/revisiones/*' ':(exclude)docs/FASES/FASE1/meta_first/sesiones/*-review-*'
```

Salida:

```
 M docs/FASES/FASE1/meta_first/sesiones/M06.3a.md
 M docs/HALLAZGOS.md
 M scripts/lib/sql-target.mjs
 M src/modules/integrations/db/worker-api.ts
 M tests/unit/credential-crypto.test.ts
 M tests/unit/sql-test-target.test.ts
```

Ninguno de esos seis caminos cae en las exclusiones de la skill (`.../revisiones/*` o
`sesiones/*-review-*`), así que la precondición falla de forma genuina, no por un falso
positivo del patrón.

## 2. Qué son estos cambios (inspección, sin corregir nada)

`git diff` sobre esos seis archivos muestra una corrección puntual, completa en apariencia,
del hallazgo **Q-01 / `H-E1-48`** de `qa-review-6.md` (también sin commitear, en
`docs/FASES/FASE1/M06.3a/revisiones/qa-review-6.md`):

- `scripts/lib/sql-target.mjs` y `src/modules/integrations/db/worker-api.ts`: la regex
  `AMBIGUOUS_ENCODING` gana la alternativa `%[a-f0-9]?$` para cubrir un `%` ambiguo cuando
  cae en los últimos 1-2 caracteres de toda la cadena de conexión (antes no coincidía ahí
  porque las otras alternativas necesitan un carácter siguiente que inspeccionar).
- `tests/unit/credential-crypto.test.ts` y `tests/unit/sql-test-target.test.ts`: agregan los
  casos de borde `${roleUrl}%` y `${roleUrl}%4` a los arreglos `bad`/`variants` ya existentes
  (T-49 y su equivalente de T-22), sin `it` nuevos.
- `docs/HALLAZGOS.md`: registra `H-E1-48` con impacto, evidencia y corrección, enlazado a
  `qa-review-6.md` y a la sesión.
- `docs/FASES/FASE1/meta_first/sesiones/M06.3a.md`: agrega la sección "Continuación
  2026-10-02 — corrección de Q-01 de `qa-review-6`" con los comandos y resultados
  (`npm run test:unit` 9/188, `npm run verify` 10/197 + build, `npm run db:check:test`
  "Destino verificado.", `npm run test:app` del cliente 8/8) y aclara explícitamente que
  "esta corrección todavía necesita `/implementation-review` y `/qa-review`".

Es decir: el propio autor de la corrección ya documentó que falta una revisión nueva sobre
este estado. Esta revisión 11 es exactamente esa revisión — pero no puede evaluarse como
revisión de **un commit** (el manifiesto que exige la skill) mientras el cambio no esté
commiteado. Evaluar un árbol de trabajo mutable no da el mismo manifiesto estable que usará
`qa-review` después.

## 3. Señal adicional: cadenas de QA concurrentes, todavía sin resolver

`implementation-review-10.md` (ya en el árbol, también sin commitear salvo por el commit
`0327ad6` que solo agregó `implementation-review-9.md`) advertía sobre dos cadenas de QA
corriendo en paralelo sobre esta misma rama: `qa-review-5.md`/`pr.md` por un lado,
`qa-review-6.md` por otro, ambas sobre el mismo commit `56f71b7`/`0327ad6`, con veredictos
distintos (una decía lista para PR, la otra REQUIERE CAMBIOS con el hallazgo Q-01 ya
descrito). La sesión indica que el usuario eligió seguir la cadena de `qa-review-6` y pidió
corregir Q-01, lo que ya se hizo en el árbol de trabajo — pero esa decisión y su corrección
siguen sin commitear, y la cadena `qa-review-5`/`pr.md` sigue sin resolverse formalmente
(¿se descarta, se reconcilia?). Esto no es un hallazgo nuevo de esta revisión: ya estaba
señalado en la 10 y sigue abierto.

## 4. Qué falta del usuario

1. Revisar y commitear en `mf/M06.3a` los seis archivos listados en la sección 1 (la
   corrección de Q-01/H-E1-48), o descartarlos si no son los cambios que se quieren
   conservar.
2. Decidir y dejar constancia de cuál cadena de QA es la vigente (`qa-review-5`/`pr.md` o
   `qa-review-6`), ya que ambas evalúan el mismo commit `0327ad6` con veredictos distintos.
3. Una vez commiteado, volver a correr `/implementation-review M06.3a` sobre el commit
   resultante para obtener un manifiesto estable (HEAD + merge-base) y completar el resto
   del checklist (fuentes, diff completo, roturas en worktree aislado, reejecución de
   `npm run verify` / suites de III.3).

No se tocó ningún archivo del repositorio del usuario. No se creó worktree (no hizo falta
llegar a esa etapa). No se corrió `npm run verify` ni ninguna suite, porque la precondición
ya bloqueó el proceso.

## 5. Confirmaciones finales

- `git rev-parse HEAD`: `0327ad647381a8c22737dc0899e18717f57e18fe` — igual al abrir y al
  cerrar esta revisión (no se commiteó nada durante la redacción).
- El comando de árbol limpio del paso 1 sigue devolviendo los mismos seis archivos
  modificados (no cambió durante la redacción de este informe).
- `git worktree list`: solo el directorio principal; no se creó ningún worktree temporal en
  esta revisión.

## 6. Siguiente paso

BLOQUEADO → el usuario debe commitear (o descartar) los cambios pendientes en `mf/M06.3a` y
resolver cuál cadena de QA sigue vigente, y recién entonces corresponde repetir
`/microfase M06.3a` (si hace falta más corrección) o `/implementation-review M06.3a` sobre
el commit resultante.
