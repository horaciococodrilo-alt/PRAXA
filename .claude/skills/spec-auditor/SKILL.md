---
name: spec-auditor
description: Audita en contexto aislado docs/FASES/FASE1/[ID]/spec.md contra la ruta meta_first (plan y spec general), PROJECT_STATE, HALLAZGOS y el código real. Comprueba que no los contradiga, que se pueda ejecutar ahora y que sea correcta en sí misma. Emite APROBABLE, REQUIERE CAMBIOS o BLOQUEADO en revisiones/spec-audit-N.md y no edita la spec. Solo cuando el usuario invoca /spec-auditor [ID].
argument-hint: "[ID de la microfase]"
disable-model-invocation: true
context: fork
---

# Auditoría de la spec de $ARGUMENTS

Sos un auditor independiente. Tu pregunta es una sola: **¿esta spec se puede ejecutar tal como está, sin contradecir nada y sin que el implementador tenga que inventar?**

No editás la spec ni ningún otro archivo, salvo tu informe: `docs/FASES/FASE1/$ARGUMENTS/revisiones/spec-audit-N.md`, donde N es el número más alto que ya exista, más uno. No proponés mejoras opcionales ni ampliás el alcance.

## 1. Precondición

La spec existe y está en `BORRADOR`. Si no existe, o si ya está `APROBADA`, reportalo y frená sin escribir nada.

## 2. Fuentes (todas, completas)

1. La spec de la microfase.
2. `AGENTS.md`: la jerarquía y las reglas.
3. `docs/FASES/FASE1/meta_first/plan.md`: la ficha de `$ARGUMENTS` en la Parte I, su sección en la Parte II, y las secciones III.2, III.3 y III.9. También las fichas de las microfases que dependen de esta, para saber qué van a necesitar de ella.
4. `docs/FASES/FASE1/meta_first/spec.md`, **entero**, no solo los CA que cita la spec de la microfase.
5. `docs/PROJECT_STATE.md`, entero: gates, pendientes, decisiones y estado de cada microfase.
6. `docs/HALLAZGOS.md`: los hallazgos asignados a esta microfase y los abiertos que la afecten.
7. `docs/FASES/FASE1/meta_first/sesiones/`: la evidencia de las microfases de las que depende esta.
8. `docs/SECURITY.md`.
9. El código real: cada archivo que cita la spec, y lo que entregaron de verdad las microfases previas.

## 3. Checklist

Marcá cada ítem PASS o FAIL, con evidencia (archivo y sección o línea).

### A. No contradice la ruta

1. **Trazabilidad.** Todos los CA de la ficha aparecen en "Heredados", sin omisiones y resumidos con fidelidad.
2. **Alcance.** Nada amplía ni reduce la ficha y la sección de la Parte II. Cada criterio operativo traza a un CA, un DEC o una trampa de la ruta.
3. **Coherencia con la spec general.** Ningún elemento contradice un CA, DEC, CB o regla de la spec general. Tampoco lo que van a consumir las microfases siguientes: nombres, tipos, interfaces, estados. Cada contradicción se cita con las dos fuentes.
4. **Decisiones.** Cada `D-$ARGUMENTS-NN` figura como decisión del usuario y no contradice ningún DEC ni CA de la ruta.
5. **Trampas.** Las de la sección de la Parte II están reflejadas.
6. **Intervenciones y acciones reservadas.** Coinciden con la ficha y con III.2. El push, el despliegue, el `db:push` al proyecto `app` y el `db:push:test` quedan asignados al usuario, cada uno con su verificación posterior.
7. **Verificación.** Incluye todas las suites que III.3 exige para esta microfase, y CB-06.

### B. No contradice el estado real

8. **Dependencias.** `PROJECT_STATE.md` registra aprobados los gates de las dependencias, y la rama base contiene su trabajo.
9. **Lo entregado de verdad.** La spec usa las interfaces que las microfases previas entregaron en el código, no las que planeaba la ruta. Cada diferencia entre lo planeado y lo entregado está resuelta en la spec o registrada como pregunta.
10. **Pendientes y hallazgos.** Cada hallazgo asignado a esta microfase, y cada pendiente de `PROJECT_STATE.md` que la toque, queda resuelto en la spec o diferido de forma explícita, con su motivo. Ninguno contradice la spec.
11. **Contexto real.** Todas las referencias `archivo:línea` a lo **existente** existen y dicen lo que la spec afirma. Una sola falsa es FAIL. Lo que la microfase va a crear tiene que estar declarado como previsto; no se exige que exista.
12. **Archivos previstos.** Cada archivo está autorizado por la tabla de la Parte II o es de seguimiento.

### C. Se puede ejecutar

13. **Diseño suficiente.** El implementador puede avanzar sin inventar nombres, tipos, errores ni objetos SQL.
14. **Verificable.** Cada criterio tiene al menos un caso de prueba, con un comando real de `package.json` y un resultado esperado concreto. Hay casos negativos y de borde donde corresponde. No quedan términos vagos.
15. **Sin nada abierto.** "Preguntas abiertas" está vacía. Cada HIPÓTESIS dice cómo y cuándo se verifica, y ninguna bloquea la implementación sin un paso previsto. Los supuestos externos **decisivos** (APIs de Meta, Supabase, Vercel, DeepInfra) tienen evidencia oficial vigente o una validación posterior explícita (VR, P o H de la ruta, o un paso de la spec). Podés reutilizar la evidencia que dejó la expansión si alcanza; no hace falta investigar todo de nuevo.
16. **Ejecutable ahora.** Distinguí dos tipos de requisitos:
    - **Prerrequisitos, que tienen que existir hoy:** lo que entregaron las microfases previas, los scripts de `package.json` que la spec usa sin crearlos, las variables que usa sin crearlas (por nombre, en `.env.example`; nunca leas `.env.local`) y las intervenciones del usuario que hacen falta antes del primer paso, hechas o con un paso asignado.
    - **Lo que crea la microfase** (scripts, variables, archivos nuevos): tiene que estar declarado en la spec, pero no tiene que existir todavía.
    - **La base tiene que estar en verde.** Corré `npm run verify`:
      - en el directorio actual, si está en la rama base y limpio;
      - si no, en un worktree temporal de la base: `git worktree add` fuera del repositorio, `npm ci` y después `git worktree remove`.

      Un fallo del código de la base es FAIL. Un fallo del entorno (acceso, configuración, shell) no es un defecto de la spec: marcalo como BLOQUEO. En Windows, si Vitest no carga las suites desde Git Bash (H-E1-20), corré el comando con `powershell -NoProfile -Command "npm run verify"` antes de concluir.

### D. Es correcta en sí misma

17. **Consistencia interna.** Alcance, diseño, criterios, casos y archivos coinciden entre sí. Ninguna sección contradice a otra, y "Fuera de alcance" no excluye algo que la spec exige.
18. **Reglas no negociables.**
    - Tenant resuelto en el servidor (K01).
    - Sin secretos ni datos reales.
    - Migraciones nuevas, nunca editadas.
    - Pruebas solo contra el proyecto desechable.
    - Credenciales solo por `worker_api`.
    - Errores redactados.

Además, como observación que no afecta el veredicto: si la microfase no parece caber en 8 horas, recomendá cómo partirla.

## 4. Veredicto

- **APROBABLE:** los 18 ítems en PASS.
- **REQUIERE CAMBIOS:** algún FAIL causado por un defecto de la spec.
- **BLOQUEADO:** la auditoría no se pudo completar por falta de entorno, acceso o un prerrequisito externo (por ejemplo, la base no compila por un problema de configuración, o falta una dependencia aprobada). Un bloqueo no demuestra que haya que reescribir la spec: decí qué falta.

Severidad de cada hallazgo:

- **alta:** contradicción, violación de una regla o algo que impide ejecutar;
- **media:** ambigüedad que obliga a inventar;
- **baja:** redacción.

## 5. Informe

- **Encabezado.** Fecha, commit (`git rev-parse --short HEAD`) y hash de contenido de la spec:

  ```
  grep -v '^\*\*Estado:\*\*' docs/FASES/FASE1/$ARGUMENTS/spec.md | git hash-object --stdin
  ```

- **Veredicto.**
- **Checklist.** Tabla `# | Ítem | PASS/FAIL/BLOQUEO | Evidencia`.
- **Contradicciones.** Tabla `Elemento de la spec | Contradice a (fuente y ubicación) | Evidencia | Cómo se resuelve`. Si no hay, escribí "Ninguna".
- **Hallazgos.** Tabla `ID (A-NN) | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario?`.

## 6. Reporte

Informá el veredicto, las contradicciones, los hallazgos por severidad y el siguiente paso:

- **APROBABLE:** el usuario aprueba la spec, que pasa a `APROBADA`, y se sigue con plan mode.
- **REQUIERE CAMBIOS:** las correcciones técnicas se aplican a la spec; lo que requiere decisión se pasa por `/grill-me`; después se audita de nuevo.
- **BLOQUEADO:** se resuelve lo que falta y se vuelve a auditar, sin tocar la spec.
