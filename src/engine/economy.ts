// Engine economica pura (sem React). M2: renda com throttle termico, conta de
// energia com PUE calculado, aluguel da instalacao e bloqueios fisicos de compra.

import { BAL } from '../data/balance'
import { CRAC, PREMISES, RACKS, UPS } from '../data/infra'
import { FIREWALLS, ROUTERS, SWITCHES, type FirewallModelId, type RouterModelId, type SwitchModelId } from '../data/network'
import { computeBuild, makeBuild, validateParts } from './build'
import { allocOf, contractsStatus } from './contracts'
import { NO_EFFECTS, type Effects } from './world'
import { wanStatus } from './network'
import {
  allUnits,
  coolingStatus,
  feedKw,
  itKwOf,
  placeUnits,
  throttleMult,
  totals,
  upsCapacityKw,
} from './site'
import type { Build, BuildParts, EquipGroup, Infra, LinkCounts, Network, SaveV4 } from './types'

export { totals, type Totals } from './site'

type EcoState = Pick<SaveV4, 'builds' | 'equipment' | 'infra' | 'tempC' | 'network' | 'contracts'> & { scrubbing?: boolean }

/** Renda avulsa ($/s real): so a capacidade ociosa (vCPU nao alocada), com throttle. */
export function adhocPerSec(state: EcoState, effects: Effects = NO_EFFECTS): number {
  if (effects.siteDown) return 0
  const idleVcpu = Math.max(0, totals(state.builds, state.equipment).vcpu - allocOf(state.contracts).vcpu)
  return ((idleVcpu * BAL.adhocPerVcpuMonth) / BAL.monthSeconds) * throttleMult(state.tempC)
}

/** Receita de contratos ($/s real), ja com qualidade (throttle x score x incidentes). */
export function contractsPerSec(state: EcoState, effects: Effects = NO_EFFECTS): number {
  return contractsStatus(state, effects).revenuePerSec
}

export function incomePerSec(state: EcoState, effects: Effects = NO_EFFECTS): number {
  return adhocPerSec(state, effects) + contractsPerSec(state, effects)
}

/** Assinatura de scrubbing ($/s real). */
export function scrubbingPerSec(scrubbing: boolean): number {
  return scrubbing ? BAL.scrubbingMonthly / BAL.monthSeconds : 0
}

/** Conta de energia ($/s real) = (IT + CRAC + perdas UPS) × tarifa = IT × PUE × tarifa. */
export function energyCostPerSec(state: EcoState, effects: Effects = NO_EFFECTS): number {
  if (effects.siteDown || effects.generatorRunning) return 0 // fora da rede da concessionaria
  const itKw = itKwOf(state)
  const c = coolingStatus(state.infra, itKw)
  return (itKw + c.cracElecKw + c.upsLossKw) * BAL.energyTariffPerKwh
}

export function rentPerSec(infra: Infra): number {
  return PREMISES[infra.premises].rentMonth / BAL.monthSeconds
}

/** Transito WAN ($/s real) sobre a capacidade contratada de links. */
export function transitPerSec(network: Network): number {
  return wanStatus(network).transitPerSec
}

export function netPerSec(state: EcoState, effects: Effects = NO_EFFECTS): number {
  return (
    incomePerSec(state, effects) -
    energyCostPerSec(state, effects) -
    rentPerSec(state.infra) -
    transitPerSec(state.network) -
    scrubbingPerSec(state.scrubbing ?? false)
  )
}

// ---------- Work ----------

export function workValue(level: number): number {
  return BAL.work.baseValue * BAL.work.valueGrowth ** level
}

export function workUpgradeCost(level: number): number {
  return Math.round(BAL.work.upgradeBaseCost * BAL.work.costGrowth ** level)
}

// ---------- Compras de servidores (builds) ----------

export function countOfModel(builds: Build[], equipment: EquipGroup[], modelId: string): number {
  const byId = new Map(builds.map((b) => [b.id, b]))
  let n = 0
  for (const g of equipment) {
    const b = byId.get(g.buildId)
    if (b && b.parts.modelId === modelId) n += g.count
  }
  return n
}

/** Preco da proxima unidade: composicao × g^(unidades do MESMO modelo) (§19). */
export function buildPrice(state: EcoState, parts: BuildParts): number {
  const owned = countOfModel(state.builds, state.equipment, parts.modelId)
  return Math.round(computeBuild(parts).price * BAL.equipCostGrowth ** owned)
}

export type BuyDenied = 'invalid' | 'money' | 'space' | 'pdu' | 'feed' | 'ups'

export interface BuyCheck {
  ok: boolean
  price: number
  reason?: BuyDenied
}

export function canBuyBuild(state: Pick<SaveV4, 'money'> & EcoState, parts: BuildParts): BuyCheck {
  if (validateParts(parts).length > 0) return { ok: false, price: 0, reason: 'invalid' }
  const price = buildPrice(state, parts)
  const stats = computeBuild(parts)

  // Alocacao hipotetica (U + PDU por rack)
  const items = allUnits(state)
  items.push({ buildId: '_novo', u: stats.uSize, watts: stats.watts })
  const placed = placeUnits(state.infra, items)
  if (!placed.ok) return { ok: false, price, reason: placed.failReason ?? 'space' }

  // Entrada da instalacao e teto do UPS (especificacao §7, regras 1-2)
  const itKw = itKwOf(state) + stats.watts / 1000
  if (itKw > feedKw(state.infra) + 1e-9) return { ok: false, price, reason: 'feed' }
  const upsKw = upsCapacityKw(state.infra)
  if (upsKw > 0 && itKw > upsKw + 1e-9) return { ok: false, price, reason: 'ups' }

  if (state.money < price) return { ok: false, price, reason: 'money' }
  return { ok: true, price }
}

export function applyBuyBuild(
  builds: Build[],
  equipment: EquipGroup[],
  parts: BuildParts,
): { builds: Build[]; equipment: EquipGroup[] } {
  const build = makeBuild(parts)
  const nextBuilds = builds.some((b) => b.id === build.id) ? builds : [...builds, build]
  const idx = equipment.findIndex((g) => g.buildId === build.id)
  const nextEquipment =
    idx === -1
      ? [...equipment, { buildId: build.id, count: 1 }]
      : equipment.map((g, i) => (i === idx ? { ...g, count: g.count + 1 } : g))
  return { builds: nextBuilds, equipment: nextEquipment }
}

/** Remove grupos orfaos/zerados e builds sem referencia (saneamento no load). */
export function sanitize(builds: Build[], equipment: EquipGroup[]): { builds: Build[]; equipment: EquipGroup[] } {
  const validBuilds = builds.filter((b) => validateParts(b.parts).length === 0)
  const ids = new Set(validBuilds.map((b) => b.id))
  const eq = equipment.filter((g) => ids.has(g.buildId) && g.count > 0)
  const used = new Set(eq.map((g) => g.buildId))
  return { builds: validBuilds.filter((b) => used.has(b.id)), equipment: eq }
}

// ---------- Compras de infraestrutura ----------

export type InfraKind = 'comercial' | 'dedicated' | 'r42' | 'r48' | 'ups' | 'crac' | 'gen'

export type InfraDenied = 'money' | 'premises' | 'limit' | 'na'

export interface InfraCheck {
  ok: boolean
  price: number
  reason?: InfraDenied
}

export function infraPrice(kind: InfraKind): number {
  switch (kind) {
    case 'comercial':
      return PREMISES.comercial.price
    case 'dedicated':
      return 1500
    case 'r42':
      return RACKS.r42.price
    case 'r48':
      return RACKS.r48.price
    case 'ups':
      return UPS.modulePrice
    case 'crac':
      return CRAC.price
    case 'gen':
      return BAL.generatorPrice
  }
}

export function canBuyInfra(state: Pick<SaveV4, 'money' | 'infra'>, kind: InfraKind): InfraCheck {
  const price = infraPrice(kind)
  const { infra } = state
  const rackSlots = PREMISES[infra.premises].rackSlots
  const racks = infra.racks42 + infra.racks48

  let reason: InfraDenied | undefined
  switch (kind) {
    case 'comercial':
      if (infra.premises === 'comercial') reason = 'na'
      break
    case 'dedicated':
      if (infra.premises !== 'quarto' || infra.dedicatedCircuit) reason = 'na'
      break
    case 'r42':
    case 'r48':
      if (racks >= rackSlots) reason = 'limit'
      break
    case 'ups':
      if (infra.premises !== 'comercial') reason = 'premises'
      else if (infra.upsModules >= UPS.maxModules) reason = 'limit'
      break
    case 'crac':
      if (infra.premises !== 'comercial') reason = 'premises'
      else if (infra.cracUnits >= CRAC.maxUnits) reason = 'limit'
      break
    case 'gen':
      if (infra.premises !== 'comercial') reason = 'premises'
      else if (infra.generator >= 1) reason = 'limit'
      break
  }
  if (!reason && state.money < price) reason = 'money'
  return { ok: !reason, price, reason }
}

export function applyBuyInfra(infra: Infra, kind: InfraKind): Infra {
  switch (kind) {
    case 'comercial':
      return { ...infra, premises: 'comercial', dedicatedCircuit: false }
    case 'dedicated':
      return { ...infra, dedicatedCircuit: true }
    case 'r42':
      return { ...infra, racks42: infra.racks42 + 1 }
    case 'r48':
      return { ...infra, racks48: infra.racks48 + 1 }
    case 'ups':
      return { ...infra, upsModules: infra.upsModules + 1 }
    case 'crac':
      return { ...infra, cracUnits: infra.cracUnits + 1 }
    case 'gen':
      return { ...infra, generator: infra.generator + 1 }
  }
}

// ---------- Compras de rede (M3) ----------

export type NetPurchase =
  | { t: 'switch'; model: SwitchModelId; uplinks: number; lacp: boolean }
  | { t: 'router'; model: RouterModelId }
  | { t: 'firewall'; model: FirewallModelId }

function netUnitSpec(p: NetPurchase): { price: number; watts: number; u: number; modelKey: string } {
  switch (p.t) {
    case 'switch': {
      const s = SWITCHES[p.model]
      return { price: s.price, watts: s.watts, u: s.u, modelKey: `sw:${p.model}` }
    }
    case 'router': {
      const r = ROUTERS[p.model]
      return { price: r.price, watts: r.watts, u: r.u, modelKey: `rt:${p.model}` }
    }
    case 'firewall': {
      const f = FIREWALLS[p.model]
      return { price: f.price, watts: f.watts, u: f.u, modelKey: `fw:${p.model}` }
    }
  }
}

function ownedNetModel(network: Network, p: NetPurchase): number {
  if (p.t === 'switch')
    return network.switches.filter((g) => g.model === p.model).reduce((a, g) => a + g.count, 0)
  if (p.t === 'router') return network.routers[p.model]
  return network.firewalls[p.model]
}

export function netPrice(state: EcoState, p: NetPurchase): number {
  const spec = netUnitSpec(p)
  return Math.round(spec.price * BAL.equipCostGrowth ** ownedNetModel(state.network, p))
}

export function canBuyNet(state: Pick<SaveV4, 'money'> & EcoState, p: NetPurchase): BuyCheck {
  if (p.t === 'switch') {
    const s = SWITCHES[p.model]
    if (!Number.isInteger(p.uplinks) || p.uplinks < 1 || p.uplinks > s.uplinkPorts)
      return { ok: false, price: 0, reason: 'invalid' }
  }
  const spec = netUnitSpec(p)
  const price = netPrice(state, p)

  const items = allUnits(state)
  items.push({ buildId: spec.modelKey, u: spec.u, watts: spec.watts })
  const placed = placeUnits(state.infra, items)
  if (!placed.ok) return { ok: false, price, reason: placed.failReason ?? 'space' }

  const itKw = itKwOf(state) + spec.watts / 1000
  if (itKw > feedKw(state.infra) + 1e-9) return { ok: false, price, reason: 'feed' }
  const upsKw = upsCapacityKw(state.infra)
  if (upsKw > 0 && itKw > upsKw + 1e-9) return { ok: false, price, reason: 'ups' }

  if (state.money < price) return { ok: false, price, reason: 'money' }
  return { ok: true, price }
}

export function applyBuyNet(network: Network, p: NetPurchase): Network {
  if (p.t === 'switch') {
    const idx = network.switches.findIndex(
      (g) => g.model === p.model && g.uplinks === p.uplinks && g.lacp === p.lacp,
    )
    const switches =
      idx === -1
        ? [...network.switches, { model: p.model, uplinks: p.uplinks, lacp: p.lacp, count: 1 }]
        : network.switches.map((g, i) => (i === idx ? { ...g, count: g.count + 1 } : g))
    return { ...network, switches }
  }
  if (p.t === 'router') return { ...network, routers: { ...network.routers, [p.model]: network.routers[p.model] + 1 } }
  return { ...network, firewalls: { ...network.firewalls, [p.model]: network.firewalls[p.model] + 1 } }
}

/** Links WAN: sem custo de ativacao (parametro de jogo); custo e o transito mensal. */
export function setLink(links: LinkCounts, size: keyof LinkCounts, delta: 1 | -1): LinkCounts {
  return { ...links, [size]: Math.max(0, links[size] + delta) }
}
