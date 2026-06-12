import { useGame } from '../state/store'
import { T } from '../i18n/pt-BR'
import { siteStatus } from '../engine/site'
import { accessLayer, firewallThroughputGbps, nicDemandGbps, switchCount, wanStatus } from '../engine/network'
import { ddosMitigationGbps } from '../engine/world'
import { PREMISES, RACKS } from '../data/infra'
import { fmtMoney, fmtWatts } from '../utils/format'
import { Panel } from './shared/Panel'
import { RatioMeter } from './shared/RatioMeter'
import { AlertTriangle, Thermometer } from 'lucide-react'

const gbps = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} Gbps`

const kw = (n: number) => fmtWatts(n * 1000)

export function RacksTab() {
  const builds = useGame((s) => s.builds)
  const equipment = useGame((s) => s.equipment)
  const infra = useGame((s) => s.infra)
  const network = useGame((s) => s.network)
  const scrubbing = useGame((s) => s.scrubbing)
  const tempC = useGame((s) => s.tempC)

  const site = siteStatus({ builds, equipment, infra, tempC, network })
  const access = accessLayer(network, nicDemandGbps(builds, equipment))
  const wan = wanStatus(network)
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

      <Panel title={T.netpanel.title}>
        {switchCount(network) === 0 ? <p className="dim small">{T.netpanel.noSwitch}</p> : null}
        {access.unconnectedGbps > 0 ? (
          <div className="banner warn-bg" role="alert">
            <AlertTriangle size={16} strokeWidth={1.5} aria-hidden />{' '}
            {T.netpanel.unconnected(access.unconnectedGbps.toLocaleString('pt-BR'))}
          </div>
        ) : null}
        <RatioMeter
          label={T.netpanel.ports}
          used={access.demandGbps}
          max={Math.max(access.portCapacityGbps, 0.001)}
          format={(n) => gbps(n)}
        />
        <dl className="kv small">
          <dt>{T.netpanel.uplink}</dt>
          <dd className="mono">{gbps(access.uplinkGbps)}</dd>
          <dt>{T.netpanel.ratio}</dt>
          <dd className="mono">
            {access.ratio === Infinity ? '∞' : access.ratio.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}:1
          </dd>
          <dt>{T.netpanel.score}</dt>
          <dd className={'mono ' + (access.score < 90 ? 'crit' : access.score < 100 ? 'warn' : 'ok')}>{access.score}%</dd>
        </dl>
      </Panel>

      <Panel title={T.netpanel.wanTitle}>
        {wan.linksOverSessions ? (
          <div className="banner warn-bg" role="alert">
            <AlertTriangle size={16} strokeWidth={1.5} aria-hidden /> {T.netpanel.overSessions}
          </div>
        ) : null}
        <dl className="kv small">
          <dt>{T.netpanel.routers}</dt>
          <dd className="mono">{gbps(wan.routerCapacityGbps)}</dd>
          <dt>{T.netpanel.sessions}</dt>
          <dd className="mono">{wan.linkCount}/{wan.bgpSessions}</dd>
          <dt>{T.netpanel.links}</dt>
          <dd className="mono">{gbps(wan.linkGbps)}</dd>
          <dt>{T.netpanel.egress}</dt>
          <dd className="mono">{gbps(wan.egressGbps)}</dd>
          <dt>{T.netpanel.transit}</dt>
          <dd className="mono crit">{fmtMoney(wan.transitPerSec * 720)}{T.shop.perMonth}</dd>
          <dt>{T.netpanel.firewall}</dt>
          <dd className="mono">{gbps(firewallThroughputGbps(network))}</dd>
          <dt>{T.netpanel.mitigation}</dt>
          <dd className="mono">{gbps(ddosMitigationGbps(network, scrubbing))}</dd>
        </dl>
      </Panel>
    </div>
  )
}
