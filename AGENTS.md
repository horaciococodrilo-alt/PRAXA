<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Reglas del proyecto PRAXA

## Jerarquía de fuentes (si hay contradicción, gana la de arriba y se reporta)
1. `docs/ROADMAP.md` (contrato de ejecución y la sección de la microfase)
2. `docs/microfases/<ID>/spec.md` (versión APROBADA)
3. `docs/microfases/<ID>/plan.md`
4. `docs/SECURITY.md`
5. `docs/ARCHITECTURE.md`
6. Código existente

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
- Contradicción entre roadmap, spec, plan o código.
- Hace falta tocar un archivo que no está en el plan.
- Hace falta una intervención del usuario (cuentas, secretos, decisiones de negocio).
- Una dependencia de la microfase no está cerrada en `docs/PROJECT_STATE.md`.
- Dos iteraciones de corrección sin converger.
