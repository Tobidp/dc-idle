// Tipos do estado persistido. Schema v2 (M2): builds configuraveis + infraestrutura fisica.
// Migracao v1 -> v2 em state/persistence.ts.

import type { ModelId } from '../data/components'

export interface BuildParts {
  modelId: ModelId
  cpuId: string
  cpuCount: number
  dimmId: string
  dimmCount: number
  nicId: string
  psuCount: 1 | 2
  nvmeId: string | null
  nvmeCount: number
}

export interface Build {
  id: string
  parts: BuildParts
}

export interface EquipGroup {
  buildId: string
  count: number
}

export type PremisesId = 'quarto' | 'comercial'

export interface Infra {
  premises: PremisesId
  /** Circuito dedicado (so no quarto): eleva a entrada de 1,2 kW para 7 kW. */
  dedicatedCircuit: boolean
  racks42: number
  racks48: number
  upsModules: number
  cracUnits: number
}

export interface Stats {
  totalClicks: number
  totalEarned: number
  totalSpent: number
}

export interface SaveV2 {
  version: 2
  createdTs: number
  lastTs: number
  seed: number
  money: number
  lifetimeProfit: number
  workLevel: number
  builds: Build[]
  equipment: EquipGroup[]
  infra: Infra
  /** Temperatura virtual do site (°C). Congelada offline. */
  tempC: number
  stats: Stats
}

export function newInfra(): Infra {
  return { premises: 'quarto', dedicatedCircuit: false, racks42: 0, racks48: 0, upsModules: 0, cracUnits: 0 }
}

export function newSave(now: number, seed: number): SaveV2 {
  return {
    version: 2,
    createdTs: now,
    lastTs: now,
    seed,
    money: 0,
    lifetimeProfit: 0,
    workLevel: 0,
    builds: [],
    equipment: [],
    infra: newInfra(),
    tempC: 22,
    stats: { totalClicks: 0, totalEarned: 0, totalSpent: 0 },
  }
}
