import { useGame } from '../state/store'
import { T } from '../i18n/pt-BR'
import { canAccept, contractsStatus } from '../engine/contracts'
import { effectsAt } from '../engine/world'
import { contractById, type ContractType } from '../data/contracts'
import { fmtGameTime, fmtMoney } from '../utils/format'
import { Panel } from './shared/Panel'
import { RatioMeter } from './shared/RatioMeter'
import { FileText, ShieldCheck, Wifi } from 'lucide-react'

const pct = (n: number) =>
  `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`

function ReqChips(props: { c: ContractType }) {
  const r = props.c.requires
  const chips: string[] = []
  if (r.firewall) chips.push(T.contracts.req.firewall)
  if (r.vlan) chips.push(T.contracts.req.vlan)
  if (r.tierMin) chips.push(T.contracts.req.tier(r.tierMin))
  if (r.cert) chips.push(T.contracts.req.cert)
  if (props.c.netSensitive) chips.push(T.contracts.netSensitive)
  if (chips.length === 0) return <span className="dim small">—</span>
  return (
    <span className="chip-row">
      {chips.map((c) => (
        <span key={c} className="mono badge">
          {c}
        </span>
      ))}
    </span>
  )
}

export function ContractsTab() {
  const s = useGame()
  const effects = effectsAt(s, s.lastTs)
  const st = contractsStatus(s, effects)

  return (
    <div className="stack">
      <Panel title={T.contracts.title}>
        {st.active.length === 0 ? <p className="dim small">{T.contracts.none}</p> : null}
        <div className="card-grid">
          {st.active.map((a) => (
            <article className="card" key={a.index}>
              <header className="card-head">
                <FileText size={18} strokeWidth={1.5} aria-hidden />
                <h3 className="card-title">{a.type.name}</h3>
                {a.type.netSensitive ? <Wifi size={14} strokeWidth={1.5} aria-hidden /> : null}
              </header>
              <dl className="kv small">
                <dt>{T.contracts.quality}</dt>
                <dd className={'mono ' + (a.quality < 0.9 ? 'crit' : a.quality < 1 ? 'warn' : 'ok')}>
                  {pct(a.quality)}
                </dd>
                <dt>{T.contracts.effective}</dt>
                <dd className="mono ok">
                  {fmtMoney(a.revenuePerSec * 720)}
                  {T.shop.perMonth}
                </dd>
              </dl>
              <p className="dim small mono">
                {T.contracts.resources(a.type.vcpu, a.type.ramGb, a.type.tb, a.type.gbps)}
              </p>
              <dl className="kv small">
                <dt>{T.contracts.window}</dt>
                <dd className="mono">
                  {a.inst.winSec > 0
                    ? ((a.inst.upSec / a.inst.winSec) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
                    : '100'}
                  % · {Math.round(a.inst.winSec)}/720 s
                </dd>
              </dl>
              <div className="card-buy">
                <span className="dim small">
                  {T.contracts.sla} {a.type.slaPct.toLocaleString('pt-BR')}% ·{' '}
                  {T.contracts.remaining(Math.max(0, (a.inst.endTs - s.lastTs) / 720000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }))}
                </span>
                <button className="btn" onClick={() => s.cancelContract(a.index)}>
                  {T.contracts.cancel}
                </button>
              </div>
            </article>
          ))}
        </div>

        <RatioMeter
          label={`${T.dashboard.vcpu} (${T.contracts.allocTitle.toLowerCase()})`}
          used={st.alloc.vcpu}
          max={Math.max(st.pool.vcpu, 0.001)}
          format={(n) => `${Math.round(n)}`}
        />
        <RatioMeter
          label="Gbps"
          used={st.alloc.gbps}
          max={Math.max(st.wan.egressGbps, 0.001)}
          format={(n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
        />
        <p className="dim small">{T.contracts.poolHint}</p>
      </Panel>

      <Panel title={T.contracts.available}>
        <p className="dim small">{T.contracts.marketHint(Math.round(s.reputation))}</p>
        {s.offers.length === 0 ? <p className="dim small">{T.contracts.noOffers}</p> : null}
        <div className="card-grid">
          {s.offers.map((o) => {
            const c = contractById[o.type]
            if (!c) return null
            const check = canAccept(s, c.id)
            const reason = check.reason ? T.contracts.reasons[check.reason] : null
            const ttl = Math.max(0, Math.round((o.expiresTs - s.lastTs) / 1000))
            return (
              <article className="card" key={o.id}>
                <header className="card-head">
                  <ShieldCheck size={18} strokeWidth={1.5} aria-hidden />
                  <h3 className="card-title">{c.name}</h3>
                  <span className="mono badge">{T.contracts.duration(o.durationMonths)}</span>
                </header>
                <dl className="kv small">
                  <dt>{T.contracts.sla}</dt>
                  <dd className="mono">{c.slaPct.toLocaleString('pt-BR')}%</dd>
                  <dt>{T.contracts.needs}</dt>
                  <dd>
                    <ReqChips c={c} />
                  </dd>
                </dl>
                <p className="dim small mono">{T.contracts.resources(c.vcpu, c.ramGb, c.tb, c.gbps)}</p>
                <div className="card-buy">
                  <span className="mono price ok">
                    {fmtMoney(o.monthly)}
                    {T.shop.perMonth}
                  </span>
                  <button className="btn" disabled={!check.ok} onClick={() => s.acceptOffer(o.id)}>
                    {T.contracts.accept}
                  </button>
                </div>
                <p className="dim small mono">{T.contracts.expires(fmtGameTime(ttl))}</p>
                {reason ? <p className="small warn">{reason}</p> : null}
              </article>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}
