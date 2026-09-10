# Roadmap de PRAXA

Estados reales, sin optimismo:

- **Implementado** — el código existe y compila.
- **Verificado** — además se ejecutó y se comprobó que funciona, y acá dice cómo.
- **Pendiente** — no existe.
- **Sin verificar** — está escrito y no se ejecutó todavía; dice qué falta para hacerlo.

Última actualización: 2026-09-10.

---

## Fase 0 — Validar APIs y accesos del piloto

**Pendiente.** Decisión abierta, registrada al final de este documento.

## Fase 1 — Base técnica, autenticación y aislamiento por empresa

| Entrega | Estado |
|---|---|
| Proyecto Next.js 16 + TypeScript + Tailwind 4, con lockfile | **Verificado** — `npm run build` y `npm run typecheck` pasan |
| Migraciones SQL versionadas (5 archivos) | **Verificado** — aplicadas con `npm run db:push` al proyecto `tsxtgvwddlzfmifonlrk` el 2026-09-10; historial en `supabase_migrations.schema_migrations` |
| Esquemas `public` / `private` y funciones endurecidas | **Verificado** — `npm run test:policies` |
| Políticas RLS en las seis tablas | **Verificado** — `npm run test:policies` |
| Matriz de privilegios explícita (`0004_grants.sql`) | **Verificado** — `npm run test:policies` |
| Autenticación con `getClaims()` en servidor | **Implementado** |
| `proxy.ts` (Next 16) para refresco y redirección | **Implementado** |
| Alta de empresa idempotente | **Verificado** — pgTAP y, vía API con sesiones reales, reintento y 5 llamadas concurrentes |
| Guarda de credenciales privilegiadas | **Verificado** — `npm test` |
| Pruebas pgTAP de RLS y privilegios (5 archivos, 111 aserciones) | **Verificado** — 111/111 contra PostgreSQL remoto, sin contenedores, el 2026-09-10 |
| Pruebas de aislamiento vía Supabase JS | **Verificado** — 17/17 contra el proyecto desechable `wtnixbnlwxfwgjdimhrd` el 2026-09-10; la corrida no dejó residuos |

## Fase 2 — Landing, registro y setup

| Entrega | Estado |
|---|---|
| Landing que explica el producto y su estado real | **Verificado** — renderiza en el navegador |
| Degradación honesta sin configurar | **Verificado** — `/app` y `/onboarding` dicen qué variable falta |
| Registro con verificación de correo | **Sin verificar** — requiere abrir el enlace del correo, a mano |
| Inicio y cierre de sesión | **Parcial** — la app llega al Auth remoto y un login inválido se rechaza correctamente; un login exitoso, sin verificar |
| Recuperación de acceso | **Sin verificar** — requiere abrir el enlace del correo, a mano |
| Espacio privado de empresa | **Verificado** — dos usuarios reales, ninguno alcanza los datos del otro |
| Onboarding guardable y retomable | **Verificado** por base y por API (borrador incompleto, reanudación, activación); el recorrido en pantalla, sin verificar |
| "Todavía no tengo un objetivo definido" | **Verificado** en esquemas — `npm test`. El camino completo, sin verificar |
| Edición de contexto por clonado | **Verificado** por base y por API (clona, la vigente queda inmutable); en pantalla, sin verificar |
| Navegación Inicio / Objetivos y contexto / Integraciones / Reportes | **Implementado** |
| Estados vacíos honestos en Integraciones y Reportes | **Implementado** |
| Contrato del reporte, versionado y validado | **Verificado** — 23 pruebas en `npm test` |

**Dos capas verificadas, una pendiente.** Las reglas están probadas en PostgreSQL
(`npm run test:policies`, 111/111) y a través de la API con sesiones de usuarios reales
(`npm run test:app`, 17/17, sobre un proyecto desechable aparte). Lo que NO está probado
es el recorrido por la interfaz: registrarse, abrir el enlace del correo, completar el
onboarding en pantalla y retomarlo. Eso requiere una casilla real y queda manual.

## Fases 3 a 8

**Pendientes.** Nada de esto está implementado ni empezado:

3. Primer conector real.
4. Segundo conector y relaciones verificables.
5. Métricas y evidencia según objetivos.
6. Generación del diagnóstico y plan con IA.
7. Actualizaciones programadas con Trigger.dev.
8. Validación con una empresa real y preparación para producción.

**No hay ninguna llamada a un LLM en el código. No hay ningún conector.** La tabla
`reports` existe vacía y sin escritura habilitada, para que la pantalla de Reportes
muestre un estado vacío respaldado por una consulta real.

---

## Qué falta para verificar las fases 1 y 2

Hecho el 2026-09-10: proyecto creado, migraciones aplicadas y pgTAP en verde (111/111).

Hecho también: proyecto desechable creado y migrado, y `npm run test:app` en verde
(17/17), sin dejar residuos.

Queda una sola cosa:

1. **Recorrido manual del correo y de la interfaz** — registro, confirmación, login,
   onboarding en pantalla y recuperación, con una casilla real. Es lo único que la suite
   no puede cubrir, porque la casilla está fuera de su alcance.
   Opcional: `SUPABASE_TEST_EMAIL_FLOWS=true npm run test:app` comprueba que el proyecto
   exija confirmación y acepte el pedido de recuperación, pero tampoco abre el enlace.

El paso a paso está en el README.

Sobre Docker: **ya no es un requisito del proyecto**. La aplicación, las migraciones y las
pruebas de RLS funcionan contra un proyecto de Supabase en la nube. Lint, typecheck,
pruebas unitarias y build funcionan sin credenciales y sin red.

---

## Decisión pendiente que no bloquea nada

**Con qué sistema empieza el primer conector y con qué cuenta autorizada se va a probar.**

Hace falta definir:

- qué plataforma (Tiendanube, Shopify, WooCommerce, VTEX, Mercado Libre u otra);
- de qué empresa o cuenta de prueba, y quién autoriza el acceso;
- qué recursos se van a consultar y con qué alcance de solo lectura;
- qué política de retención y borrado aplica a esos datos (hoy no existe: no hace falta
  mientras no se extraiga nada, pero es requisito antes de conectar un sistema real).

Esta decisión **no bloquea** la base ni el onboarding, que ya están construidos.
