<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Reglas del proyecto PRAXA

## Jerarquía de fuentes (si hay contradicción, gana la de arriba y se reporta)
1. `docs/FASES/FASE1/meta_first/plan.md`, Parte I (roadmap vigente de la ruta `meta_first`: Enmienda 1 y ficha de la microfase) y el contrato de ejecución de este archivo
2. `docs/FASES/FASE1/<MF>/spec.md` (versión APROBADA; para la ruta, `docs/FASES/FASE1/meta_first/spec.md`)
3. `docs/FASES/FASE1/<MF>/plan.md` (para la ruta, Partes II y III de `docs/FASES/FASE1/meta_first/plan.md`)
4. `docs/SECURITY.md`
5. `docs/ARCHITECTURE.md`
6. Código existente

`docs/ROADMAP.md` (v2.3) está archivado fuera del repositorio por decisión del usuario y no es fuente vigente. Si vuelve al árbol, primero hay que redactar los datos de la cuenta piloto (ver `docs/HALLAZGOS.md`).

## Contrato de ejecución para asistentes de IA

### Roles
- **Asistente de IA:** inspecciona el estado real del repositorio, implementa únicamente la microfase solicitada, ejecuta las verificaciones indicadas, registra evidencia reproducible y comunica cualquier bloqueo o contradicción.
- **Usuario:** realiza exclusivamente las acciones indicadas en `Intervención requerida del usuario`, en especial las relacionadas con cuentas externas, secretos, decisiones de negocio y aprobaciones visibles. El asistente nunca debe pedir que se peguen secretos en el chat. El usuario no implementa código.

### Protocolo obligatorio
1. Leer las instrucciones vigentes del repositorio antes de actuar, incluidos este archivo y las referencias que exija para los archivos que vayan a modificarse.
2. Ejecutar una sola microfase por vez y sólo cuando el usuario la solicite. No iniciar automáticamente la microfase siguiente.
3. Antes de modificar archivos, comprobar el estado de Git, las dependencias de la microfase y su condición de entrada. Preservar cambios preexistentes del usuario.
4. Tratar `Implementación requerida` y `Procedimiento del asistente` como alcance obligatorio. No ampliar ni reducir ese alcance sin una decisión explícita del usuario.
5. Verificar el resultado con `Pruebas` y `Criterio de aceptación`. La mera existencia de código o configuración no constituye evidencia de funcionamiento.
6. Registrar la evidencia indicada en `Evidencia de cierre`, con comandos, resultados y limitaciones pertinentes, sin exponer claves, tokens, contraseñas ni valores de archivos de entorno.
7. Detenerse cuando sea necesaria una acción de `Intervención requerida del usuario`; explicar exactamente qué debe hacer el usuario sin ejecutar esa acción en su nombre, salvo autorización expresa y segura.
8. No declarar una microfase cerrada ni habilitar sus sucesoras hasta cumplir `Condición para avanzar`. Un fallo debe quedar diagnosticado y asignado a una microfase concreta.
9. Registrar cada hallazgo nuevo con un ID estable, impacto, evidencia y microfase asignada. No convertir un hallazgo en ampliación silenciosa del alcance.
10. Al terminar, informar el estado del gate, los archivos modificados, las verificaciones ejecutadas y cualquier pendiente. No hacer commit, push, despliegue ni otra publicación salvo que el usuario lo solicite.

### Reglas de las microfases
- Cada microfase es independiente y revisable, de **hasta 8 horas de implementación**. Es un límite de tamaño del corte, no una estimación ni una asignación de tiempo al usuario.
- Todas usan la misma plantilla operativa: ID, objetivo, implementación requerida, procedimiento del asistente, evidencia de cierre, aceptación, pruebas, condición para avanzar, dependencias y eventual intervención del usuario.
- Los IDs con punto, por ejemplo `M07.2`, son subdivisiones del ID estable original.

## Non-negotiables
- El LLM nunca produce números, estados ni políticas autoritativas.
- Toda escritura es idempotente, reversible y verificable.
- El MVP es read-only sobre sistemas externos (Tiendanube, Meta, GA4).
- Aislamiento multiempresa: el tenant se resuelve en el servidor por membresía; nunca se acepta un `company_id` del cliente.
- Sin secretos, tokens, montos reales ni IDs de cuentas en código, logs, fixtures, docs ni mensajes.

## Seguridad operativa
- No leer `.env.local` ni pedir secretos en el chat.
- No correr `db:push` ni nada contra producción. Las pruebas nunca corren contra producción (ver `docs/SECURITY.md`).
- No modificar migraciones existentes en `supabase/migrations/`; los cambios de esquema van en una migración nueva con el siguiente número.
- No usar `service_role` fuera de lo que permite `docs/SECURITY.md`.

## Condiciones de parada (frenar y reportar, no improvisar)
- Contradicción entre el roadmap vigente (Parte I del plan de la ruta), spec, plan o código.
- Hace falta tocar un archivo que no está en el plan.
- Hace falta una intervención del usuario (cuentas, secretos, decisiones de negocio).
- Una dependencia de la microfase no está cerrada en `docs/PROJECT_STATE.md`.
- Dos iteraciones de corrección sin converger.
