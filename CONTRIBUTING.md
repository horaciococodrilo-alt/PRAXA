# Contribuir a Praxa

## Flujo

1. Elegir un ticket que cumpla Definition of Ready.
2. Crear una rama corta desde `main`.
3. Leer `AGENTS.md`, `docs/plans/current.md` y las secciones relevantes de la especificación.
4. Presentar plan, archivos, dependencias, pruebas y riesgos.
5. Implementar el cambio mínimo.
6. Ejecutar checks locales.
7. Abrir PR y pedir revisión a una persona distinta.
8. Actualizar documentación y handoff.

## Convención de ramas

- `feat/vs-02-evidence-ingestion`
- `fix/vs-XX-descripcion`
- `docs/descripcion`
- `chore/descripcion`

## Commits

Usar commits pequeños y descriptivos. No mezclar un refactor grande con una feature. El agente no hace commit o push salvo instrucción explícita.

## Pull requests

Una PR debe incluir propósito, scope, no-scope, screenshots si corresponde, migraciones, tests ejecutados, riesgos y desviaciones.

No se integra con CI rojo, gates de seguridad fallando o secretos detectados.
