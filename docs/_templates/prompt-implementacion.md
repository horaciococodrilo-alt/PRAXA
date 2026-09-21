# Prompt de implementación — [ID] [Título]

Vas a implementar la microfase [ID] de PRAXA. Nivel de riesgo: [A | B | C].
Branch: `[nombre-branch]`. Herramienta/modelo: [Claude Code | Codex] — [modelo] — effort [bajo | medio | alto].

## 1. Lectura obligatoria, en este orden (no escribas nada antes de terminar)
1. `AGENTS.md` completo (reglas, non-negotiables, condiciones de parada).
2. `docs/PROJECT_STATE.md`.
3. `docs/ROADMAP.md`: sección "Contrato de ejecución para asistentes de IA" y la sección de [ID].
4. `docs/microfases/[ID]/spec.md` (versión [vX]).
5. `docs/microfases/[ID]/plan.md`.
6. `docs/microfases/[ID]/gate.md`.
7. `docs/SECURITY.md`, secciones: [ej. "Invariantes que se aplican en la base", "Autorización en el servidor", "Credenciales"].
8. `docs/ARCHITECTURE.md`, secciones: [ej. "Dos esquemas: public y private", "Las RPC del producto son SECURITY INVOKER"].
9. Código existente relevante: [rutas, ej. `src/modules/reporting/contract/`, `supabase/migrations/0010_*.sql`].
10. Si tocás APIs de Next: la guía correspondiente en `node_modules/next/dist/docs/`.

Al terminar la lectura, respondé SOLO con:
- resumen de 5 líneas de qué vas a construir;
- los CA-xx y CB-xx que vas a cubrir;
- cualquier contradicción o duda encontrada.
Esperá mi OK antes de seguir.

## 2. Precondiciones (si alguna falla, frená y reportá)
- `gate.md` está en PASS.
- La spec está en estado APROBADA y su versión coincide con la que figura en `plan.md`.
- Las dependencias de [ID] están cerradas en `PROJECT_STATE.md`.
- Estás en el branch `[nombre-branch]`. `git status` no tiene cambios ajenos; si los tiene, preservalos y avisame.

## 3. Ejecución
1. Primero escribí los tests del "Plan de tests" del plan. Corrélos y mostrame que fallan por la razón esperada (rojo), no por errores de setup.
2. Seguí los pasos del plan en orden. Al terminar cada paso, corré los tests de ese paso.
3. Solo tocás archivos de la tabla "Archivos a crear/modificar". Si necesitás otro, frená y proponé el desvío; no lo hagas por tu cuenta.
4. No amplíes el alcance. Si ves algo que habría que hacer, registralo como hallazgo en `docs/HALLAZGOS.md` con ID estable y seguí.
5. Llevá el log en `docs/microfases/[ID]/sesion.md`: pasos hechos, comandos corridos con su resultado real, decisiones y desvíos.

## 4. Permisos de esta sesión
- Commits: [permitidos en `[nombre-branch]`, uno por paso del plan | no permitidos].
- Push / PR / deploy: no.
- Comandos adicionales a los de `.claude/settings.json`: [ninguno | lista].
- Base de datos: [solo target de test vía `npm run db:check:test` | no aplica].

## 5. Verificación final (antes de decir que terminaste)
- Corré: `npm run verify` [+ `npm run test:policies` | `npm run test:app`, según el plan].
- Completá una tabla `CA/CB | Test | Resultado real` que cubra todos los CA-xx y CB-xx de la spec.
- Revisá el diff: sin secretos, sin montos ni IDs reales, sin archivos fuera del plan.

## 6. Entrega
Reportá con este formato:
- Estado: COMPLETO | BLOQUEADO (motivo).
- Archivos modificados (lista).
- Tabla CA/CB → test → resultado.
- Output resumido de la verificación.
- Desvíos del plan y hallazgos nuevos (con ID).
- Pendientes.

No marques la microfase como PASS ni actualices `ROADMAP.md` o `PROJECT_STATE.md`: el cierre lo hace la verificación cruzada.