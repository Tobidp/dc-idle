import { useGame } from '../state/store'
import { T } from '../i18n/pt-BR'
import * as eco from '../engine/economy'
import { coolingStatus, feedKw, throttleMult } from '../engine/site'
import { fmtMoney, fmtPerSec, fmtShort, fmtWatts } from '../utils/format'
import { Panel } from './shared/Panel'
import { RatioMeter } from './shared/RatioMeter'
import { AlertTriangle, Hammer } from 'lucide-react'

export function Dashboard() {
  const builds = useGame((s) => s.builds)
  const equipment = useGame((s) => s.equipment)
  const infra = useGame((s) => s.infra)
  const tempC = useGame((s) => s.tempC)
  const workLevel = useGame((s) => s.workLevel)
  const totalClicks = useGame((s) => s.stats.totalClicks)
  const clickWork = useGame((s) => s.clickWork)

  const state = { builds, equipment, infra, tempC }
  const t = eco.totals(builds, equipment)
  const income = eco.incomePerSec(state)
  const energy = eco.energyCostPerSec(state)
  const rent = eco.rentPerSec(infra)
  const net = income - energy - rent
  const cooling = coolingStatus(infra, t.watts / 1000)
  const throttle = throttleMult(tempC)

  return (
    <div className="stack">
      <Panel>
        <button className="work-btn" onClick={clickWork} aria-label={T.dashboard.work}>
          <Hammer size={28} strokeWidth={1.5} aria-hidden />
          <span className="work-label">{T.dashboard.work}</span>
          <span className="mono work-sub">{T.dashboard.workSub(fmtMoney(eco.workValue(workLevel)))}</span>
        </button>
        <p className="dim center mono small">{T.dashboard.clicks(fmtShort(totalClicks))}</p>
      </Panel>

      {throttle < 1 ? (
        <div className="banner warn-bg" role="alert">
          <AlertTriangle size={16} strokeWidth={1.5} aria-hidden />{' '}
          {T.dashboard.throttleWarn(throttle.toLocaleString('pt-BR'))} —{' '}
          {tempC.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} °C
        </div>
      ) : null}

      <Panel title={T.dashboard.incomeTitle}>
        <dl className="kv">
          <dt>{T.dashboard.adhoc}</dt>
          <dd className="mono ok">{fmtPerSec(income)}</dd>
          <dt>
            {T.dashboard.energy} <span className="dim small">(PUE {cooling.pue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
          </dt>
          <dd className="mono crit">{fmtPerSec(-energy)}</dd>
          {rent > 0 ? (
            <>
              <dt>{T.dashboard.rent}</dt>
              <dd className="mono crit">{fmtPerSec(-rent)}</dd>
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
            <span className="dim">{T.dashboard.space}</span>
            <span className="mono stat-value">{fmtShort(t.u)}U</span>
          </div>
          <div className="stat">
            <span className="dim">{T.dashboard.tempLabel}</span>
            <span className={'mono stat-value ' + (tempC >= 32 ? 'crit' : tempC >= 27 ? 'warn' : '')}>
              {tempC.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} °C
            </span>
          </div>
        </div>
        <RatioMeter
          label={T.dashboard.powerMeter}
          used={t.watts}
          max={feedKw(infra) * 1000}
          format={fmtWatts}
        />
      </Panel>
    </div>
  )
}
