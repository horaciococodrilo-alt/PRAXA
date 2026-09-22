# Spec — Ruta `meta_first`: conector de Meta Ads y chat sobre sus datos

## Estado

`BORRADOR` — pendiente de aprobación. Cubre los cortes `M05.1.2` a `M25a` de la Enmienda 1 de [ROADMAP.md](../../../ROADMAP.md). El acta `M03a` se especifica aparte en [acta-meta.md](../M03a/acta-meta.md) y es condición de entrada de todo lo que sigue.

## Qué se construye

Una empresa que usa PRAXA autoriza a la aplicación a leer su cuenta publicitaria de Meta, elige cuál conectar, sincroniza el gasto e impresiones diarios, y después le pregunta a un chat sobre esos datos. El chat responde únicamente con cifras que salieron de una consulta tipada a la base, nunca con cifras producidas por el modelo.

## Qué NO se construye

- Ninguna escritura sobre Meta. El permiso solicitado es `ads_read` y nada más.
- Ningún worker, cola ni recolección programada. Ver decisión D2 en [revision-codigo.md](revision-codigo.md).
- Ninguna conexión a Tiendanube ni a GA4.
- Ningún reporte publicado. Esta ruta no produce `reliability` ni `catalog`.
- Ninguna métrica derivada, ratio, comparación contra benchmark ni recomendación de presupuesto.

## Decisión de entrada

**D1 debe estar aprobada antes de `M06.1a`.** La spec asume la Propuesta A: credenciales en el esquema `private`, acceso por funciones `SECURITY DEFINER`, cifrado en Node con clave de entorno. Si se elige la Propuesta B, cambian `M06.1a`, `M06.2a`, `M06.3a` y la prueba `no-privileged-credentials`, y esta spec vuelve a borrador.

## Configuración de la Graph API

Versión fijada: **v26.0**, vigente desde el 2026-07-29. La versión se declara en un único lugar del código y nunca se interpola suelta en una URL. Al implementar, verificar que siga siendo la vigente; si cambió, actualizar la constante y esta línea.

Variables de entorno nuevas, todas del servidor, ninguna `NEXT_PUBLIC_`:

| Variable | Contenido |
|---|---|
| `META_APP_ID` | Identificador público de la app de Meta |
| `META_APP_SECRET` | Secreto de la app. Nunca sale del servidor |
| `META_REDIRECT_URI` | URI de callback, debe coincidir exactamente con la registrada en Meta |
| `PRAXA_CREDENTIAL_KEY` | Clave de cifrado de credenciales, 32 bytes en base64 |
| `PRAXA_CREDENTIAL_KEY_VERSION` | Entero. Permite rotar sin perder lo cifrado con la clave anterior |

Se agregan a `.env.example` con valores vacíos y una línea que explique qué son. Nunca con valores reales.

---

## M05.1.2 — Contrato K02 `OAuthAttempt`

Un intento de autorización: se crea al iniciar, se consume una sola vez al volver del callback.

- **CA-01** El contrato nunca admite el `state` en claro. Se persiste sólo su hash.
- **CA-02** Un intento tiene expiración explícita. Un intento vencido no es consumible.
- **CA-03** El consumo es de una sola vez. Un segundo consumo del mismo intento es un error tipado, no un `null` silencioso.
- **CA-04** El `redirect_uri` y la ruta de retorno pertenecen a una allowlist. Una URL externa se rechaza en la validación, antes de tocar la base.
- **CA-05** El proveedor es un enum cerrado. En esta ruta su único valor es `meta`.

## M05.1.3 — Contrato K03 `IntegrationConnection`

Una conexión viva con un sistema externo, sin credenciales dentro.

- **CA-06** El contrato no admite ningún campo que pueda contener un token. Una prueba inyecta un token en cada campo de texto y verifica que el fixture no valide o que el campo no exista.
- **CA-07** Los estados y sus transiciones son explícitos: `pending`, `active`, `needs_reauth`, `revoked`, `disconnected`. Una transición no declarada se rechaza.
- **CA-08** La conexión guarda moneda y zona horaria de la cuenta externa, ambas validadas contra formatos conocidos.
- **CA-09** El último error queda redactado: sin tokens, sin URLs con parámetros sensibles.

## M05.1.4 — Contrato K04 `SecretCredential`

La credencial cifrada.

- **CA-10** El contrato se define sobre texto cifrado. No existe ningún campo de texto plano para el token.
- **CA-11** Exige vector de inicialización, etiqueta de autenticación y versión de clave. Falta cualquiera de los tres y no valida.
- **CA-12** Ningún fixture válido del repositorio contiene un token, ni real ni inventado con forma de real.
- **CA-13** La credencial referencia siempre una conexión. No existe credencial huérfana.

## M06.1a — Migración de conexiones y credenciales

Migración `0012`, nueva. No se modifica ninguna migración existente.

- **CA-14** `public.integration_connections` y `public.oauth_attempts` tienen `company_id`, RLS habilitada y `force row level security`.
- **CA-15** `private.integration_credentials` existe en el esquema `private`, sin ningún `grant` para `anon` ni `authenticated`.
- **CA-16** Ninguna tabla nueva es legible por `anon`.
- **CA-17** Los privilegios se conceden operación por operación después de un `revoke all`, siguiendo el patrón de la migración `0004`. La matriz queda documentada en el encabezado de la migración.
- **CA-18** Existe una unicidad que impide dos conexiones activas al mismo proveedor y la misma cuenta externa dentro de una empresa.

## M06.2a — Aislamiento multiempresa de las tablas nuevas

- **CA-19** Un usuario de la empresa A no puede leer, modificar ni borrar ninguna fila de la empresa B en ninguna tabla nueva. Probado en pgTAP con dos empresas reales, no con simulacros.
- **CA-20** Ninguna política acepta un `company_id` provisto por el cliente: todas resuelven la pertenencia con `private.is_company_member()`.
- **CA-21** Un usuario no puede leer la tabla de credenciales por ninguna vía, ni directa ni a través de una función.
- **CA-22** Las pruebas nuevas viven en `supabase/tests/` y corren con `npm run test:policies`.

## M06.3a — Cifrado de credenciales

- **CA-23** El cifrado usa AES-256-GCM con un vector de inicialización aleatorio por operación. Nunca se reutiliza un IV.
- **CA-24** Descifrar con una clave incorrecta o un texto alterado falla de forma explícita. Nunca devuelve basura ni una cadena vacía.
- **CA-25** La versión de clave se persiste junto al texto cifrado. Un texto cifrado con la versión anterior se sigue descifrando después de rotar.
- **CA-26** Ni la clave ni un token aparecen jamás en un log, un mensaje de error o un fixture. Una prueba recorre el árbol buscándolos.
- **CA-27** La invariante de `tests/unit/no-privileged-credentials.test.ts` sigue pasando sin modificar la prueba.

## M16.1 — OAuth de Meta

Dos rutas nuevas bajo `src/app/api/integraciones/meta/`.

- **CA-28** El inicio crea un intento K02, genera un `state` aleatorio de al menos 32 bytes, persiste su hash y redirige al diálogo de Meta pidiendo exclusivamente `ads_read`.
- **CA-29** El callback rechaza un `state` ausente, desconocido, vencido o ya consumido, y en todos los casos muestra un error comprensible sin filtrar detalles internos.
- **CA-30** El intercambio de código por token ocurre en el servidor con `META_APP_SECRET`. El token nunca llega al navegador, ni en el HTML, ni en una cookie, ni en un parámetro de URL.
- **CA-31** El token de corta duración se cambia por uno de larga duración antes de persistirlo.
- **CA-32** Los permisos efectivamente concedidos se inspeccionan con `debug_token`. Si falta `ads_read`, la conexión queda `needs_reauth` con un mensaje que dice qué faltó, y no se persiste una conexión que aparente estar sana.
- **CA-33** Un callback repetido con el mismo código no crea una segunda conexión.
- **CA-34** El usuario que cancela la autorización en Meta vuelve a una pantalla que lo explica, no a un error.

## M16.2 — Selección de cuenta y ciclo de vida

- **CA-35** La aplicación lista las cuentas publicitarias a las que el token da acceso, con nombre, moneda y zona horaria.
- **CA-36** El usuario elige una explícitamente. Ninguna se elige sola, ni siquiera cuando hay una sola.
- **CA-37** Antes de darla por activa se ejecuta una consulta de prueba contra la cuenta. Si falla, la conexión no queda activa.
- **CA-38** Desconectar destruye la credencial de inmediato y deja la conexión en `disconnected`.
- **CA-39** Un `403` o una revocación desde Meta dejan la conexión en `needs_reauth` y la interfaz ofrece reconectar.
- **CA-40** La interfaz nunca muestra el identificador completo de la cuenta publicitaria junto a datos de gasto en capturas o registros de evidencia.

## M16c — Insights diarios

- **CA-41** La sincronización pide `spend` e `impressions` con `time_increment=1` sobre una ventana explícita.
- **CA-42** El crudo de cada ventana se persiste antes de derivar observaciones.
- **CA-43** Un día sin datos se registra como no observado. Nunca como cero.
- **CA-44** Cada observación conserva la zona horaria de la cuenta y la moneda. No se convierte ninguna moneda.
- **CA-45** Sincronizar dos veces la misma ventana no duplica observaciones ni altera las existentes.
- **CA-46** La cobertura es consultable: qué días de la ventana pedida quedaron observados y cuáles no.
- **CA-47** Los totales derivados coinciden exactamente con la respuesta cruda guardada.

## M25a — Chat sobre las observaciones

- **CA-48** El catálogo de herramientas es cerrado: cobertura de un período, gasto por día, total de un período, estado de la conexión. Nada más.
- **CA-49** Las herramientas no aceptan SQL, nombres de tabla, ni identificadores de empresa. El tenant se resuelve en el servidor.
- **CA-50** Toda cifra de la respuesta proviene de una herramienta. Una prueba adversaria pide una cifra que ninguna herramienta devuelve y verifica que el sistema se abstenga en vez de estimarla.
- **CA-51** Ante un período sin cobertura completa, la respuesta lo dice antes de dar cualquier número.
- **CA-52** La interfaz muestra siempre qué cuenta y qué período está respondiendo.
- **CA-53** Con el modelo caído, el chat degrada con un mensaje claro. No inventa, no se cuelga y no pierde la pregunta.
- **CA-54** Un usuario de la empresa A no obtiene jamás datos de la empresa B, ni preguntando directamente ni mediante instrucciones inyectadas en el texto de la pregunta.

---

## Criterios transversales

- **CB-01** `npm run verify` pasa al final de cada corte.
- **CB-02** Ningún diff contiene secretos, tokens, montos reales ni identificadores completos de cuentas.
- **CB-03** Ninguna migración existente se modifica.
- **CB-04** Ninguna prueba se ejecuta contra producción.
- **CB-05** Cada corte deja su evidencia con comandos y resultados reales, sin declarar como probado lo que no se ejecutó.

## Fuera de alcance, declarado

Recolección automática, reintentos, múltiples cuentas por empresa, múltiples proveedores simultáneos, histórico mayor al que la ventana pedida cubra, y cualquier afirmación analítica sobre la eficiencia de la inversión.
