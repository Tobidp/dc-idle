import { useMemo, useState } from 'react'
import { useGame } from '../state/store'
import { T } from '../i18n/pt-BR'
import * as eco from '../engine/economy'
import { computeBuild, validateParts } from '../engine/build'
import type { ServerModel } from '../data/components'
import type { BuildParts } from '../engine/types'
import { fmtMoney, fmtWatts } from '../utils/format'

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i + 1)
}

export function Configurator(props: { model: ServerModel; onClose: () => void }) {
  const { model } = props
  const money = useGame((s) => s.money)
  const builds = useGame((s) => s.builds)
  const equipment = useGame((s) => s.equipment)
  const infra = useGame((s) => s.infra)
  const tempC = useGame((s) => s.tempC)
  const buyBuild = useGame((s) => s.buyBuild)

  const [parts, setParts] = useState<BuildParts>({
    modelId: model.id,
    cpuId: model.cpuOptions[0].id,
    cpuCount: 1,
    dimmId: model.dimmOptions[0].id,
    dimmCount: Math.min(4, model.dimmSlots),
    nicId: model.nicOptions[0].id,
    psuCount: 1,
    nvmeId: null,
    nvmeCount: 0,
  })

  const upd = (patch: Partial<BuildParts>) => setParts((p) => ({ ...p, ...patch }))

  const valid = validateParts(parts).length === 0
  const stats = useMemo(() => (valid ? computeBuild(parts) : null), [parts, valid])
  const check = eco.canBuyBuild({ money, builds, equipment, infra, tempC }, parts)
  const reason = check.reason ? T.shop.reasons[check.reason] : null

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={T.configurator.title(model.name)}>
      <div className="overlay-card cfg-card">
        <h2 className="panel-title">{T.configurator.title(model.name)}</h2>
        <p className="dim small">{model.note}</p>

        <div className="cfg-grid">
          <label className="field">
            <span className="dim small">{T.configurator.cpu}</span>
            <select value={parts.cpuId} onChange={(e) => upd({ cpuId: e.target.value })}>
              {model.cpuOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} · {fmtWatts(c.watts)} · {fmtMoney(c.price)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="dim small">{T.configurator.cpuCount}</span>
            <select value={parts.cpuCount} onChange={(e) => upd({ cpuCount: Number(e.target.value) })}>
              {range(model.sockets).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="dim small">{T.configurator.dimm}</span>
            <select value={parts.dimmId} onChange={(e) => upd({ dimmId: e.target.value })}>
              {model.dimmOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label} · {fmtMoney(d.price)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="dim small">
              {T.configurator.dimmCount} (1–{model.dimmSlots})
            </span>
            <select value={parts.dimmCount} onChange={(e) => upd({ dimmCount: Number(e.target.value) })}>
              {range(model.dimmSlots).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="dim small">{T.configurator.nic}</span>
            <select value={parts.nicId} onChange={(e) => upd({ nicId: e.target.value })}>
              {model.nicOptions.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                  {n.price > 0 ? ` · +${fmtMoney(n.price)}` : ''}
                </option>
              ))}
            </select>
          </label>

          {model.psu2 ? (
            <label className="field field-check">
              <input
                type="checkbox"
                checked={parts.psuCount === 2}
                onChange={(e) => upd({ psuCount: e.target.checked ? 2 : 1 })}
              />
              <span className="small">
                {T.configurator.psu2} (+{fmtMoney(model.psu2.price)})
              </span>
            </label>
          ) : null}

          {model.nvmeOptions.length > 0 ? (
            <>
              <label className="field">
                <span className="dim small">{T.configurator.nvme}</span>
                <select
                  value={parts.nvmeId ?? ''}
                  onChange={(e) => {
                    const id = e.target.value || null
                    upd({ nvmeId: id, nvmeCount: id ? Math.max(1, parts.nvmeCount) : 0 })
                  }}
                >
                  <option value="">{T.configurator.none}</option>
                  {model.nvmeOptions.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label} · {fmtMoney(n.price)}
                    </option>
                  ))}
                </select>
              </label>
              {parts.nvmeId ? (
                <label className="field">
                  <span className="dim small">
                    {T.configurator.nvmeCount} (1–{model.nvmeSlots})
                  </span>
                  <select
                    value={parts.nvmeCount}
                    onChange={(e) => upd({ nvmeCount: Number(e.target.value) })}
                  >
                    {range(model.nvmeSlots).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </>
          ) : null}
        </div>

        {stats ? (
          <dl className="kv small cfg-summary">
            <dt>{T.configurator.summary}</dt>
            <dd className="mono">
              {stats.vcpu} vCPU · {stats.ramGb} GB
              {stats.storageTb > 0 ? ` · ${stats.storageTb} TB` : ''} · {fmtWatts(stats.watts)} ·{' '}
              {stats.uSize}U
            </dd>
            <dt>{T.configurator.price}</dt>
            <dd className="mono price">{fmtMoney(check.price)}</dd>
          </dl>
        ) : null}

        <div className="row">
          <button className="btn" disabled={!check.ok} onClick={() => buyBuild(parts)}>
            {T.shop.buy}
          </button>
          <button className="btn" onClick={props.onClose}>
            {T.configurator.cancel}
          </button>
          {reason ? <span className="small warn">{reason}</span> : null}
        </div>
      </div>
    </div>
  )
}
