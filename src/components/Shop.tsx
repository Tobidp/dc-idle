import { useState } from 'react'
import { useGame } from '../state/store'
import { T } from '../i18n/pt-BR'
import * as eco from '../engine/economy'
import { computeBuild, buildLabel } from '../engine/build'
import { MODELS, modelById, type ServerModel } from '../data/components'
import { PREMISES } from '../data/infra'
import { BAL } from '../data/balance'
import { fmtMoney, fmtWatts } from '../utils/format'
import { Panel } from './shared/Panel'
import { Configurator } from './Configurator'
import { Building2, Server, TrendingUp, Wrench } from 'lucide-react'

function WorkUpgradeCard() {
  const money = useGame((s) => s.money)
  const workLevel = useGame((s) => s.workLevel)
  const buyWorkUpgrade = useGame((s) => s.buyWorkUpgrade)
  const cost = eco.workUpgradeCost(workLevel)
  const ok = money >= cost
  return (
    <article className="card">
      <header className="card-head">
        <TrendingUp size={18} strokeWidth={1.5} aria-hidden />
        <h3 className="card-title">{T.shop.workCard}</h3>
        <span className="mono badge">{T.shop.level(workLevel)}</span>
      </header>
      <p className="dim small">{T.shop.workDesc}</p>
      <dl className="kv small">
        <dt>{T.dashboard.work}</dt>
        <dd className="mono">
          {fmtMoney(eco.workValue(workLevel))} → <span className="ok">{fmtMoney(eco.workValue(workLevel + 1))}</span>
        </dd>
      </dl>
      <div className="card-buy">
        <span className="mono price">{fmtMoney(cost)}</span>
        <button className="btn" disabled={!ok} onClick={buyWorkUpgrade}>
          {T.shop.buy}
        </button>
      </div>
      {!ok ? <p className="small warn">{T.shop.reasons.money}</p> : null}
    </article>
  )
}

function ModelCard(props: { model: ServerModel; onConfigure: () => void }) {
  const builds = useGame((s) => s.builds)
  const equipment = useGame((s) => s.equipment)
  const owned = eco.countOfModel(builds, equipment, props.model.id)
  return (
    <article className="card">
      <header className="card-head">
        <Server size={18} strokeWidth={1.5} aria-hidden />
        <h3 className="card-title">{props.model.name}</h3>
        {owned > 0 ? <span className="mono badge">{T.shop.owned(owned)}</span> : null}
      </header>
      <p className="dim small">{props.model.note}</p>
      <div className="card-buy">
        <span className="mono price">{fmtMoney(props.model.chassisPrice)}+</span>
        <button className="btn" onClick={props.onConfigure}>
          {T.shop.configure}
        </button>
      </div>
    </article>
  )
}

function SavedBuildCard(props: { buildId: string }) {
  const store = useGame()
  const build = store.builds.find((b) => b.id === props.buildId)
  if (!build) return null
  const stats = computeBuild(build.parts)
  const count = store.equipment.find((g) => g.buildId === build.id)?.count ?? 0
  const check = eco.canBuyBuild(store, build.parts)
  const incomeMonth = stats.vcpu * BAL.adhocPerVcpuMonth
  const reason = check.reason ? T.shop.reasons[check.reason] : null
  return (
    <article className="card">
      <header className="card-head">
        <Server size={18} strokeWidth={1.5} aria-hidden />
        <h3 className="card-title">{buildLabel(build.parts)}</h3>
        <span className="mono badge">{T.shop.owned(count)}</span>
      </header>
      <dl className="kv small">
        <dt>{T.dashboard.vcpu}</dt>
        <dd className="mono">{stats.vcpu}</dd>
        <dt>{T.dashboard.energy}</dt>
        <dd className="mono">{fmtWatts(stats.watts)} · {stats.uSize}U</dd>
        <dt>{T.dashboard.adhoc}</dt>
        <dd className="mono ok">{fmtMoney(incomeMonth)}{T.shop.perMonth}</dd>
      </dl>
      <div className="card-buy">
        <span className="mono price">{fmtMoney(check.price)}</span>
        <button className="btn" disabled={!check.ok} onClick={() => store.buyBuild(build.parts)}>
          {T.shop.buy}
        </button>
      </div>
      {reason ? <p className="small warn">{reason}</p> : null}
    </article>
  )
}

function InfraCard(props: {
  kind: eco.InfraKind
  title: string
  desc: string
  ownedLabel?: string
  activeLabel?: string
}) {
  const store = useGame()
  const check = eco.canBuyInfra(store, props.kind)
  const reason = check.reason && check.reason !== 'na' ? T.shop.reasons[check.reason] : null
  return (
    <article className="card">
      <header className="card-head">
        <Building2 size={18} strokeWidth={1.5} aria-hidden />
        <h3 className="card-title">{props.title}</h3>
        {props.ownedLabel ? <span className="mono badge">{props.ownedLabel}</span> : null}
      </header>
      <p className="dim small">{props.desc}</p>
      <div className="card-buy">
        <span className="mono price">{fmtMoney(check.price)}</span>
        {props.activeLabel ? (
          <span className="small ok">{props.activeLabel}</span>
        ) : (
          <button className="btn" disabled={!check.ok} onClick={() => store.buyInfra(props.kind)}>
            {T.shop.buy}
          </button>
        )}
      </div>
      {reason && !props.activeLabel ? <p className="small warn">{reason}</p> : null}
    </article>
  )
}

export function Shop() {
  const [configuring, setConfiguring] = useState<string | null>(null)
  const infra = useGame((s) => s.infra)
  const equipment = useGame((s) => s.equipment)
  const model = configuring ? modelById[configuring] : null

  return (
    <div className="stack">
      <Panel title={T.shop.title}>
        <div className="card-grid">
          <WorkUpgradeCard />
          {MODELS.map((m) => (
            <ModelCard key={m.id} model={m} onConfigure={() => setConfiguring(m.id)} />
          ))}
        </div>
        <p className="dim small">{T.shop.adhocNote}</p>
      </Panel>

      {equipment.length > 0 ? (
        <Panel title={T.shop.savedBuilds}>
          <div className="card-grid">
            {equipment.map((g) => (
              <SavedBuildCard key={g.buildId} buildId={g.buildId} />
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel title={T.shop.infraTitle}>
        <div className="card-grid">
          <InfraCard
            kind="comercial"
            title={T.shop.infra.comercial}
            desc={T.shop.infra.comercialDesc(fmtMoney(PREMISES.comercial.rentMonth))}
            activeLabel={infra.premises === 'comercial' ? T.shop.infra.active : undefined}
          />
          {infra.premises === 'quarto' ? (
            <InfraCard
              kind="dedicated"
              title={T.shop.infra.dedicated}
              desc={T.shop.infra.dedicatedDesc}
              activeLabel={infra.dedicatedCircuit ? T.shop.infra.active : undefined}
            />
          ) : null}
          <InfraCard kind="r42" title={T.shop.infra.r42} desc={T.shop.infra.r42Desc} ownedLabel={T.shop.owned(infra.racks42)} />
          <InfraCard kind="r48" title={T.shop.infra.r48} desc={T.shop.infra.r48Desc} ownedLabel={T.shop.owned(infra.racks48)} />
          <InfraCard kind="ups" title={T.shop.infra.ups} desc={T.shop.infra.upsDesc} ownedLabel={T.shop.owned(infra.upsModules)} />
          <InfraCard kind="crac" title={T.shop.infra.crac} desc={T.shop.infra.cracDesc} ownedLabel={T.shop.owned(infra.cracUnits)} />
        </div>
        <p className="dim small">
          <Wrench size={13} strokeWidth={1.5} aria-hidden /> {PREMISES[infra.premises].label}:{' '}
          {PREMISES[infra.premises].rackSlots} vaga(s) de rack · bancada {PREMISES[infra.premises].benchU}U
        </p>
      </Panel>

      {model ? <Configurator model={model} onClose={() => setConfiguring(null)} /> : null}
    </div>
  )
}
