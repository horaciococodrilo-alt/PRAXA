# Seguridad y datos

## Capas

El aislamiento entre empresas descansa en tres capas independientes. Cada una tiene que
ser correcta por su cuenta; ninguna cubre los errores de otra.

1. **Privilegios SQL** (`GRANT`/`REVOKE`) — qué tablas y operaciones puede tocar cada rol.
2. **RLS** — qué filas puede ver o escribir dentro de lo que tiene permitido.
3. **Autorización en servidor** — identidad verificada y pertenencia comprobada antes de
   cada operación.

**RLS no reemplaza los privilegios SQL.** Supabase concede privilegios amplios por
defecto sobre las tablas nuevas de `public`; `0004_grants.sql` los revoca y vuelve a
conceder operación por operación.

## Matriz de privilegios

| Tabla | `anon` | `authenticated` |
|---|---|---|
| `companies` | — | SELECT, INSERT, UPDATE |
| `company_members` | — | SELECT |
| `company_context_versions` | — | SELECT, INSERT, UPDATE, DELETE |
| `company_objectives` | — | SELECT (escritura solo por RPC) |
| `company_systems` | — | SELECT (escritura solo por RPC) |
| `reports` | — | SELECT |

`anon` no accede a ninguna tabla del producto: un visitante sin sesión no debe poder ni
comprobar si una empresa existe. La matriz se verifica en
`supabase/tests/03_privileges.test.sql`.

Sin `DELETE` sobre `companies`: la aplicación no borra empresas. Sin escritura sobre
`company_members`: es la vía natural de escalada de permisos. Sobre `reports`, solo
lectura hasta que exista el worker de generación.

## Invariantes que se aplican en la base

- Un usuario solo ve filas de empresas donde es miembro.
- `owner_id` e `id` de una empresa son inmutables: no se puede transferir la propiedad
  ni suplantar al dueño (trigger `private.forbid_company_identity_change`).
- Nadie puede otorgarse ni modificar membresías: no existe política de escritura sobre
  `company_members`. La membresía inicial la crea un trigger en la misma transacción que
  el alta de la empresa.
- Las políticas de escritura llevan `USING` **y** `WITH CHECK`: no alcanza con poder ver
  la fila, la fila resultante también tiene que seguir siendo propia. Cambiar
  `company_id` o falsear `created_by` se rechaza.
- Las claves foráneas compuestas `(company_id, context_version_id)` impiden relacionar
  filas de empresas distintas a nivel de integridad referencial.
- Una versión de contexto `active` o `superseded` es inmutable, incluidas sus filas
  hijas.
- A lo sumo un borrador y una versión activa por empresa (índices únicos parciales), que
  son además el respaldo real ante activaciones concurrentes.

## Una sola vía de escritura para las listas del contexto

Objetivos y sistemas **no se escriben directamente**: `authenticated` solo los lee. Toda
escritura pasa por `replace_draft_objectives()` / `replace_draft_systems()`, y la
activación solo por `activate_context_draft()`.

No es una preferencia de estilo, es lo que hace posible coordinar edición y confirmación:

- Cada una de esas funciones toma un cerrojo consultivo por empresa **antes** de tocar
  ninguna fila, y relee el estado una vez adquirido.
- Un trigger no sirve para eso: `FOR EACH ROW` corre *después* de que la sentencia ya
  tomó el bloqueo de fila, así que tomar ahí el cerrojo invierte el orden de adquisición
  y abre un interbloqueo real.

**Orden de adquisición, único para todo el sistema:** (1) cerrojo consultivo de la
empresa, (2) bloqueos de fila. Los UPDATE directos sobre `company_context_versions`
—editar campos del borrador— no toman el cerrojo a propósito: operan sobre la misma fila
que la activación, así que el bloqueo de fila ya los serializa.

El privilegio de escritura vive en funciones `SECURITY DEFINER` dentro de `private`, que
no está expuesto por la Data API y que vuelve a verificar la pertenencia con `auth.uid()`
—el usuario final sigue siendo el mismo aunque cambie el rol de ejecución—.

## Confirmar exactamente lo que se revisó

Activar un contexto exige, además del identificador del borrador, la **revisión** que el
usuario tenía a la vista. La revisión es un resumen de todo el contexto —la fila y sus dos
listas—, así que cambiar solo objetivos o solo sistemas la invalida. `updated_at` no
servía: las escrituras en las tablas hijas no tocan la fila de contexto.

La comprobación ocurre **dentro de la misma transacción que activa**, después de tomar el
cerrojo de la empresa y justo antes del UPDATE. No hay ventana entre comprobar y activar:
cualquier escritura concurrente tuvo que soltar el cerrojo antes, y su efecto ya está en
la revisión que se recalcula ahí.

La revisión se calcula, no se guarda: una columna habría que mantenerla sincronizada con
triggers en tres tablas, y cualquier camino que se olvidara de tocarla dejaría pasar un
conflicto en silencio.

Dos cosas que la revisión **no** hace:

- **No autoriza.** El identificador viene del navegador; la pertenencia la resuelve RLS a
  partir de la sesión. Un usuario con el id y la revisión correctos de otra empresa
  sigue recibiendo "inexistente o ajena".
- **No se exige en el reintento.** Activar cambia la revisión, así que un reintento
  legítimo traería la anterior. Si la versión ya está activa se devuelve tal cual, que es
  lo que conserva la idempotencia.

El conflicto se señala con `PT409` (409 Conflict), no con un código de la clase 40. Esa
clase significa "transitorio, reintentá" y PostgREST la reintenta automáticamente: con un
conflicto de revisión eso produce un bucle que termina en `upstream request timeout`, en
lugar de un error que el usuario pueda entender.

## Autorización en el servidor

**El proxy no es la autorización final.** `proxy.ts` refresca la sesión y redirige, nada
más. La documentación de Next.js 16 advierte que las Server Functions son POST a la ruta
donde se usan, y que un cambio de `matcher` o mover una acción de ruta puede quitarles
cobertura sin que nada lo señale. Por eso:

- Cada página protegida y cada Server Action verifica identidad con **`getClaims()`**,
  que valida la firma del JWT. **Nunca se usa `getSession()` como prueba de identidad**:
  no garantiza revalidación del token en contexto de servidor.
- La empresa se resuelve **desde la identidad verificada**, consultando la membresía.
  Ningún identificador de empresa enviado por el navegador se usa para decidir acceso.
  Aunque llegara uno, RLS lo rechazaría igual.

## Credenciales

La aplicación **no usa ninguna credencial privilegiada**. No existe `admin.ts`, ni clave
de servicio en `.env.example`, ni cliente elevado en `src/`. Todo el acceso a datos
ocurre con la clave publishable, bajo la sesión del usuario y sujeto a RLS.

Esa invariante se verifica automáticamente en
`tests/unit/no-privileged-credentials.test.ts`, que falla si aparece una clave de
servicio bajo `src/` o en el proxy.

La clave publishable es pública por diseño: se expone en el navegador. El aislamiento lo
garantizan RLS y los privilegios SQL, no el secreto de esa clave.

### La clave `service_role` en las pruebas

Los fixtures que necesitan privilegios (crear usuarios ya confirmados, borrar lo creado)
viven en `tests/app/helpers.ts` y usan la `service_role` key, que **omite RLS por
completo**. Reglas que se cumplen:

- Solo se lee desde `SUPABASE_TEST_SECRET_KEY`, un nombre que la aplicación no
  conoce. Nunca desde una variable `NEXT_PUBLIC_*`.
- Solo corre en Node, dentro de la suite de pruebas. Nunca llega al bundle del navegador.
- Solo prepara y limpia fixtures. **Ninguna aserción de aislamiento se hace con ella**:
  todas usan un cliente autenticado normal, sujeto a RLS, que es lo que hay que verificar.
- La prueba `tests/unit/no-privileged-credentials.test.ts` falla si el nombre de esa
  variable —o el de cualquier otra credencial privilegiada— aparece bajo `src/` o en
  `proxy.ts`.

### Las pruebas nunca corren contra producción

Las credenciales de prueba tienen nombres propios (`SUPABASE_TEST_*`), distintos de los
de la aplicación: apuntar la suite al proyecto que la aplicación usa exige pegar esas
credenciales a propósito. Además, nada corre sin
`SUPABASE_TEST_IS_DISPOSABLE=yes-this-project-is-disposable`, y si la URL de prueba
coincide con la de la aplicación la suite se detiene salvo declaración explícita.

Cada corrida etiqueta lo que crea con un identificador único y borra al terminar
exactamente eso: primero las empresas, después los usuarios, nada más.

## Fases futuras

Cuando existan workers e integraciones, siguen aplicando estas reglas:

- **Los workers deben verificar el contexto de empresa por su cuenta.** Corren fuera de
  la sesión del usuario; si usan una credencial privilegiada, RLS deja de protegerlos y
  el aislamiento pasa a depender enteramente de su código. Cada tarea recibe un
  `company_id` explícito y filtra por él en toda consulta.
- **Los tokens de integraciones requieren almacenamiento protegido**: cifrados, fuera del
  alcance de la Data API, accesibles solo desde el worker. Nunca en una tabla legible por
  `authenticated`.
- **El LLM recibe información acotada**: evidencia ya calculada y el contexto declarado.
  Sin credenciales, sin acceso a los sistemas conectados y sin permisos de escritura
  sobre ningún sistema externo. PRAXA analiza y recomienda; no ejecuta cambios.

## Qué no está resuelto todavía

- No hay limitación de intentos de inicio de sesión más allá de la que trae Supabase Auth
  por defecto.
- No hay registro de auditoría de accesos ni de cambios de contexto más allá de las
  versiones y sus marcas de tiempo.
- No hay política de borrado ni de retención de datos: no hace falta todavía porque no se
  extraen datos de sistemas externos. Es requisito antes de conectar el primer sistema
  real.
### La excepción de DELETE en los triggers de inmutabilidad

Borrar una empresa exige que la cascada pueda atravesar `company_context_versions` y sus
hijas. Sin una salida, sería imposible borrar una empresa, limpiar los datos de una
prueba o atender un pedido de eliminación. Los triggers la tienen, con **dos**
condiciones simultáneas:

1. el rol es administrativo (`service_role`, `supabase_admin` o `postgres`), **y**
2. `auth.uid()` es nulo — no hay ningún usuario final detrás de la operación.

La segunda condición es la que cierra la vía indirecta. Dentro de una función
`SECURITY DEFINER`, `current_user` pasa a ser el dueño de la función (postgres): mirar
solo el rol permitiría que un usuario normal borrara una versión inmutable invocando una
función definer que borre. El claim `sub` del JWT, en cambio, sobrevive al cambio de rol,
así que mientras haya sesión de usuario la excepción no aplica.

Alcance: **solo DELETE**. La inmutabilidad frente a UPDATE es absoluta para todos los
roles, incluido `service_role`.

Cubierto por `supabase/tests/05_delete_carveout.test.sql`, que prueba la vía directa, la
indirecta a través de una función `SECURITY DEFINER`, y que el camino administrativo
legítimo siga funcionando.
