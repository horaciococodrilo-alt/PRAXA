---
name: expand-microfase
description: Expande la ficha de una microfase de la ruta meta_first en una spec completa de la microfase, verificada contra el código actual. La guarda en docs/FASES/FASE1/[ID]/spec.md con estado BORRADOR y deja las preguntas abiertas, con recomendación, listas para grill-me. No escribe código. Solo cuando el usuario invoca /expand-microfase [ID].
argument-hint: "[ID de la microfase]"
disable-model-invocation: true
context: fork
---

# Expandir la microfase $ARGUMENTS

Tu único entregable es `docs/FASES/FASE1/$ARGUMENTS/spec.md`: la ficha de la ruta expandida en una spec **completa**, con la plantilla `docs/_templates/mf-spec.md` y en estado `BORRADOR`.

"Completa" quiere decir que no queda ninguna sección vacía ni genérica. Un implementador tiene que poder ejecutarla sin volver a la ficha a interpretarla. Lo único que queda sin resolver son las decisiones que le tocan al usuario, y esas van a "Preguntas abiertas", listas para el grill.

No escribís código, pruebas, migraciones ni ningún otro archivo, y no hacés commits.

Si `$ARGUMENTS` está vacío, no hagas nada y reportá que falta el ID.

## 1. Estado previo

- Si `docs/FASES/FASE1/$ARGUMENTS/spec.md` ya existe:
  - en estado `APROBADA`: frená y reportá. Una spec aprobada no se reexpande.
  - en cualquier otro estado: actualizala en el lugar, sin tocar "Decisiones de la microfase" ni "Auditorías".
- Si `docs/PROJECT_STATE.md` no muestra aprobados los gates de las dependencias, expandí igual, pero ponelo como bloqueo al principio de tu reporte.

## 2. Fuentes (leelas todas antes de escribir)

1. `AGENTS.md`: la jerarquía de fuentes y el contrato de ejecución.
2. `docs/PROJECT_STATE.md`.
3. `docs/FASES/FASE1/meta_first/plan.md`:
   - la ficha de `$ARGUMENTS` en la Parte I;
   - su sección en la Parte II: pasos, archivos y trampas. Si la sección agrupa varias microfases, leé las otras como contexto, pero expandí **solo** lo que corresponde a `$ARGUMENTS`. Si `$ARGUMENTS` es el ID del grupo (por ejemplo, `M05.1.2-M05.1.4`), expandí el grupo completo;
   - las secciones III.3 y III.9.
4. `docs/FASES/FASE1/meta_first/spec.md`: cada CA, CB, DEC, P, H y VR que citen la ficha o la sección, con su contexto.
5. `docs/HALLAZGOS.md`: todos los hallazgos asignados a esta microfase.
6. Las secciones de `docs/SECURITY.md` y `docs/ARCHITECTURE.md` que correspondan.
7. **El código real.** Todo archivo que el plan nombre o que la microfase vaya a tocar o reutilizar. Registrá firmas, tipos, nombres de tablas y funciones, los patrones que hay que seguir (por ejemplo, las migraciones `0001` y `0004` o los contratos de `reporting`), los proyectos de Vitest y los scripts de `package.json`.
8. La evidencia (`docs/FASES/FASE1/meta_first/sesiones/`) de las microfases de las que depende esta.

## 3. Cómo se completa cada sección

- **Alcance.** Solo lo que exige la ruta. No agregues nada.
- **Fuera de alcance.** Nunca vacío.
- **Archivos previstos.** Todo archivo que se va a crear o modificar, con el paso de la Parte II que lo autoriza. Un archivo que no esté autorizado va a "Preguntas abiertas" como **REQUIERE CAMBIO EN LA RUTA**.
- **Contexto verificado.** Cada afirmación lleva `archivo:línea`. Si el plan de la ruta supone algo que el código contradice, va a "Preguntas abiertas" con la evidencia.
- **Diseño concreto.**
  - Decidí vos lo que se deduce sin ambigüedad de la ruta y del código.
  - Decidí vos también entre alternativas razonables cuando la elección **no es material**: registrá la opción elegida y su motivo en esta misma sección.
  - Una decisión es **material**, y va a "Preguntas abiertas", cuando cambia algo de esto:
    - lo que ve o puede hacer el usuario;
    - la seguridad o la privacidad;
    - el alcance;
    - el costo o las dependencias externas;
    - la interpretación de la ruta.

    También es material cuando es difícil de revertir y la ruta no da un criterio para elegir.
- **Criterios heredados.** Todos los CA de la ficha, resumidos con fidelidad y sin reinterpretarlos.
- **Criterios operativos** (`$ARGUMENTS-C-NN`). Cada uno:
  - concreta un criterio heredado, un DEC o una trampa de la ruta;
  - es verificable;
  - no amplía el alcance.
- **Casos de prueba** (`$ARGUMENTS-T-NN`).
  - Al menos un caso por criterio, incluidos los negativos y los de borde.
  - El comando exacto de `package.json`.
  - Si el caso tiene que fallar sin la implementación (TDD), o por qué no aplica, como en documentación o configuración.
- **Verificación.** Los comandos de III.3 y CB-06.
- **Intervenciones y acciones reservadas.** Las de la ficha y las de III.2. Además, el push, el despliegue, el `db:push` al proyecto `app` y el `db:push:test` los ejecuta el usuario.
- **Trampas.** Las de la Parte II más las que salgan del código.
- **Supuestos e hipótesis.** Todo lo que no verificaste va marcado como HIPÓTESIS, con cómo y cuándo se verifica. Para datos de APIs externas (Meta, Supabase, Vercel, DeepInfra), usá la documentación oficial si tenés acceso web. Si no, dejalo como HIPÓTESIS.
- **Preguntas abiertas** (`$ARGUMENTS-Q-NN`). Solo las decisiones materiales que le tocan al usuario, cada una con opciones, recomendación y evidencia. Si algo se responde leyendo el código, respondelo vos y no lo preguntes.

## 4. Reglas

- La spec de la microfase refina la de la ruta y nunca la contradice. Si ejecutar la microfase exigiera contradecir la ruta, registralo como pregunta abierta marcada **REQUIERE CAMBIO EN LA RUTA**.
- Distinguí lo **existente** de lo **previsto**. Todo archivo, función, comando o variable que la spec cita como existente tiene que existir, y lo verificás. Lo que la microfase va a crear se declara como previsto, en "Archivos previstos" o en "Diseño concreto", y no se exige que exista.
- Nada de secretos, tokens, montos reales ni identificadores completos de cuentas.

## 5. Reporte final

- ruta y estado del archivo;
- cantidad de criterios heredados, de criterios operativos y de casos de prueba;
- lista corta de preguntas abiertas;
- bloqueos y contradicciones;
- siguiente paso: si hay preguntas abiertas, `/grill-me` sobre esta spec. Si no hay, `/spec-auditor $ARGUMENTS`.
