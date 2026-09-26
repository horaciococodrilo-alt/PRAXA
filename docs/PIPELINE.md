# Pipeline de ejecución de microfases

Es el recorrido que sigue cada microfase de la ruta `meta_first`. Cada paso tiene una sola salida válida; si no la obtenés, se vuelve al paso que corresponde.

## Instalación (una sola vez)

1. Copiá `.claude/skills/*` y `docs/_templates/mf-*.md` al repo.
2. `.claude/skills/microfase/SKILL.md` reemplaza a la versión anterior.
3. Autorizá los artefactos del pipeline en el plan de la ruta. En una sesión, pedí:
   > Fuera de microfase, a pedido mío: en `docs/FASES/FASE1/meta_first/plan.md`, en "Precondiciones de toda la ruta" (Parte II), agregá el punto 9: "Artefactos del pipeline de microfases (`docs/PIPELINE.md`): se autorizan `docs/FASES/FASE1/[ID]/spec.md`, `plan.md` y `revisiones/*.md`, y las pruebas temporales de `tests/unit/__qa__/`, que `qa-review` borra antes de terminar." Mostrame el diff.
4. Commit en `main`. Cerrá Claude Code y volvé a abrirlo. Escribí `/` y verificá que aparezcan las 6 skills del pipeline, además de tu `grill-me`.

**Contexto aislado.** Las auditorías y revisiones usan `context: fork`: corren en un subagente que no ve la conversación en la que se escribió el código. Si tu versión de Claude Code no soporta esa opción, la skill corre en la conversación actual. En ese caso, corré cada auditoría y cada revisión en una sesión nueva (`/clear`) para mantener la independencia.

## El recorrido

| # | Paso | Comando | Sesión | Sale con |
|---:|---|---|---|---|
| 1 | Elegir la microfase | La "siguiente microfase" de `docs/PROJECT_STATE.md` | — | Un ID |
| 2 | Expandir | `/expand-microfase [ID]` | Cualquiera (corre aislada) | La spec completa, `docs/FASES/FASE1/[ID]/spec.md`, en `BORRADOR` |
| 3 | Grill | Tu `/grill-me` sobre la spec, con el prompt de abajo. Si la spec no tiene preguntas abiertas, se saltea | La actual (es interactiva) | Spec sin preguntas abiertas |
| 4 | Auditar la spec | `/spec-auditor [ID]` | Aislada | APROBABLE; si no, corregir o volver a 3 |
| 5 | Aprobar la spec | Vos: "Apruebo la spec de [ID]: pasá el estado a APROBADA." | — | Spec `APROBADA` |
| 6 | Plan | Plan mode, con el prompt de abajo | Nueva | `docs/FASES/FASE1/[ID]/plan.md` |
| 7 | Auditar el plan | `/plan-auditor [ID]` | Aislada | APROBABLE; si no, volver a 6 |
| 7b | Aprobar el plan | Vos: "Apruebo el plan de [ID]: pasá el estado a APROBADO." | — | Plan `APROBADO` |
| 8 | Modelo y esfuerzo | Ver la tabla de abajo | — | — |
| 9 | Implementar | `/microfase [ID]`. La skill crea la rama `mf/[ID]` | Nueva (`/clear`) | `VERIFICADO — PENDIENTE DE APROBACIÓN` |
| 9b | Commitear en la rama | Vos: `git add -A && git commit -m "[ID]: implementación"` | — | Árbol limpio. Las revisiones lo exigen |
| 10 | Revisar la implementación | `/implementation-review [ID]` | Aislada | APROBABLE; si no, volver a 9 con los hallazgos y repetir 9b |
| 11 | QA y verificación | `/qa-review [ID]` | Aislada | LISTO PARA PR, más `revisiones/pr.md` |
| 12 | Abrir el PR | Vos: commit en `mf/[ID]`, push y PR con `pr.md` como descripción | — | PR abierto |
| 13 | Codex y CI | Revisión de Codex. La CI de `verify.yml` corre `npm run verify` | — | Codex sin bloqueantes y CI en verde |
| 14 | Aprobar y mergear | Vos: "Apruebo [gate]. Registralo en PROJECT_STATE." Después, commit, push y merge | — | Gate aprobado y `main` actualizado |
| 15 | Acciones posteriores | Las que liste `pr.md` (por ejemplo, `db:push` al proyecto `app`) | — | Verificadas |

**Si Codex o la CI piden cambios:** volvés a `/microfase [ID]` con los comentarios, commiteás y repetís 10 y 11. Las revisiones quedan atadas al commit revisado, así que no se puede saltear ninguna de las dos.

**Cuando la sección de la Parte II agrupa varias microfases,** usás el grupo como ID. Por ejemplo, `M05.1.2-M05.1.4`.

**Microfases solo de documentación o configuración** (`M03a`, `M28.2a`): el pipeline completo no aporta. Salteá los pasos 2 a 7 y corré `/microfase [ID]`, que trabaja sin pipeline, y después `/qa-review [ID]`.

## Prompt para el grill (paso 3)

```
/grill-me sobre docs/FASES/FASE1/[ID]/spec.md. La agenda es su sección "Preguntas abiertas" más, si existe, los hallazgos que requieren decisión de la última revisiones/spec-audit-N.md. No reabras decisiones de la ruta ni amplíes el alcance.
```

Cuando termine el grill, pedí:

```
Incorporá cada respuesta a docs/FASES/FASE1/[ID]/spec.md: registrala en "Decisiones de la microfase" como D-[ID]-NN (motivo, usuario, fecha), actualizá las secciones afectadas y vaciá "Preguntas abiertas". Si una respuesta contradice la ruta, no la apliques y decímelo. No toques otro archivo.
```

## Prompt para plan mode (paso 6)

Entrá a plan mode (en Claude Code, `Shift+Tab` hasta que aparezca "plan mode") y pegá:

```
Planificá la implementación de la microfase [ID] a partir de docs/FASES/FASE1/[ID]/spec.md (APROBADA), la ficha y la sección de la ruta en docs/FASES/FASE1/meta_first/plan.md, AGENTS.md y el código actual. Usá la estructura de docs/_templates/mf-plan.md. Cada criterio y cada caso de prueba de la spec tiene que aparecer en al menos un paso. Aplicá TDD donde corresponda. Los archivos tienen que estar dentro de la tabla de la ruta más los de seguimiento. Las acciones reservadas al usuario (push, despliegue, db:push al proyecto app, db:push:test) van en su paso, con su verificación. No implementes nada.
```

Cuando aceptes el plan y salgas de plan mode, pedí:

```
Guardá ese plan en docs/FASES/FASE1/[ID]/plan.md con la plantilla mf-plan.md, en estado BORRADOR y con el hash de contenido de la spec. No implementes nada.
```

## Modelo y esfuerzo

| Microfases | `/microfase` | Grill, auditorías y revisiones |
|---|---|---|
| `M06.1a`, `M06.2a`, `M06.3a`, `M16.1`, `M16.2`, `M16c`, `M25a.2` | Alto | Alto |
| Las demás | Medio | Alto |

## Frases de aprobación

- Spec: "Apruebo la spec de [ID]: pasá el estado a APROBADA."
- Plan: "Apruebo el plan de [ID]: pasá el estado a APROBADO."
- Gate: "Apruebo [gate]. Registralo en PROJECT_STATE."

Una auditoría APROBABLE no reemplaza tu aprobación.

Ninguna skill aprueba nada por su cuenta.

## Hashes

- **Spec y plan:** `grep -v '^\*\*Estado:\*\*' ARCHIVO | git hash-object --stdin`. Si el archivo cambia después de auditado, hay que volver a auditarlo. Cambiar solo la línea de estado no cuenta como cambio.
- **Estado del código:** es el commit revisado (`git rev-parse HEAD`) más su base (`git merge-base main HEAD`), con el árbol limpio salvo los informes de revisión. Git ya cubre rutas, contenido, modos, renombres, borrados y cambios staged. Si el commit cambia después de la revisión, `qa-review` queda `BLOQUEADO`.

## Permisos recomendados

Las revisiones corren en un subagente, y un pedido de permiso puede quedar escondido: así es como una revisión se "cuelga". Agregá a `allow` en `.claude/settings.json` las reglas que falten:

```json
"Bash(git rev-parse*)",
"Bash(git merge-base*)",
"Bash(git show*)",
"Bash(git hash-object*)",
"Bash(git worktree add ../praxa-review-*)",
"Bash(git worktree remove ../praxa-review-*)",
"Bash(git worktree list*)",
"Bash(npm ci)",
"Bash(powershell -NoProfile -Command \"npm run *)"
```

`rm -rf` sigue denegado: las copias temporales se eliminan con `git worktree remove`.

## Windows

Si Vitest no carga las suites desde Git Bash (H-E1-20), las skills repiten el comando con `powershell -NoProfile -Command "npm run …"`. Un fallo del entorno cuenta como BLOQUEO, no como defecto del código ni de la spec.

## Agentes existentes

- `revisor-microfase`: lo usa `/microfase` solo cuando trabaja sin pipeline.
- `auditor-gate`: queda reemplazado por `/spec-auditor` y `/plan-auditor`. Se conserva, pero el pipeline no lo usa.
