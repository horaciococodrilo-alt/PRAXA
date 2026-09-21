# Plan de ejecución — M04.1 y M04.2

## Resumen

- Trabajar sobre `C:\Users\Simon\OneDrive\Escritorio\PRAXA`; el `cwd` alternativo `C:\Users\Simon\PRAXA` no existe.
- M04.1 auditará el snapshot actual `9483eae`: 83 archivos (`src` 39, `tests` 13, `supabase` 20, `scripts` 7, `docs` 3 y `proxy.ts`).
- M04.2 fijará Node `24.18.1`, configurará CI, verificará una instalación limpia y documentará la autenticación.
- No se modificarán código de aplicación, SQL, dependencias, scripts de npm ni `package-lock.json`.
- Entregables versionados: `docs/auditoria-m04.md`, `docs/baseline-m04.md`, `.nvmrc`, `.github/workflows/verify.yml` y únicamente `engines.node` en `package.json`.

## Ejecución de M04.1

| Paso | Responsable | Acción y archivos tocados | Verificación de cierre |
|---:|---|---|---|
| 1 | Asistente | Comprobar que el roadmap v2 sea legible, que `HEAD` siga en `9483eae` y que `git status --short` esté limpio. No toca archivos. | Detenerse ante cambios inesperados, roadmap ilegible o un `HEAD` diferente sin explicación. |
| 2 | Asistente | Congelar el inventario mediante `git ls-files` para `src/`, `tests/`, `supabase/`, `scripts/`, `proxy.ts` y `docs/`. No toca archivos. | El manifiesto contiene exactamente los 83 archivos observados; el documento nuevo de auditoría queda fuera por ser el entregable posterior al snapshot. |
| 3 | Asistente | Leer completamente `AGENTS.md`, `CLAUDE.md`, `README.md`, `.env.example` y los requisitos aplicables del roadmap v2. Preparar el mapa de citas por microfase. No toca archivos. | Cada requisito usado queda asociado a un ID concreto del roadmap; `docs/ROADMAP.md` se trata únicamente como evidencia histórica. |
| 4 | Asistente | Auditar `src/`, `proxy.ts` y las migraciones para responder autenticación, credenciales, `company_id`, tablas sin tenant, políticas, grants y `FORCE RLS`. No se ejecuta ninguna operación contra Supabase. | Evidencia por ruta y línea para las preguntas de autenticación y aislamiento; ningún comportamiento se considera probado sólo porque exista código. |
| 5 | Asistente | Auditar onboarding, contratos preliminares de reportes, pruebas, scripts, documentación y uso real de dependencias. Usar búsquedas de imports/configuración y `npm ls --depth=0`, sin instalar herramientas. | Quedan respondidos onboarding descartado, compatibilidad con K16, comportamiento congelado por pruebas, función de cada script, propósito de `proxy.ts`, destino recomendado de `docs/ROADMAP.md` y dependencias aparentemente sin uso. |
| 6 | Asistente | Crear `docs/auditoria-m04.md`. La tabla tendrá una fila por cada archivo del snapshot y las columnas `Módulo`, `Veredicto`, `Razón (citando el v2)` y `Microfase afectada`. | Las 83 filas usan sólo `conservar`, `adaptar` o `retirar`; todo `adaptar/retirar` nombra una microfase. Para `conservar`, la cuarta columna usa `—`. |
| 7 | Asistente | Completar en el documento: respuestas a las nueve preguntas obligatorias; hallazgos que cambian microfases; pendientes de M03; contradicciones; y reconciliación de cobertura. | Comparación bidireccional entre tabla y manifiesto: 83 rutas únicas, ninguna faltante o extra, cuatro campos completos, citas concretas y ningún “revisar después” sin ID. |
| 8 | Usuario | Revisar G-AUDIT y aprobar o rechazar los veredictos de `retirar`. No se elimina ni adapta nada. | G-AUDIT queda aprobado. Una contradicción central detiene M04.2 hasta que el usuario la resuelva. |

## Ejecución de M04.2

| Paso | Responsable | Acción y archivos tocados | Verificación de cierre |
|---:|---|---|---|
| 1 | Asistente | Confirmar nuevamente `node -v = v24.18.1`. Agregar `"engines": {"node": "24.18.1"}` a `package.json` y crear `.nvmrc` con `24.18.1`. | `.nvmrc` y `engines.node` coinciden; el bloque `scripts` conserva exactamente `typegen` y el orden actual de `verify`; `package-lock.json` no cambia. |
| 2 | Asistente | Crear `.github/workflows/verify.yml`: eventos `push` y `pull_request`, permisos `contents: read`, `windows-latest`, shell `cmd`, Node desde `.nvmrc`, caché npm, `npm ci` y `npm run verify`. Usar `actions/checkout@v7` y `actions/setup-node@v7`, las versiones mayores oficiales actuales. [Checkout](https://github.com/actions/checkout/releases) y [setup-node](https://github.com/actions/setup-node). | El workflow no contiene secretos ni comandos de base de datos. La ejecución remota queda expresamente pendiente hasta un push futuro. |
| 3 | Asistente | Crear `docs/baseline-m04.md` con versiones, tabla T-M04.2-01–06, seis filas de autenticación, hallazgos y microfase asignada. Inicialmente cada prueba figura `PENDING`. | El documento no contiene URLs privadas completas, claves, tokens, contraseñas ni contenido de `.env.local`. |
| 4 | Usuario | Crear el proyecto Supabase en São Paulo; configurar Site URL `http://localhost:3000`, redirect `http://localhost:3000/**` y confirmación de email; cargar las tres variables de aplicación en `.env.local`. | Confirmación sí/no de la configuración. Una comprobación redactada muestra que las tres variables tienen valor, sin imprimirlos. Las cinco variables de DB/pruebas permanecen intactas y `.env.local` sigue ignorado. |
| 5 | Asistente | Ejecutar `npm run verify` en el checkout principal. Actualizar T-M04.2-01 en `docs/baseline-m04.md` con fecha, comando y resultado real. | Exit code 0. Si falla, diagnosticar primero; no editar archivos fuera del plan ni ampliar `package.json`. Un fallo preexistente que requiera código obliga a detener y revisar el plan. |
| 6 | Mixto | Iniciar `npm run dev`. El usuario ejecuta: registro, verificación del correo, login, refresh con sesión persistente, logout y segundo login. El asistente registra cada resultado en `docs/baseline-m04.md`. | Las seis filas tienen `PASS` o `FAIL` con evidencia. Un `FAIL` no bloquea M04.2, pero debe asignarse a M06.2, M08.1/M08.3 o registrarse como hueco del roadmap si ninguna microfase lo cubre. |
| 7 | Asistente | Cerrar T-M04.2-03–06 y revisar el diff completo. | `engines` y `.nvmrc` coinciden; `typegen` precede a `typecheck`; `.env.local` no está versionado; `package-lock.json` y scripts permanecen intactos; sólo aparecen los cinco archivos autorizados. |
| 8 | Asistente | Crear un commit candidato único con mensaje `chore: establish M04 baseline`. | El commit incluye los dos documentos, `.nvmrc`, el workflow y el cambio exclusivo de `engines.node`. |
| 9 | Asistente | Clonar el commit candidato en `%TEMP%\praxa-m04-clean-<sha>`, fuera de OneDrive; ejecutar `npm ci`; copiar `.env.local` sin mostrarlo; ejecutar `npm run verify`. Eliminar después únicamente la copia temporal de `.env.local`. | T-M04.2-02 pasa con exit code 0. Ante EPERM no se borra `node_modules`, lockfiles ni archivos del usuario: se registra el diagnóstico y se detiene. |
| 10 | Asistente | Registrar T-M04.2-02 como `PASS` en `docs/baseline-m04.md` y enmendar el commit candidato, manteniendo un solo commit final. | El cambio posterior al candidato se limita al documento de evidencia. |
| 11 | Asistente | En el clon limpio, obtener el commit enmendado, repetir `npm ci` y `npm run verify`, y volver a borrar sólo el `.env.local` temporal. Revisar `git status --short` en el repo principal. | El commit final exacto pasa la instalación y verificación limpia; el checkout principal queda limpio. G-BASELINE habilita M05.1. |

## Interfaces y archivos

- No cambian APIs públicas, tipos TypeScript, contratos de aplicación, tablas, políticas ni migraciones.
- `package.json` incorpora únicamente `engines.node = "24.18.1"`.
- `.nvmrc` pasa a ser la fuente de versión para desarrollo y CI.
- El workflow automatiza la misma ruta local: `npm ci` → `npm run verify`.
- `docs/auditoria-m04.md` conserva evidencia y recomendaciones; no ejecuta ningún veredicto.
- `docs/baseline-m04.md` conserva resultados reales, incluidos fallos manuales no bloqueantes.

## Pruebas y condiciones

- `T-M04.2-01`: `npm run verify` termina con código 0.
- `T-M04.2-02`: clon limpio fuera de OneDrive, `npm ci` y `npm run verify`.
- `T-M04.2-03`: Node, `engines.node` y `.nvmrc` coinciden exactamente.
- `T-M04.2-04`: `verify` mantiene `typegen` antes de `typecheck`.
- `T-M04.2-05`: `.env.local` está ignorado y ausente de `git ls-files`.
- `T-M04.2-06`: los seis pasos manuales están documentados individualmente.
- No se ejecutarán `db:push`, `db:check`, `test:policies` ni `test:app`.
- No se instalarán dependencias ni se modificará `package-lock.json`.
- La corrida remota de GitHub Actions quedará `PENDING`, por decisión del usuario; no se hará push ni se afirmará CI remoto verde.

## Supuestos y datos pendientes

- No falta información adicional del repositorio para comenzar.
- Del usuario sólo se necesitarán confirmaciones booleanas sobre Supabase y los resultados observados en el navegador; nunca secretos.
- Si el snapshot, el árbol Git o Node cambian antes de ejecutar, se detendrá el primer paso para reconciliar el plan.
- Cualquier contradicción central detectada por la auditoría, dependencia nueva necesaria o edición adicional de `package.json` requiere intervención antes de continuar.
