import { useGame } from '../state/store'
import { T } from '../i18n/pt-BR'
import { siteStatus } from '../engine/site'
import { PREMISES, RACKS } from '../data/infra'
import { fmtWatts } from '../utils/format'
import { Panel } from './shared/Panel'
import { RatioMeter } from './shared/RatioMeter'
import { AlertTriangle, Thermometer } from 'lucide-react'

const kw = (n: number) => fmtWatts(n * 1000)

export function RacksTab() {
  const builds = useGame((s) => s.builds)
  const equipment = useGame((s) => s.equipment)
  const infra = useGame((s) => s.infra)
  const tempC = useGame((s) => s.tempC)

  const site = siteStatus({ builds, equipment, infra, tempC })
  const { placement, cooling } = site
  const coolingTotal = cooling.ambientKw + cooling.cracCapacityKw
  const tempState = tempC >= 32 ? 'crit' : tempC >= 27 ? 'warn' : 'ok'

  return (
    <div className="stack">
      {placement.unplaced > 0 ? (
        <div className="banner warn-bg" role="alert">
          <AlertTriangle size={16} strokeWidth={1.5} aria-hidden /> {T.racks.unplaced(placement.unplaced)}
        </div>
      ) : null}

      <Panel title={T.racks.siteTitle}>
        <dl className="kv small">
          <dt>{T.racks.premises}</dt>
          <dd className="mono">{PREMISES[infra.premises].label}</dd>
          <dt>{T.racks.temp}</dt>
          <dd className={'mono ' + tempState}>
            <Thermometer size={13} strokeWidth={1.5} aria-hidden /> {tempC.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} °C
          </dd>
          <dt>{T.racks.pue}</dt>
          <dd className="mono">{cooling.pue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
        </dl>
        <RatioMeter label={T.racks.feed} used={site.itKw * 1000} max={site.feedKw * 1000} format={fmtWatts} />
        {site.upsKw > 0 ? (
          <RatioMeter label={T.racks.ups} used={site.itKw * 1000} max={site.upsKw * 1000} format={fmtWatts} />
        ) : (
          <p className="dim small">{T.racks.ups}: {T.racks.upsNone}</p>
        )}
        <RatioMeter
          label={T.racks.cooling}
          used={cooling.heatKw * 1000}
          max={Math.max(coolingTotal, 0.001) * 1000}
          format={fmtWatts}
          hint={T.racks.coolingDetail(kw(cooling.ambientKw), kw(cooling.cracCapacityKw))}
        />
      </Panel>

      <Panel title={T.racks.racksTitle}>
        {placement.racks.length === 0 ? <p className="dim small">{T.racks.noRacks}</p> : null}
        <div className="card-grid">
          {placement.racks.map((r, i) => (
            <article className="card" key={i}>
              <header className="card-head">
                <h3 className="card-title">{T.racks.rackName(i + 1, r.type === 'r48' ? '48U' : '42U')}</h3>
                {RACKS[r.type].dualPdu ? <span className="mono badge">A+B</span> : null}
              </header>
              <RatioMeter label={T.racks.uMeter} used={r.usedU} max={r.u} format={(n) => `${Math.round(n)}U`} />
              <RatioMeter label={T.racks.kwMeter} used={r.usedKw * 1000} max={r.pduKw * 1000} format={fmtWatts} />
            </article>
          ))}
          <article className="card">
            <header className="card-head">
              <h3 className="card-title">{T.racks.bench}</h3>
            </header>
            <RatioMeter
              label={T.racks.uMeter}
              used={placement.benchUsedU}
              max={placement.benchU}
              format={(n) => `${Math.round(n)}U`}
            />
            <p className="dim small">{T.racks.benchHint}</p>
          </article>
        </div>
      </Panel>
    </div>
  )
}
