# PR #20 — revisión de comentarios de chatgpt-codex-connector

**Fecha:** 2026-10-11. **Rama:** `mf/M28.2a`. **HEAD inicial:** `a728dd86713a3dddc771e549985507f5830706d8`. Árbol limpio al comenzar.

La revisión del conector contiene cinco hallazgos inline, todos plausibles. Se corrigieron localmente `4243030565` (enlace de contraseña), `4243030569` (borrado de avatars en CA-67), `4243030577` (salida de sesión) y `4243030584` (límites de segmentos). `4243030574` (cuota por usuario) queda pendiente: exige una migración nueva y enmienda de la numeración reservada en la ruta. Los cinco tienen IDs `H-E1-109` a `H-E1-113` en `docs/HALLAZGOS.md`.

La ampliación de CA-67 y del plan de M28.3a es una **enmienda pendiente de auditoría y aprobación visible**. No cambia por sí sola el estado de `G-DOCS`, `G-ENTORNO` ni la siguiente microfase. La prueba remota usa exclusivamente el proyecto desechable validado por `tests/app/helpers.ts`; no se ejecutó contra `app`.

## Verificación

| Comando | Resultado |
|---|---|
| `npx vitest run --project unit tests/unit/password-recovery.test.ts --no-file-parallelism --maxWorkers 1 --reporter verbose` | exit 0; 3/3 |
| `npx vitest run --project unit tests/unit/proxy-session-cookies.test.ts --no-file-parallelism --maxWorkers 1 --reporter verbose` | exit 0; 6/6 |
| `npx vitest run --project component tests/component/app-pantallas.test.tsx --no-file-parallelism --maxWorkers 1 --reporter dot` | exit 0; 42/42 |
| `npx vitest run --project app tests/app/closure-storage.test.ts --no-file-parallelism --maxWorkers 1 --reporter verbose` | exit 0; 1/1 contra proyecto desechable; subió y borró dos archivos sintéticos, uno anidado |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0; incluye Proxy y `/auth/signout` |
| `git diff --check` | exit 0; advertencias informativas de conversión LF/CRLF |
| `git diff --exit-code HEAD -- supabase/migrations/` | exit 0; ninguna migración existente modificada |

**Limitación:** `npm test -- --no-file-parallelism --maxWorkers 1` no terminó: tras ejecutar sin progreso visible se interrumpió manualmente (exit 1). La primera ejecución dirigida dentro del sandbox tampoco arrancó por `spawn EPERM` de Vite; las pruebas indicadas arriba se repitieron fuera de ese bloqueo y pasaron. La suite completa no se declara aprobada.
