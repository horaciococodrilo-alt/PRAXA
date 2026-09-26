---
name: implementation-review
description: Revisa en contexto aislado si la implementación de una microfase realmente funciona y cumple su spec, su plan y la ruta meta_first. Vuelve a correr las verificaciones, prueba en una copia aislada que los tests detectan roturas y revisa el alcance, la seguridad y la evidencia. Emite APROBABLE, REQUIERE CAMBIOS o BLOQUEADO en revisiones/implementation-review-N.md. No corrige código. Solo cuando el usuario invoca /implementation-review [ID].
argument-hint: "[ID de la microfase]"
disable-model-invocation: true
context: fork
---

# Revisión de implementación de $ARGUMENTS

Sos un revisor independiente. No confiás en lo que dice la sesión de implementación: lo comprobás.

Solo escribís tu informe:
- con pipeline, en `docs/FASES/FASE1/$ARGUMENTS/revisiones/implementation-review-N.md`;
- sin pipeline, en `docs/FASES/FASE1/meta_first/sesiones/$ARGUMENTS-implementation-review-N.md`.

N es el número más alto que ya exista, más uno.

No corregís código ni documentos. No hacés commits ni push, y no corrés `db:push` de ningún tipo. **Nunca modificás el directorio de trabajo del usuario:** las roturas deliberadas se hacen en una copia aislada (paso 3.3).

## 1. Estado revisado (el manifiesto)

1. **Precondiciones.** Si alguna falla, el veredicto es BLOQUEADO y decís qué falta.
   - Estás en la rama `mf/$ARGUMENTS`.
   - La microfase figura como `VERIFICADO — PENDIENTE DE APROBACIÓN`, en `docs/PROJECT_STATE.md` o en la sesión.
   - **El árbol está limpio**, salvo los informes de revisión. Este comando no devuelve nada:

     ```
     git status --porcelain --untracked-files=all -- . ':(exclude)docs/FASES/FASE1/*/revisiones/*' ':(exclude)docs/FASES/FASE1/meta_first/sesiones/*-review-*'
     ```

     Si hay cambios sin commitear, staged o archivos nuevos, pedile al usuario que commitee en la rama y frená.
2. **El estado revisado es un commit.** Registrá:
   - `git rev-parse HEAD`: el commit revisado;
   - `git merge-base main HEAD`: la base fija.

   Git identifica el contenido completo por esos dos valores: rutas, contenido, modos, renombres, borrados y cambios staged. Es el mismo manifiesto que va a usar `qa-review`.

## 2. Fuentes

Leé:

- `AGENTS.md`;
- de `docs/FASES/FASE1/meta_first/plan.md`: la ficha en la Parte I, la sección en la Parte II y las secciones III.3 y III.9;
- los CA, DEC y CB citados en `docs/FASES/FASE1/meta_first/spec.md`;
- la spec y el plan de `docs/FASES/FASE1/$ARGUMENTS/`, si existen;
- `sesiones/$ARGUMENTS.md`;
- los hallazgos asignados a esta microfase;
- **todo el cambio:** `git diff --stat BASE HEAD` y `git diff BASE HEAD` con renombres detectados (`-M`), y el contenido completo de cada archivo nuevo o modificado. BASE es el merge-base registrado.

## 3. Checklist

Marcá cada ítem PASS o FAIL, con evidencia.

1. **Alcance.**
   - Los archivos tocados están dentro del plan de la microfase (o de la tabla de la Parte II, con la regla de rutas sugeridas) más los de seguimiento.
   - No hay funcionalidad de más.
   - No falta nada de lo que exige "Implementación requerida".
2. **Criterios.** Para cada criterio heredado y operativo:
   - existe al menos una prueba;
   - leés la prueba y confirmás que su aserción verifica ese criterio, y no otra cosa;
   - la prueba pasa.
3. **Las pruebas detectan roturas, probado en una copia aislada.**
   - Creá un worktree temporal **del commit revisado**, fuera del repositorio: `git worktree add` a una ruta como `../praxa-review-$ARGUMENTS`, y después `npm ci` adentro.
   - Elegí hasta 3 criterios críticos: seguridad, aislamiento, dinero o estados. Para cada uno, en el worktree:
     1. introducí una rotura mínima que viole el criterio;
     2. corré solo la prueba correspondiente y registrá si falla;
     3. restaurá con `git checkout -- [archivo]` dentro del worktree.
   - Al terminar, eliminá el worktree con `git worktree remove [ruta]`. Si Git se niega por archivos ignorados, podés usar `--force`, **solo** sobre esa ruta temporal.
   - Una rotura que ninguna prueba detecta es FAIL.
   - Si una rotura necesita la base de datos o variables de `.env.local`, no la hagas en el worktree: registrala como no probada y explicá por qué.
4. **Reejecución,** en el directorio del usuario y sin modificar nada.
   - Corré `npm run verify` y todas las suites de III.3 que no dependan del usuario.
   - Compará con la sesión: la cantidad de archivos y de pruebas, y el resultado de cada suite.
   - Las diferencias irrelevantes, como la duración o el formato de salida, no son FAIL. Una diferencia de resultado se investiga antes de concluir: es FAIL si viene del código, y BLOQUEO si viene del entorno.
   - En Windows, si Vitest no carga las suites desde Git Bash (H-E1-20), repetí con `powershell -NoProfile -Command "npm run …"`.
   - Una suite que dependa del usuario queda como pendiente suya. Una prueba omitida cuenta como no ejecutada (CB-06).
5. **Seguridad y reglas.**
   - Búsqueda por patrón de secretos, tokens e identificadores de cuentas (`act_[0-9]{6,}`), sin escribir valores reales.
   - Ninguna lectura de `.env.local`.
   - Ninguna migración existente modificada. Revisá el diff de `supabase/migrations/`, incluidos los renombres.
   - Tenant resuelto en el servidor, con K01.
   - Errores redactados.
   - Sin `service_role`.
   - Módulos `server-only` donde corresponde.
6. **Calidad funcional.**
   - Los caminos de error que exige la spec están implementados.
   - Tipos estrictos, sin `any` injustificados.
   - Se siguen los patrones existentes.
   - No hay código muerto ni TODO que escondan alcance pendiente.
7. **Evidencia.**
   - La sesión registra los comandos con sus resultados reales y los desvíos.
   - Los hallazgos nuevos tienen ID.
   - El gate **de esta microfase** no figura como aprobado en `PROJECT_STATE.md`. Los gates previos aprobados legítimamente son correctos.
8. **Contradicciones.** No hay ninguna con la spec, el plan ni `AGENTS.md`.

## 4. Veredicto

- **APROBABLE:** los 8 ítems en PASS.
- **REQUIERE CAMBIOS:** algún FAIL que se corrige dentro de la microfase.
- **BLOQUEADO:** falta algo del usuario o del entorno, o el problema exige cambiar la spec, el plan o la ruta.

Severidad de cada hallazgo:
- **alta:** el criterio no se cumple, hay un riesgo de seguridad o una prueba vacía;
- **media:** hueco de cobertura o de manejo de errores;
- **baja:** calidad o redacción.

## 5. Informe

- fecha, commit revisado y base;
- veredicto;
- checklist: `# | Ítem | PASS/FAIL/BLOQUEO | Evidencia`;
- matriz de criterios: `Criterio | Prueba | Aserción verifica el criterio (sí/no) | Resultado`;
- roturas: `Criterio | Rotura | Prueba que la detectó | Probada en worktree (sí/no, motivo)`;
- comandos reejecutados y sus resultados;
- hallazgos: `ID (R-NN) | Severidad | Archivo:línea | Problema | Evidencia | Corrección propuesta`;
- pendientes del usuario.

**Antes de terminar**, confirmá tres cosas:
- `git rev-parse HEAD` sigue igual;
- el comando de árbol limpio del paso 1 sigue sin devolver nada;
- el worktree temporal fue eliminado (`git worktree list`).

## 6. Reporte

Veredicto, hallazgos por severidad y siguiente paso:

- APROBABLE: `/qa-review $ARGUMENTS`.
- REQUIERE CAMBIOS: volver a `/microfase $ARGUMENTS` con los hallazgos; el usuario commitea y se revisa de nuevo.
- BLOQUEADO: lo que falta.
