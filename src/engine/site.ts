// Site fisico (especificacao §7): alocacao em racks (FFD), cadeia eletrica
// (entrada -> UPS -> PDU), refrigeracao/termica e PUE calculado.

import { BAL } from '../data/balance'
import { CRAC, DEDICATED_CIRCUIT, PREMISES, RACKS, UPS } from '../data/infra'
import { computeBuild } from './build'
import { networkUnits } from './network'
import type { Build, EquipGroup, Infra, Network, SaveV4 } from './types'

export interface UnitItem {
  buildId: string
  u: number
  watts: number
}

export interface RackUsage {
  type: 'r42' | 'r48'
  u: number
  pduKw: number
  usedU: number
  usedKw: number
}

export interface Placement {
  ok: boolean
  racks: RackUsage[]
  benchUsedU: number
  benchU: number
  benchWatts: number
  /** Unidades sem lugar (so possivel em saves legados; nao bloqueia operacao). */
  unplaced: number
  /** Diagnostico quando ok=false na tentativa de compra. */
  failReason?: 'space' | 'pdu'
}

export function unitsOf(builds: Build[], equipment: EquipGroup[]): UnitItem[] {
  const byId = new Map(builds.map((b) => [b.id, b]))
  const items: UnitItem[] = []
  for (const g of equipment) {
    const b = byId.get(g.buildId)
    if (!b) continue
    const s = computeBuild(b.parts)
    for (let i = 0; i < g.count; i++) items.push({ buildId: b.id, u: s.uSize, watts: s.watts })
  }
  return items
}

/**
 * First-Fit Decreasing por consumo: racks 48U (PDU maior) primeiro, depois 42U,
 * por fim a bancada (sem PDU propria; limite eletrico e a entrada da instalacao).
 */
export function placeUnits(infra: Infra, items: UnitItem[]): Placement {
  const racks: RackUsage[] = []
  for (let i = 0; i < infra.racks48; i++)
    racks.push({ type: 'r48', u: RACKS.r48.u, pduKw: RACKS.r48.pduKw, usedU: 0, usedKw: 0 })
  for (let i = 0; i < infra.racks42; i++)
    racks.push({ type: 'r42', u: RACKS.r42.u, pduKw: RACKS.r42.pduKw, usedU: 0, usedKw: 0 })

  const benchU = PREMISES[infra.premises].benchU
  let benchUsedU = 0
  let benchWatts = 0
  let unplaced = 0
  let failReason: 'space' | 'pdu' | undefined

  const sorted = [...items].sort((a, b) => b.watts - a.watts)
  for (const it of sorted) {
    const rack = racks.find((r) => r.usedU + it.u <= r.u && r.usedKw + it.watts / 1000 <= r.pduKw + 1e-9)
    if (rack) {
      rack.usedU += it.u
      rack.usedKw += it.watts / 1000
      continue
    }
    if (benchUsedU + it.u <= benchU) {
      benchUsedU += it.u
      benchWatts += it.watts
      continue
    }
    unplaced++
    const uSomewhere =
      racks.some((r) => r.usedU + it.u <= r.u) || benchUsedU + it.u <= benchU
    failReason = uSomewhere ? 'pdu' : failReason ?? 'space'
  }

  return { ok: unplaced === 0, racks, benchUsedU, benchU, benchWatts, unplaced, failReason }
}

// ---------- Cadeia eletrica ----------

export function feedKw(infra: Infra): number {
  if (infra.premises === 'quarto')
    return infra.dedicatedCircuit ? DEDICATED_CIRCUIT.feedKw : PREMISES.quarto.feedKw
  return PREMISES.comercial.feedKw
}

export function upsCapacityKw(infra: Infra, modulesDown = 0): number {
  return Math.max(0, infra.upsModules - modulesDown) * UPS.moduleKw
}

// ---------- Refrigeracao, PUE e termica ----------

export interface CoolingStatus {
  heatKw: number
  ambientKw: number
  cracCapacityKw: number
  cracRemovedKw: number
  cracElecKw: number
  upsLossKw: number
  /** Fracao do calor nao removida (0..1). */
  deficitFrac: number
  pue: number
}

/** Calor = potencia eletrica IT (1 W eletrico ≈ 1 W termico; especificacao §5). */
export function coolingStatus(infra: Infra, itKw: number, cracDown = 0): CoolingStatus {
  const heatKw = itKw
  const ambientKw = PREMISES[infra.premises].ambientCoolKw
  const cracCapacityKw = Math.max(0, infra.cracUnits - cracDown) * CRAC.coolKw
  const beyondAmbient = Math.max(0, heatKw - ambientKw)
  const cracRemovedKw = Math.min(beyondAmbient, cracCapacityKw)
  const cracElecKw = cracRemovedKw / CRAC.cop
  const upsLossKw = infra.upsModules > 0 ? itKw * UPS.lossFraction : 0
  const deficitFrac = heatKw > 0 ? Math.max(0, heatKw - ambientKw - cracRemovedKw) / heatKw : 0
  const pue = itKw > 0 ? (itKw + cracElecKw + upsLossKw) / itKw : 1
  return { heatKw, ambientKw, cracCapacityKw, cracRemovedKw, cracElecKw, upsLossKw, deficitFrac, pue }
}

/** Integra a temperatura (°C): +1 °C/h por 10% de deficit; recuperacao fixa. dtHours = s reais. */
export function stepTemp(tempC: number, deficitFrac: number, dtHours: number): number {
  const th = BAL.thermal
  if (deficitFrac > 0) {
    return tempC + dtHours * deficitFrac * 10 * th.degPerHourPer10pctDeficit
  }
  return Math.max(th.baseTempC, tempC - dtHours * th.recoveryDegPerHour)
}

/** Multiplicador de desempenho por temperatura (throttle escalonado ate o M4). */
export function throttleMult(tempC: number): number {
  for (const band of BAL.thermal.bands) if (tempC >= band.minC) return band.mult
  return 1
}

// ---------- Fase (especificacao §3) ----------

export function phaseOf(infra: Infra, hasEquipment: boolean): 1 | 2 | 3 {
  const racks = infra.racks42 + infra.racks48
  if (racks >= 4 && infra.upsModules >= 1) return 3
  if (racks >= 1) return 2
  void hasEquipment
  return 1
}

// ---------- Visao consolidada ----------

export interface Totals {
  vcpu: number
  ramGb: number
  storageTb: number
  watts: number
  units: number
  u: number
}

export function totals(builds: Build[], equipment: EquipGroup[]): Totals {
  const byId = new Map(builds.map((b) => [b.id, b]))
  const t: Totals = { vcpu: 0, ramGb: 0, storageTb: 0, watts: 0, units: 0, u: 0 }
  for (const g of equipment) {
    const b = byId.get(g.buildId)
    if (!b) continue
    const s = computeBuild(b.parts)
    t.vcpu += s.vcpu * g.count
    t.ramGb += s.ramGb * g.count
    t.storageTb += s.storageTb * g.count
    t.watts += s.watts * g.count
    t.units += g.count
    t.u += s.uSize * g.count
  }
  return t
}

/** Servidores + equipamentos de rede (todos ocupam U e consomem W). */
export function allUnits(save: { builds: Build[]; equipment: EquipGroup[]; network: Network }): UnitItem[] {
  return [...unitsOf(save.builds, save.equipment), ...networkUnits(save.network)]
}

export function itKwOf(save: { builds: Build[]; equipment: EquipGroup[]; network: Network }): number {
  return allUnits(save).reduce((acc, it) => acc + it.watts, 0) / 1000
}

export interface SiteStatus {
  placement: Placement
  itKw: number
  feedKw: number
  upsKw: number
  cooling: CoolingStatus
  throttle: number
  phase: 1 | 2 | 3
}

export function siteStatus(save: Pick<SaveV4, 'builds' | 'equipment' | 'infra' | 'tempC' | 'network'>): SiteStatus {
  const items = allUnits(save)
  const itKw = items.reduce((acc, it) => acc + it.watts, 0) / 1000
  const placement = placeUnits(save.infra, items)
  return {
    placement,
    itKw,
    feedKw: feedKw(save.infra),
    upsKw: upsCapacityKw(save.infra),
    cooling: coolingStatus(save.infra, itKw),
    throttle: throttleMult(save.tempC),
    phase: phaseOf(save.infra, items.length > 0),
  }
}
