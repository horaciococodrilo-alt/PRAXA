# MF_FRONTEND — QA review 1

- **Fecha:** 2026-10-09
- **Commit en el que se pidió la revisión:** `dbc848f` (rama `mf/M28.2a`, con MF_FRONTEND integrada por el merge `2b4f5bb`)
- **Base (`git merge-base main HEAD`):** `80e5bf3`
- **Procedimiento:** `.claude/skills/qa-review/SKILL.md`, aplicado a mano. La skill es del proyecto
  y esta sesión no la tenía cargada.

## Veredicto

**BLOQUEADO.** Fallan tres de las cuatro precondiciones del paso 1. Según la skill, con una
precondición fallida el veredicto es BLOQUEADO; por eso no se armó la matriz ni se corrieron
pruebas exploratorias ni la verificación completa.

## Precondiciones (paso 1)

| Precondición | Resultado | Evidencia |
|---|---|---|
| Estar en la rama `mf/MF_FRONTEND` | **No cumple** | La rama no existe. MF_FRONTEND se desarrolló en `feat/landing` (`5a2a8be`) y se integró en `mf/M28.2a`, que además trae el trabajo de M06.3a y M28.2a. |
| La última `implementation-review-N.md` es APROBABLE | **No cumple** | MF_FRONTEND no pasó por `/implementation-review`: no hay ninguna revisión de implementación. |
| El commit revisado coincide con `HEAD` y su base con `merge-base` | No evaluable | No hay revisión de implementación contra la cual compararlo. |
| Árbol limpio (comando de la skill) | **No cumple** | 84 entradas: los cambios del usuario sin commitear de M28.2a (`docs/FASES/FASE1/M28.2a/plan.md`, `docs/HALLAZGOS.md`, `docs/PROJECT_STATE.md`) y archivos sin versionar (`.playwright-cli/`, `docs/landing-referencia/`, documentos de M28.2a y un archivo con el nombre de un mensaje de commit). |

## Evidencia disponible que no reemplaza a esta revisión

La sesión ([sesion.md](../sesion.md)) registra el QA hecho durante el desarrollo. Como lo hizo
quien implementó y no partió de una revisión de implementación aprobada, no cumple el papel de
QA independiente que pide esta skill:

- QA funcional en navegador: 85 verificaciones, con 79 OK, 0 fallas y 6 observaciones.
- Comparación píxel por píxel de la landing contra la referencia.
- 30 combinaciones de las pantallas de acceso.
- Lighthouse.
- `npm run verify` en `feat/landing` (187 pruebas) y sobre el merge (257 pruebas).

## Requisitos por etapa

- **Para poder correr esta revisión (lo que falta):**
  1. Una `implementation-review` APROBABLE de MF_FRONTEND.
  2. Una rama de revisión que contenga solo MF_FRONTEND. Lo natural es `feat/landing`
     (`5a2a8be`, base `80e5bf3`, árbol limpio en el worktree `PRAXA-landing`), o una rama
     `mf/MF_FRONTEND` que apunte a ese mismo commit. Usar `feat/landing` en lugar de
     `mf/MF_FRONTEND` es una adaptación de la skill que tiene que decidir el usuario.
  3. Correr la revisión desde ese worktree limpio, no desde `PRAXA`, cuyo árbol tiene trabajo
     sin commitear de M28.2a.
- **Para el merge:** no aplica tal cual. MF_FRONTEND ya está integrada en `mf/M28.2a`, de modo
  que su revisión de Codex y su CI van a llegar con el PR de M28.2a a `main`.
- **Para cerrar el gate:** MF_FRONTEND no tiene gate de la ruta; el usuario la cerró por
  decisión propia (ver [ficha.md](../ficha.md)).

## Hallazgos

Ninguno nuevo: no se ejecutaron pruebas. Siguen abiertos los registrados en la sesión
(`H-E1-76` a `H-E1-80`, en `docs/HALLAZGOS.md`).

## Pendientes del usuario

- Decidir si MF_FRONTEND pasa por el circuito completo (`/implementation-review` y después
  `/qa-review` sobre `feat/landing`) o si basta con el QA de la sesión, ya que está integrada
  en M28.2a y va a revisarse en el PR de M28.2a.
- Hacer la prueba con correos reales (confirmación y recuperación), que ninguna revisión
  automática puede cubrir.
