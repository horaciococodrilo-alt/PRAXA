import { IconFlecha } from '@/components/app/icons';
import { IntegracionLogo } from '@/components/app/integracion-logo';
import { Badge, Button, DisclosureButton } from '@/components/app/ui';
import i from '@/components/app/integraciones.module.css';
import { confirmarCuentaMeta, desconectarMeta } from '@/modules/integrations/actions';
import type { MetaCardState } from '@/modules/integrations/lifecycle';
import { NEEDS_REAUTH_TEXTS } from '@/modules/integrations/meta/errors';
import { META_OAUTH_MESSAGES } from '@/modules/integrations/meta/outcomes';

const START = '/api/integraciones/meta/iniciar';
const DISCONNECT_HELP = 'Desconectar no quita a Praxa de tu negocio en Meta. Para hacerlo, entrá a la configuración de tu negocio en Meta, a las integraciones o apps conectadas, y quitá a Praxa.';
const RETENTION = 'Se borran la credencial y los datos de esta conexión de la base activa. Esta acción no se puede deshacer. Si el proyecto usa Supabase Pro, las copias nocturnas pueden conservarlos hasta 7 días.';
// La spec fija los dos textos anteriores para `activa` y `requiere_reauth`; los de la conexión
// pendiente, que todavía no sincronizó nada, nombran la acción que se confirma.
const PENDING_NOTICE = 'Se descarta la conexión pendiente y se borra de la base activa la credencial que autorizaste. Para usar Meta tendrás que conectarla de nuevo. Si el proyecto usa Supabase Pro, las copias nocturnas pueden conservarla hasta 7 días.';
const PENDING_HELP = 'Cancelar la conexión no quita a Praxa de tu negocio en Meta. Para hacerlo, entrá a la configuración de tu negocio en Meta, a las integraciones o apps conectadas, y quitá a Praxa.';

function StartControl({ label }: { label: string }) {
  return (
    <form method="post" action={START} className={i.actForm}>
      <Button type="submit" variant="small" className={i.act}>
        <span>{label}</span>
        <IconFlecha size={13} stroke={2.1} />
      </Button>
    </form>
  );
}

function DisconnectControl({ pending = false }: { pending?: boolean }) {
  return (
    <details>
      <DisclosureButton className={i.act}>{pending ? 'Cancelar conexión' : 'Desconectar'}</DisclosureButton>
      <p>{pending ? PENDING_NOTICE : RETENTION}</p>
      <p>{pending ? PENDING_HELP : DISCONNECT_HELP}</p>
      <form action={desconectarMeta} className={i.actForm}>
        <Button type="submit" variant="danger" className={i.act}>
          {pending ? 'Sí, cancelar conexión' : 'Sí, desconectar'}
        </Button>
      </form>
    </details>
  );
}

export function MetaTarjeta({ state }: { state: MetaCardState }) {
  const connected = state.kind === 'activa';
  return (
    <article className={i.card}>
      <div className={i.cardTop}>
        <span className={i.logo}><IntegracionLogo id="meta_ads" size={30} /></span>
        <div className={i.nm}>
          <h3>Meta Ads</h3>
          <p>Campañas de Facebook<br />e Instagram</p>
        </div>
      </div>
      <Badge on={connected} className={i.estado}>
        {state.kind === 'requiere_reauth' ? 'Requiere autorización' : connected ? 'Conectado' : 'No conectado'}
      </Badge>

      {state.kind === 'sin_empresa' ? (
        <p>Primero completá los datos de tu empresa en <a href="/app/configuracion">Configuración</a>.</p>
      ) : null}
      {state.kind === 'sin_conexion' ? (
        <StartControl label="Conectar" />
      ) : null}
      {state.kind === 'pendiente' ? (
        <>
          {state.listError ? <p role="alert">{META_OAUTH_MESSAGES[state.listError].text}</p> : null}
          {state.discarded > 0 ? <p>{state.discarded} cuentas no se pueden usar porque Meta no informó moneda o zona válidas.</p> : null}
          {state.accounts.length > 0 ? (
            <form action={confirmarCuentaMeta} className={i.actForm}>
              <fieldset>
                <legend>Elegí la cuenta publicitaria</legend>
                {state.accounts.map((account) => (
                  <label key={account.selectionKey}>
                    <input type="radio" name="cuenta" value={account.selectionKey} required />
                    {account.name ?? 'Cuenta sin nombre'} ({account.maskedId}) · {account.currency} · {account.timezone}
                  </label>
                ))}
              </fieldset>
              <Button type="submit" variant="small" className={i.act}>Confirmar cuenta</Button>
            </form>
          ) : null}
          <DisconnectControl pending />
        </>
      ) : null}
      {(state.kind === 'activa' || state.kind === 'requiere_reauth') ? (
        <>
          <p>Cuenta {state.maskedId} · {state.currency} · {state.timezone}</p>
          {state.kind === 'requiere_reauth' ? (
            <>
              <p>{NEEDS_REAUTH_TEXTS[state.errorClass]}</p>
              <StartControl label="Volver a autorizar" />
            </>
          ) : null}
          <DisconnectControl />
        </>
      ) : null}
      {state.kind === 'error' ? <p>No pudimos leer el estado de Meta. Probá de nuevo más tarde.</p> : null}
    </article>
  );
}
