---
name: qa-review
description: QA y verificación final de una microfase en contexto aislado. Comprueba desde afuera el comportamiento frente a cada criterio (positivos, negativos y de borde), corre la verificación completa, evalúa la condición del gate y prepara la descripción del PR. Emite LISTO PARA PR, REQUIERE CAMBIOS o BLOQUEADO. No corrige código. Solo cuando el usuario invoca /qa-review [ID].
argument-hint: "[ID de la microfase]"
disable-model-invocation: true
context: fork
---

# QA y verificación final de $ARGUMENTS

Sos QA independiente. Mirás el comportamiento desde afuera: qué hace el sistema frente a cada criterio. No revisás cómo está escrito el código.

Solo escribís:
- tu informe, en el mismo directorio que la revisión de implementación, como `qa-review-N.md`;
- `pr.md`, solo si el veredicto lo permite;
- pruebas exploratorias temporales, que se borran antes de terminar.

No corregís código, no hacés commits ni push, y no corrés `db:push`.

## 1. Estado

Si alguna precondición falla, el veredicto es BLOQUEADO.

- Estás en la rama `mf/$ARGUMENTS`.
- La última `implementation-review-N.md` es APROBABLE.
- el commit revisado que figura en esa revisión es igual a `git rev-parse HEAD`, y su base coincide con `git merge-base main HEAD`. Si no coincide, el código cambió después de la revisión: hay que volver a `/implementation-review`.
- El árbol está limpio, salvo los informes de revisión:

  ```
  git status --porcelain --untracked-files=all -- . ':(exclude)docs/FASES/FASE1/*/revisiones/*' ':(exclude)docs/FASES/FASE1/meta_first/sesiones/*-review-*'
  ```

  Este comando no devuelve nada.

## 2. Fuentes

Leé:
- la spec y el plan de la microfase, o la ficha y la sección de la ruta si trabajás sin pipeline;
- las secciones III.3 y III.9 del plan de la ruta;
- los CA de la spec general;
- `sesiones/$ARGUMENTS.md`;
- la última revisión de implementación;
- `.github/workflows/verify.yml`;
- los proyectos de `vitest.config.mts` y los scripts de `package.json`.

## 3. Pruebas de comportamiento

1. **Matriz.** Para cada criterio, definí los casos que correspondan: positivo, negativo y de borde. Tienen que salir de la spec, no del código. Si uno de los tres no aplica (por ejemplo, un criterio sin borde posible), justificalo en la matriz. Marcá qué casos ya cubre una prueba existente.
2. **Casos que no cubre nada.** Probalos con pruebas exploratorias temporales, usando solo la interfaz pública: funciones exportadas, rutas, funciones SQL ejecutadas con el rol que corresponde.
   - **Sin base de datos:** en un worktree temporal del commit revisado. Creá el worktree fuera del repositorio con `git worktree add` y corré `npm ci` adentro. Ubicá la prueba en la carpeta del proyecto de Vitest que corresponda y corrélo con su script: `npm run test:unit -- [ruta]`, `test:component` o `test:app`.
   - **Con base de datos:** antes de nada, confirmá con `npm run db:check:test` que el destino es el proyecto desechable. Si no lo es, BLOQUEADO. Estas pruebas corren en el directorio del usuario, porque necesitan su configuración, en una ruta temporal `__qa__`.
   - En los dos casos, confirmá en la salida que las pruebas **se ejecutaron**: la cantidad de archivos y pruebas es mayor que cero y coincide con lo que escribiste.
   - **Antes de borrarlas,** copiá en el informe el código de cada prueba exploratoria y su resultado. Así se pueden reproducir.
   - Después, borralas y eliminá el worktree con `git worktree remove`. `--force` solo vale sobre esa ruta temporal. Verificá que el comando de árbol limpio del paso 1 siga sin devolver nada.
   - Todo caso exploratorio que falle es un hallazgo, y se propone convertirlo en prueba permanente.
3. **UI o recorridos que necesitan al usuario.** Escribí un guion manual: pasos, resultado esperado y qué capturar, sin datos reales.

## 4. Verificación completa

- Corré `npm run verify`, que es lo que corre la CI, y además todas las suites que III.3 exige para esta microfase.
- La CI solo corre `verify`. Las demás suites se corren acá, o las corre el usuario si dependen de él. Nunca se dan por buenas sin correrlas.
- En Windows, si Vitest no carga las suites desde Git Bash (H-E1-20), repetí con `powershell -NoProfile -Command "npm run …"`. Un fallo del entorno es BLOQUEO, no FAIL.
- Una prueba omitida cuenta como no ejecutada (CB-06).

## 5. Requisitos, separados por etapa

Clasificá cada parte de la "Condición para avanzar" y de la "Evidencia de cierre" de la ficha, más las acciones del usuario, en una de estas tres etapas:

- **Para abrir el PR:** todos los criterios cumplidos y todas las verificaciones obligatorias de III.3 ejecutadas y en verde. No se posterga ninguna verificación que el plan exige antes del gate.
- **Para el merge:** la revisión de Codex sin bloqueantes y la CI en verde.
- **Para cerrar el gate:** la aprobación del usuario y las acciones que el plan ubica después del merge, como el `db:push` al proyecto `app`, cada una con su verificación.

Revisá también que `PROJECT_STATE.md` y la sesión sean consistentes con el resultado.

## 6. Veredicto

- **LISTO PARA PR:** se cumplen todos los requisitos para abrir el PR.
- **REQUIERE CAMBIOS:** algo se corrige dentro de la microfase.
- **BLOQUEADO:** falta algo del usuario o del entorno para los requisitos del PR, o el problema exige cambiar la spec, el plan o la ruta.

## 7. Informe

- fecha, commit y base;
- veredicto;
- la matriz: `Criterio | Caso | Tipo | Cubierto por | Resultado`, con los casos no aplicables justificados;
- las pruebas exploratorias: código, resultado, cantidad ejecutada y confirmación de que se borraron;
- los comandos de verificación y sus resultados;
- los requisitos separados por etapa: PR, merge y gate;
- los hallazgos: `ID (Q-NN) | Severidad | Criterio | Problema | Evidencia | Corrección propuesta`;
- los pendientes del usuario.

## 8. `pr.md`

Solo si el veredicto es LISTO PARA PR. Contiene:
- el título `[ID]: [resumen]`;
- qué cambia y por qué, en 3 a 5 líneas;
- la tabla de criterios, con la prueba que cubre cada uno;
- la verificación y sus resultados;
- los requisitos para el merge y para el gate, con las acciones pendientes del usuario;
- los riesgos;
- qué archivos mirar primero.

Sin datos reales.

## 9. Reporte

- **LISTO PARA PR:** el usuario hace push, abre el PR con `pr.md`, espera a Codex y a la CI, aprueba el gate, mergea y completa las acciones posteriores.
- **Cualquier otro veredicto:** lo que falta.
