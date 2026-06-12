import { useGame } from '../state/store'
import { T } from '../i18n/pt-BR'
import * as eco from '../engine/economy'
import { coolingStatus, feedKw, itKwOf, throttleMult, totals } from '../engine/site'
import { accessLayer, nicDemandGbps } from '../engine/network'
import { effectsAt } from '../engine/world'
import { fmtMoney, fmtPerSec, fmtShort, fmtWatts } from '../utils/format'
import { Panel } from './shared/Panel'
import { RatioMeter } from './shared/RatioMeter'
import { AlertTriangle, Hammer } from 'lucide-react'

export function Dashboard() {
  const s = useGame()
  const t = totals(s.builds, s.equipment)
  const contractsRev = eco.contractsPerSec(s, effectsAt(s, s.lastTs))
  const adhoc = eco.adhocPerSec(s, effectsAt(s, s.lastTs))
  const energy = eco.energyCostPerSec(s)
  const transit = eco.transitPerSec(s.network)
  const rent = eco.rentPerSec(s.infra)
  const net = contractsRev + adhoc - energy - transit - rent - eco.scrubbingPerSec(s.scrubbing)
  const cooling = coolingStatus(s.infra, itKwOf(s))
  const throttle = throttleMult(s.tempC)
  const access = accessLayer(s.network, nicDemandGbps(s.builds, s.equipment))
  const effects = effectsAt(s, s.lastTs)
  const activeEvent = s.marketEvent && s.lastTs < s.marketEvent.untilTs ? s.marketEvent.kind : null

  return (
    <div className="stack">
      <Panel>
        <button className="work-btn" onClick={s.clickWork} aria-label={T.dashboard.work}>
          <Hammer size={28} strokeWidth={1.5} aria-hidden />
          <span className="work-label">{T.dashboard.work}</span>
          <span className="mono work-sub">{T.dashboard.workSub(fmtMoney(eco.workValue(s.workLevel)))}</span>
        </button>
        <p className="dim center mono small">{T.dashboard.clicks(fmtShort(s.stats.totalClicks))}</p>
      </Panel>

      {s.incidents.length > 0 || effects.siteDown ? (
        <div className="banner crit-bg" role="alert">
          <AlertTriangle size={16} strokeWidth={1.5} aria-hidden /> {T.dashboard.incidentBanner(s.incidents.length)}
        </div>
      ) : null}
      {activeEvent ? <div className="banner">{T.dashboard.marketEvent[activeEvent]}</div> : null}

      {throttle < 1 ? (
        <div className="banner warn-bg" role="alert">
          <AlertTriangle size={16} strokeWidth={1.5} aria-hidden />{' '}
          {T.dashboard.throttleWarn(throttle.toLocaleString('pt-BR'))} —{' '}
          {s.tempC.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} °C
        </div>
      ) : null}

      <Panel title={T.dashboard.incomeTitle}>
        <dl className="kv">
          {s.contracts.length > 0 ? (
            <>
              <dt>{T.dashboard.contracts}</dt>
              <dd className="mono ok">{fmtPerSec(contractsRev)}</dd>
            </>
          ) : null}
          <dt>{T.dashboard.adhoc}</dt>
          <dd className="mono ok">{fmtPerSec(adhoc)}</dd>
          <dt>
            {T.dashboard.energy}{' '}
            <span className="dim small">
              (PUE {cooling.pue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
            </span>
          </dt>
          <dd className="mono crit">{fmtPerSec(-energy)}</dd>
          {transit > 0 ? (
            <>
              <dt>{T.dashboard.transit}</dt>
              <dd className="mono crit">{fmtPerSec(-transit)}</dd>
            </>
          ) : null}
          {rent > 0 ? (
            <>
              <dt>{T.dashboard.rent}</dt>
              <dd className="mono crit">{fmtPerSec(-rent)}</dd>
            </>
          ) : null}
          {s.scrubbing ? (
            <>
              <dt>{T.dashboard.scrubbing}</dt>
              <dd className="mono crit">{fmtPerSec(-eco.scrubbingPerSec(true))}</dd>
            </>
          ) : null}
          <dt className="strong">{T.dashboard.net}</dt>
          <dd className={'mono strong ' + (net >= 0 ? 'ok' : 'crit')}>{fmtPerSec(net)}</dd>
        </dl>
      </Panel>

      <Panel title={T.dashboard.capacityTitle}>
        <div className="stat-grid">
          <div className="stat">
            <span className="dim">{T.dashboard.vcpu}</span>
            <span className="mono stat-value">{fmtShort(t.vcpu)}</span>
          </div>
          <div className="stat">
            <span className="dim">{T.dashboard.ram}</span>
            <span className="mono stat-value">{fmtShort(t.ramGb)} GB</span>
          </div>
          <div className="stat">
            <span className="dim">{T.dashboard.storage}</span>
            <span className="mono stat-value">{fmtShort(t.storageTb)} TB</span>
          </div>
          <div className="stat">
            <span className="dim">{T.dashboard.servers}</span>
            <span className="mono stat-value">{fmtShort(t.units)}</span>
          </div>
          <div className="stat">
            <span className="dim">{T.dashboard.reputation}</span>
            <span className="mono stat-value">{Math.round(s.reputation)}</span>
          </div>
          <div className="stat">
            <span className="dim">{T.dashboard.netScore}</span>
            <span className={'mono stat-value ' + (access.score < 90 ? 'crit' : access.score < 100 ? 'warn' : '')}>
              {access.score}%
            </span>
          </div>
          <div className="stat">
            <span className="dim">{T.dashboard.tempLabel}</span>
            <span className={'mono stat-value ' + (s.tempC >= 32 ? 'crit' : s.tempC >= 27 ? 'warn' : '')}>
              {s.tempC.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} °C
            </span>
          </div>
        </div>
        <RatioMeter label={T.dashboard.powerMeter} used={itKwOf(s) * 1000} max={feedKw(s.infra) * 1000} format={fmtWatts} />
      </Panel>

      <Panel title={T.dashboard.logTitle}>
        {s.log.length === 0 ? <p className="dim small">{T.dashboard.logEmpty}</p> : null}
        <ul className="log-list">
          {[...s.log].slice(-6).reverse().map((e, i) => (
            <li key={i} className="small mono">
              {e.text}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
