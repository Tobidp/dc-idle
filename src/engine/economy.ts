// Engine economica pura (sem React). M2: renda com throttle termico, conta de
// energia com PUE calculado, aluguel da instalacao e bloqueios fisicos de compra.

import { BAL } from '../data/balance'
import { CRAC, PREMISES, RACKS, UPS } from '../data/infra'
import { computeBuild, makeBuild, validateParts } from './build'
import {
  coolingStatus,
  feedKw,
  placeUnits,
  throttleMult,
  unitsOf,
  upsCapacityKw,
} from './site'
import type { Build, BuildParts, EquipGroup, Infra, SaveV2 } from './types'

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

type EcoState = Pick<SaveV2, 'builds' | 'equipment' | 'infra' | 'tempC'>

/** Renda avulsa ($/s real) com throttle termico aplicado. */
export function incomePerSec(state: EcoState): number {
  const base = (totals(state.builds, state.equipment).vcpu * BAL.adhocPerVcpuMonth) / BAL.monthSeconds
  return base * throttleMult(state.tempC)
}

/** Conta de energia ($/s real) = (IT + CRAC + perdas UPS) × tarifa = IT × PUE × tarifa. */
export function energyCostPerSec(state: EcoState): number {
  const itKw = totals(state.builds, state.equipment).watts / 1000
  const c = coolingStatus(state.infra, itKw)
  return (itKw + c.cracElecKw + c.upsLossKw) * BAL.energyTariffPerKwh
}

export function rentPerSec(infra: Infra): number {
  return PREMISES[infra.premises].rentMonth / BAL.monthSeconds
}

export function netPerSec(state: EcoState): number {
  return incomePerSec(state) - energyCostPerSec(state) - rentPerSec(state.infra)
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

export function canBuyBuild(state: Pick<SaveV2, 'money'> & EcoState, parts: BuildParts): BuyCheck {
  if (validateParts(parts).length > 0) return { ok: false, price: 0, reason: 'invalid' }
  const price = buildPrice(state, parts)
  const stats = computeBuild(parts)

  // Alocacao hipotetica (U + PDU por rack)
  const items = unitsOf(state.builds, state.equipment)
  items.push({ buildId: '_novo', u: stats.uSize, watts: stats.watts })
  const placed = placeUnits(state.infra, items)
  if (!placed.ok) return { ok: false, price, reason: placed.failReason ?? 'space' }

  // Entrada da instalacao e teto do UPS (especificacao §7, regras 1-2)
  const itKw = (totals(state.builds, state.equipment).watts + stats.watts) / 1000
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

export type InfraKind = 'comercial' | 'dedicated' | 'r42' | 'r48' | 'ups' | 'crac'

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
  }
}

export function canBuyInfra(state: Pick<SaveV2, 'money' | 'infra'>, kind: InfraKind): InfraCheck {
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
  }
}
