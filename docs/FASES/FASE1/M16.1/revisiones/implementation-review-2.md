# M16.1 — Revisión de implementación 2

- Fecha: 2026-10-14.
- Rama y commit: `mf/M16.1`, `72ab9227fc6a22d498ed85ad4aac46be18026afd`.
- Base solicitada: `609ea2989403682bc6772f5c2401213f0474b37c` (`origin/main`).
- Hash del diff sin informes de revisión: `42c227b74025add40d316ac77bb6c394a8bf60cd` (`git diff 609ea298 -- . ':(exclude)docs/FASES/FASE1/*/revisiones/*' ':(exclude)docs/FASES/FASE1/meta_first/sesiones/*-review-*' | git hash-object --stdin`). No hay archivos nuevos fuera de `revisiones/`.
- Estado inicial: tres archivos sin seguimiento, `implementation-review-1.md`, `qa-review-1.md` y `pr.md`. Se preservaron.

## Veredicto

**APROBABLE para la revisión de código.** No encontré defectos accionables introducidos por el diff. `G-OAUTH` sigue pendiente de la aprobación y los pasos manuales del usuario; esta revisión no lo cierra.

## Checklist

| # | Ítem | Estado | Evidencia |
|---|---|---|---|
| 1 | Alcance | PASS | Los archivos de implementación, pruebas, configuración y documentación corresponden al plan de M16.1 y a la Enmienda aprobada de II.9. El diff no toca migraciones ni pgTAP. `Conectar` sigue deshabilitado. |
| 2 | Criterios | PASS | Aserciones de T-01 a T-43 leídas y contrastadas con C-01 a C-31 y CA-28 a CA-34; matriz resumida abajo. |
| 3 | Sensibilidad de pruebas | PASS | Dos roturas que sí violan los criterios fueron detectadas por T-17 y T-42. Ambas fuentes quedaron idénticas tras restaurar (SHA-256). Una primera mutación de `includes(ads_read)` no violó C-17 porque la validación del esquema rechazó igualmente la falta del permiso; no se cuenta como rotura del criterio. |
| 4 | Reejecución | PASS | `db:check:test`: destino desechable verificado. `verify`: exit 0, 23 archivos y 510 pruebas, build correcto. `test:app`: exit 0, 8 archivos, 48 pruebas ejecutadas y 7 omitidas ajenas a M16.1; `meta-oauth.test.ts` ejecutó sus 10 casos. |
| 5 | Seguridad y reglas | PASS | K01 se construye en el servidor; el cliente no aporta empresa. Errores y log propios tienen campos cerrados. Sin `service_role`, migraciones nuevas, lecturas directas de `.env.local` ni datos reales en el diff. Los módulos que leen secretos usan `server-only`. |
| 6 | Calidad funcional | PASS | Inicio, callback, canje, inspección, cancelación, replay y `reauth` coinciden con la spec. No hay `TODO`, `FIXME` ni `any` nuevos que oculten alcance pendiente. |
| 7 | Evidencia | PASS | La sesión registra resultados y omisiones por archivo; `H-E1-115` a `H-E1-117` tienen ID y asignación. `PROJECT_STATE.md` no marca aprobado `G-OAUTH`. |
| 8 | Contradicciones | PASS | No se encontró contradicción entre el código, la spec y el plan aprobados, la Parte I de la ruta y `AGENTS.md`. |

## Matriz de criterios

Las pruebas unitarias citadas son de `tests/unit/meta-oauth.test.ts`; T-23 es de componente y T-25 a T-35 son de `tests/app/meta-oauth.test.ts`. Todas las aserciones citadas comprueban el comportamiento indicado y pasaron.

| Criterio | Prueba y aserción que lo verifica | Resultado |
|---|---|---|
| C-01 | T-01: versión única y URLs versionadas | PASS |
| C-02 | T-02: parámetros exactos del diálogo, sin `scope` | PASS |
| C-03 | T-03: configuración y URI válidas, errores sin valores | PASS |
| C-04 | T-04, T-41: secretos solo en módulo de servidor | PASS |
| C-05 | T-05: tabla de códigos y subcódigos Graph | PASS |
| C-06 | T-06: red, timeout, JSON ilegible y `no-store` | PASS |
| C-07 | T-07: mensajes del proveedor y secretos no llegan al error | PASS |
| C-08 | T-08, T-09, T-25, T-32: `initial` y `reauth` según conexión viva | PASS |
| C-09 | T-08: `state`, nonce, hashes y atributos de cookie | PASS |
| C-10 | T-08: retorno permitido y vencimiento del intento | PASS |
| C-11 | T-11: `Origin`, sesión, empresa, configuración y método | PASS |
| C-12 | T-12, T-15, T-35: redirección limpia y cookie borrada | PASS |
| C-13 | T-12, T-13, T-26 a T-31: rechazo uniforme, actor, empresa y nonce | PASS |
| C-14 | T-14: cancelación con y sin intento consumible | PASS |
| C-15 | T-16: consumo antes de canje y creación de pendiente | PASS |
| C-16 | T-07, T-19, T-28: canje único y secreto limitado a Graph | PASS |
| C-17 | T-17, T-34: token inválido o sin permiso no crea conexión | PASS |
| C-18 | T-18, T-25: tipo, app, permisos y expiración real o ausente | PASS |
| C-19 | T-25: pendiente y credencial cifrada legible por el rol previsto | PASS |
| C-20 | T-28: replay no crea segunda conexión ni segundo canje | PASS |
| C-21 | T-21, T-33: generación vieja y `reauth` sin canje | PASS |
| C-22 | T-10, T-32: pendiente vigente no crea otro intento | PASS |
| C-23 | T-15: respuesta y logs propios sin datos sensibles | PASS |
| C-24 | T-20: reintento idempotente con la misma operación | PASS |
| C-25 | T-22, T-23: resultado de lista cerrada y aviso tras sesión | PASS |
| C-26 | T-24 y guarda `beforeAll`: falla sin destino válido, sin `skip` | PASS |
| C-27 | T-36 y búsqueda del diff: guardas de secretos vigentes | PASS |
| C-28 | T-37, T-43: `verify` y `test:app` terminan correctamente | PASS |
| C-29 | T-39, revisión del diff documental y de configuración | PASS |
| C-30 | T-41 y sesión: `META_*` solo en servidor; sin autorización real | PASS |
| C-31 | T-40, T-42: secretos fuera de URLs de salida; barreras antes de `fetch` | PASS |
| CB-02 a CB-05 | Diff, sesión y ausencia de cambios de base | PASS |

## Roturas controladas

| Criterio | Cambio temporal | Prueba que falló | Restauración |
|---|---|---|---|
| C-17 | `tokens.ts`: omitir `data.is_valid === true` | T-17, `is_valid falso`: recibió `pendiente` en vez de `token_no_valido` | SHA-256 idéntico |
| C-31 | `client.ts`: omitir el rechazo de nombre `access_token` en una URL manual | T-42, `getJson` aceptó `?access_token=x` | SHA-256 idéntico |

## Comandos y límites

| Comando | Resultado |
|---|---|
| `git diff 609ea2989403682bc6772f5c2401213f0474b37c` y `git diff --check` | 32 archivos; sin errores de whitespace |
| `npm run db:check:test` | Exit 0; destino de pruebas desechable verificado, sin copiar identificadores al informe |
| `npm run verify` | Primer intento: Vitest no arrancó por `spawn EPERM` del sandbox; reejecución con permisos de ejecución ampliados: exit 0, 510/510 pruebas y build |
| `npm run test:app` | Exit 0; 48 ejecutadas, 7 omitidas opt-in ajenas a M16.1 |
| `npm run test:unit -- tests/unit/meta-oauth.test.ts` tras cada rotura | Exit 1 esperado; 1 caso falló y 152 pasaron en cada corrida |

No se hizo commit, push, despliegue ni autorización real. No se ejecutó `db:push`.

## Hallazgos y pendientes

Ningún hallazgo accionable nuevo. La autorización real, la recuperación de fallos posteriores a la autorización y VR-01 están asignadas a M16.2 en `HALLAZGOS.md`. Para avanzar siguen pendientes las acciones del usuario y la aprobación visible de `G-OAUTH` descritas en el plan y la sesión de M16.1.
