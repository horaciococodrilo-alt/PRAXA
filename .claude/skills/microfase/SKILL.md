---
name: microfase
description: Ejecuta UNA microfase de la ruta meta_first de PRAXA según su spec y plan de microfase aprobados (docs/FASES/FASE1/[ID]/) y la ruta (docs/FASES/FASE1/meta_first/), la verifica y la deja pendiente de revisión y aprobación. Solo cuando el usuario invoca /microfase [ID].
argument-hint: "[ID de la microfase]"
disable-model-invocation: true
---

# Ejecutar la microfase $ARGUMENTS

Si `$ARGUMENTS` está vacío, preguntá qué microfase ejecutar y no hagas nada más.

## Qué autoriza esta invocación

`/microfase [ID]` autoriza, **solo para esa microfase**, a:

- leer el repositorio;
- crear o retomar la rama `mf/[ID]`;
- implementar;
- verificar;
- registrar el progreso.

No autoriza a empezar otra microfase, aprobar gates, hacer commits, push ni despliegues, ni correr `db:push` contra el proyecto `app`.

## Estados

- **`EN CURSO`**: la microfase se está implementando.
- **`BLOQUEADO`**: siempre con el motivo y con lo que falta para destrabarla.
- **`VERIFICADO — PENDIENTE DE APROBACIÓN`**: la implementación pasó sus verificaciones. Todavía faltan las revisiones y la aprobación del usuario.

El gate solo queda aprobado cuando el usuario lo aprueba explícitamente. Nunca registres un gate como aprobado por iniciativa propia.

## 1. Modo y lectura

Primero determiná el modo:

- **Con pipeline.** Existe `docs/FASES/FASE1/$ARGUMENTS/spec.md`. Tienen que cumplirse las cuatro condiciones siguientes; si falla alguna, el estado es `BLOQUEADO`:
  - la spec está `APROBADA` por el usuario;
  - el plan está `APROBADO` por el usuario;
  - la última `revisiones/spec-audit-N.md` es APROBABLE y su hash de spec coincide con el actual;
  - la última `revisiones/plan-audit-N.md` es APROBABLE y sus hashes de spec y de plan coinciden con los actuales.

  Una auditoría APROBABLE no equivale a la aprobación del usuario: hacen falta las dos. Si las aprobaciones ya están registradas, no las pidas de nuevo.

  Los hashes se calculan así: `grep -v '^\*\*Estado:\*\*' ARCHIVO | git hash-object --stdin`.
- **Sin pipeline.** No existe esa carpeta. Se ejecuta directamente con el plan de la ruta.

Después leé, en este orden:

1. `AGENTS.md`: la jerarquía de fuentes y el contrato de ejecución.
2. `docs/PROJECT_STATE.md`.
3. Según `AGENTS.md`, `docs/ROADMAP.md` está archivado y el roadmap vigente es la Parte I de `plan.md` de la ruta. Si el archivo existiera en el repositorio, es una contradicción: reportala.
4. De `docs/FASES/FASE1/meta_first/plan.md`:
   - la ficha de `$ARGUMENTS` en la Parte I;
   - su sección en la Parte II;
   - las secciones III.3 y III.9.
5. Con pipeline: la spec y el plan de `docs/FASES/FASE1/$ARGUMENTS/`. Son el detalle operativo dentro de los límites de la ruta.
6. De `docs/FASES/FASE1/meta_first/spec.md`: cada CA, DEC, P, H y VR citado.
7. Las secciones de `docs/SECURITY.md` y `docs/ARCHITECTURE.md` que toquen lo que vas a modificar.
8. El código existente que se nombra.

Mostrá un resumen con:

- hasta 5 líneas de lo que vas a construir;
- el modo;
- los criterios que vas a cubrir;
- el estado de las dependencias;
- las intervenciones del usuario, con el paso en que ocurren;
- cualquier contradicción.

**Seguí sin esperar un OK.** Frená con `BLOQUEADO` solo si:

- hay una contradicción;
- una dependencia no está aprobada;
- falla una precondición del modo con pipeline;
- hace falta una intervención humana antes de empezar.

## 2. Rama y precondiciones

1. **Git.** Revisá `git status` y preservá los cambios existentes. Si un cambio ajeno impide cambiar de rama, el estado es `BLOQUEADO`. No descartes cambios ni uses stash.
2. **Dependencias.** `docs/PROJECT_STATE.md` tiene que registrar como aprobados los gates de las dependencias, y la rama base tiene que contener su trabajo.
3. **Rama.**
   - Si `mf/$ARGUMENTS` no existe, creala desde la base con `git switch -c mf/$ARGUMENTS`.
   - Si existe, cambiate a ella y retomá desde su `git log`, su diff contra la base y `docs/FASES/FASE1/meta_first/sesiones/$ARGUMENTS.md`, sin sobrescribir trabajo.
4. **Operaciones prohibidas:** `reset --hard`, `clean`, `checkout -- .`, `branch -D`, `rebase`, cualquier `--force` y `push`.
5. **Base de datos.** Si la microfase toca la base, `npm run db:check:test` tiene que apuntar al proyecto desechable.
6. Anotá la microfase como `EN CURSO` en `docs/PROJECT_STATE.md`.

## 3. Ejecución

1. **TDD cuando corresponda.** Aplicalo si el plan (el de la microfase o el de la ruta) lo indica, o si la microfase produce código con comportamiento que se puede probar.
   - El rojo inicial esperado no es un bloqueo.
   - Un fallo inesperado se diagnostica antes de seguir.
   - En documentación y configuración, corré las verificaciones específicas que indique el plan.
2. **Pasos.** Seguí los pasos del plan de la microfase, o los de la Parte II si trabajás sin pipeline, en orden, y verificá cada uno al terminarlo.
3. **Archivos permitidos:**
   - los que lista el plan de la microfase, o la tabla de la Parte II sin pipeline;
   - los archivos de seguimiento: `docs/HALLAZGOS.md`, `docs/PROJECT_STATE.md` y `docs/FASES/FASE1/meta_first/sesiones/$ARGUMENTS.md`, solo para progreso, evidencia, hallazgos y pendientes;
   - cualquier otro archivo: frená y proponé el cambio.

   No modificás la spec ni el plan de la microfase.
   - Si el código no cumple una spec y un plan válidos, **corregí el código**. Eso es parte de implementar.
   - Si el problema está en la spec o en el plan (una contradicción, algo imposible de implementar, un dato que resultó falso), el estado es `BLOQUEADO` y hay que volver a pasar por grill o por plan mode.
4. **Datos sensibles.** Nada de secretos, tokens, montos reales ni identificadores completos de cuentas. Nunca leas `.env.local` ni pidas secretos en el chat.
5. **Migraciones.** Ninguna migración existente se modifica.
6. **Hallazgos.** Lo que esté fuera de alcance va a `docs/HALLAZGOS.md`, con ID estable, impacto, evidencia y microfase asignada.
7. **Log.** En `sesiones/$ARGUMENTS.md` registrá los pasos, los comandos con su resultado real y los desvíos.

**Condiciones de parada:** las de III.9 del plan de la ruta. Ante cualquiera, `BLOQUEADO` y reporte.

## 4. Intervenciones y acciones externas

- **Intervención del usuario:**
  - explicá qué hacer, dónde y cómo se verifica, sin pedirle ningún valor;
  - el estado queda `BLOQUEADO` hasta que confirme;
  - cuando confirme, verificá lo que se pueda verificar.
- **Acciones reservadas al usuario:** push, despliegue, `db:push` contra el proyecto `app` y cualquier comando que los permisos nieguen, como `db:push:test`.
  1. Prepará todo lo que se pueda verificar.
  2. Indicale el paso exacto.
  3. Cuando confirme, verificá el resultado.
- **Si falta una acción obligatoria,** la microfase no puede quedar verificada: queda `BLOQUEADO`.

## 5. Verificación

- Corré `npm run verify` y todas las suites que III.3, o el plan de la microfase, exigen.
- La evidencia registra los comandos y sus resultados reales.
- Una prueba omitida por falta de configuración cuenta como no ejecutada (CB-06). En ese caso, el estado es `BLOQUEADO`.
- **Windows.** Si Vitest no carga las suites desde Git Bash (H-E1-20), corré el comando con `powershell -NoProfile -Command "npm run …"` antes de concluir que algo falla.

## 6. Revisión

- **Con pipeline:** no revisás vos. La revisión la hacen `/implementation-review $ARGUMENTS` y `/qa-review $ARGUMENTS`, en contexto aislado.
- **Sin pipeline:** comprobá que el subagente `revisor-microfase` esté disponible en `.claude/agents/`. Si no está, reportalo y recomendá `/implementation-review $ARGUMENTS`. Si está, invocalo sobre el diff y la evidencia, y **evaluá cada hallazgo**:
  - si es correcto, corregilo;
  - si no, rechazalo con su motivo en el log.

  No aceptes nada automáticamente. Si no converge en dos iteraciones, `BLOQUEADO`.

## 7. Entrega

1. Actualizá `docs/PROJECT_STATE.md` con el estado final, la referencia a la evidencia y los pendientes.
2. Reportá:
   - **Estado**, con el motivo si es `BLOQUEADO`;
   - **rama y archivos**;
   - **tabla** `Criterio | Prueba | Resultado real`;
   - **verificación resumida**;
   - **desvíos y hallazgos**;
   - **acciones del usuario**: ejecutadas y pendientes;
   - **siguiente paso**: el usuario commitea en `mf/$ARGUMENTS`, porque las revisiones exigen un árbol limpio. Después: con pipeline, `/implementation-review $ARGUMENTS`; sin pipeline, `/implementation-review $ARGUMENTS` si es recomendable, o la aprobación del gate.

No empieces la siguiente microfase.
