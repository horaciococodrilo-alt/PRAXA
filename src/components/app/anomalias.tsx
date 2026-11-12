import type { ReactNode } from 'react';

import { Card, ButtonLink } from '@/components/app/ui';
import { IconAlerta, IconCheck, IconReloj } from '@/components/app/icons';
import type { MetaAnomaly, MetaAnomalyView } from '@/modules/anomalies';

import s from './anomalias.module.css';

const DATE = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
});
const DATE_TIME = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const METRIC_LABELS: Record<MetaAnomaly['metric'], string> = {
  ctr: 'CTR',
  cpc: 'Costo por clic',
  cpm: 'Costo por mil impresiones',
  spend: 'Gasto',
  cpa_purchase: 'Costo por compra',
};

const RULE_LABELS: Record<MetaAnomaly['ruleId'], string> = {
  ctr_decrease: 'CTR baja: atención desde 20 %, crítica desde 40 %',
  cpc_increase: 'Costo por clic sube: atención desde 25 %, crítica desde 50 %',
  cpm_increase: 'Costo por mil sube: atención desde 25 %, crítica desde 50 %',
  spend_increase: 'Gasto sube: atención desde 30 %, crítica desde 60 %',
  cpa_purchase_increase: 'Costo por compra sube: atención desde 25 %, crítica desde 50 %',
};

function date(value: string): string {
  return DATE.format(new Date(`${value}T00:00:00.000Z`)).replaceAll('.', '');
}

function decimal(value: string): string {
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction] = unsigned.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}${grouped}${fraction === undefined ? '' : `,${fraction}`}`;
}

function displayedValue(anomaly: MetaAnomaly, side: 'baseline' | 'current'): string {
  const value = anomaly[side];
  if (value.unit === 'percent') return `${decimal(value.value)} %`;
  return `${value.currency ?? 'Moneda'} ${decimal(value.value)}`;
}

function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className={s.empty} aria-labelledby="anomaly-empty-title">
      <span className={s.emptyIcon}><IconAlerta size={26} /></span>
      <div>
        <h2 id="anomaly-empty-title">{title}</h2>
        <p>{children}</p>
      </div>
      {action ? <div className={s.actions}>{action}</div> : null}
    </Card>
  );
}

function AlertCard({ anomaly }: { anomaly: MetaAnomaly }) {
  const name = anomaly.entityName ?? (anomaly.level === 'account' ? 'Cuenta publicitaria' : 'Campaña');
  const label = METRIC_LABELS[anomaly.metric];
  return (
    <li>
      <Card as="article" className={s.alert} aria-label={`${label} en ${name}`}>
        <header className={s.alertHeader}>
          <div>
            <span className={s.scope}>{anomaly.level === 'account' ? 'Cuenta' : 'Campaña'} · {name}</span>
            <h2>{label}</h2>
          </div>
          <span className={anomaly.severity === 'critical' ? s.critical : s.warning}>
            {anomaly.severity === 'critical' ? 'Crítica' : 'Atención'}
          </span>
        </header>

        <div className={s.comparison}>
          <div>
            <span>Período anterior</span>
            <strong>{displayedValue(anomaly, 'baseline')}</strong>
            <small>{date(anomaly.periods.baseline.from)} – {date(anomaly.periods.baseline.to)}</small>
          </div>
          <span className={s.arrow} aria-hidden="true">→</span>
          <div>
            <span>Período reciente</span>
            <strong>{displayedValue(anomaly, 'current')}</strong>
            <small>{date(anomaly.periods.current.from)} – {date(anomaly.periods.current.to)}</small>
          </div>
          <div className={s.change}>
            <span>Variación</span>
            <strong>{decimal(anomaly.changePct)} %</strong>
          </div>
        </div>

        <details className={s.evidence}>
          <summary>Evidencia y criterio</summary>
          <dl>
            <div><dt>Cobertura</dt><dd>{anomaly.evidence.observationsUsed} observaciones · {anomaly.evidence.daysPerPeriod} días por período</dd></div>
            <div><dt>Mínimo aplicado</dt><dd>{anomaly.evidence.minimumVolume} por período</dd></div>
            <div><dt>Regla</dt><dd>{RULE_LABELS[anomaly.ruleId]} · {anomaly.rulesVersion.replace('meta-anomaly-rules/', 'v')}</dd></div>
            {anomaly.evidence.latestFetchedAt ? (
              <div><dt>Datos sincronizados</dt><dd>{DATE_TIME.format(new Date(anomaly.evidence.latestFetchedAt))}</dd></div>
            ) : null}
          </dl>
        </details>
      </Card>
    </li>
  );
}

export function Anomalias({ view }: { view: MetaAnomalyView }) {
  if (view.state === 'not_connected') {
    const needsAttention = view.reason === 'needs_reauth';
    return <EmptyState title={needsAttention ? 'Volvé a conectar Meta Ads' : 'Conectá Meta Ads'}
      action={<ButtonLink href="/app/integraciones" variant="secondary">Ver integraciones</ButtonLink>}>
      {needsAttention ? 'La conexión necesita autorización antes de analizar el rendimiento.' :
        'Necesitamos una cuenta conectada para comparar su rendimiento.'}
    </EmptyState>;
  }
  if (view.state === 'never_synced') {
    return <EmptyState title="Sincronizá tus datos"
      action={<ButtonLink href="/app/integraciones" variant="secondary">Ir a Integraciones</ButtonLink>}>
      El detector usa días ya guardados en PRAXA. Hacé una sincronización para empezar.
    </EmptyState>;
  }
  if (view.state === 'unavailable') {
    return <EmptyState title="No pudimos analizar tus datos"
      action={<ButtonLink href="/app/integraciones" variant="secondary">Revisar integración</ButtonLink>}>
      Probá nuevamente en unos minutos. Tus campañas no fueron modificadas.
    </EmptyState>;
  }
  if (view.state === 'insufficient_data') {
    return <EmptyState title="Todavía no hay datos suficientes"
      action={<>
        <ButtonLink href="/app/integraciones" variant="secondary">Sincronizar datos</ButtonLink>
        <ButtonLink href="/app/anomalias?ejemplo=1">Ver demostración</ButtonLink>
      </>}>
      Se necesitan 14 días consecutivos, cerrados y completos. Ningún dato ausente se interpreta
      como cero. Podés ver una demostración separada mientras reunís cobertura real.
    </EmptyState>;
  }

  const demo = view.result.mode === 'synthetic_demo';
  return (
    <div className={s.content}>
      {demo ? (
        <div className={s.demo} role="status">
          <IconAlerta size={20} />
          <div><strong>Datos simulados</strong><span>Esta demostración no corresponde a tu cuenta de Meta Ads.</span></div>
          <ButtonLink href="/app/anomalias" variant="secondary">Volver a mis datos</ButtonLink>
        </div>
      ) : null}

      <section className={s.summary} aria-label="Resumen de anomalías">
        <div><span>Alertas</span><strong>{view.result.anomalies.length}</strong></div>
        <div><span>Alcances evaluados</span><strong>{view.result.evaluatedScopes}</strong></div>
        <div><span>Reglas</span><strong>{view.result.rulesVersion.replace('meta-anomaly-rules/', 'v')}</strong></div>
        {view.lastSyncedAt ? <div><span>Última sincronización</span><strong>{DATE_TIME.format(new Date(view.lastSyncedAt))}</strong></div> : null}
      </section>

      {view.result.anomalies.length === 0 ? (
        <Card className={s.clear}>
          <IconCheck size={28} />
          <div>
            <h2>No detectamos cambios fuera de los umbrales</h2>
            <p>Esto solo describe las reglas evaluadas y no garantiza que todas las campañas estén funcionando bien.</p>
          </div>
        </Card>
      ) : (
        <>
          <div className={s.sectionTitle}>
            <div><IconAlerta size={21} /><h2>Qué requiere atención</h2></div>
            <p>Comparación automática de los últimos 7 días cerrados contra los 7 anteriores.</p>
          </div>
          <ul className={s.list} aria-label="Alertas detectadas">
            {view.result.anomalies.map((item) => <AlertCard key={item.id} anomaly={item} />)}
          </ul>
        </>
      )}

      <Card className={s.method}>
        <IconReloj size={20} />
        <div><h2>Cómo se detectan</h2><p>Las reglas usan datos persistidos y cálculos exactos. No explican causas, no usan IA y no cambian nada en Meta Ads.</p></div>
      </Card>
    </div>
  );
}
