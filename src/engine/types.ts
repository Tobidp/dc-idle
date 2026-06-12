// Tipos do estado persistido. Schema v3 (M3): rede + contratos estaticos.
// Migracoes v1 -> v2 -> v3 em state/persistence.ts.

import type { ModelId } from '../data/components'
import type { FirewallModelId, LinkSizeId, RouterModelId, SwitchModelId } from '../data/network'

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
  /** Gerador VG-150 standby (M4). */
  generator: number
}

/** Grupo de switches com configuracao identica (uplinks ativos + LACP). */
export interface SwitchGroup {
  model: SwitchModelId
  uplinks: number
  lacp: boolean
  count: number
}

export type RouterCounts = Record<RouterModelId, number>
export type LinkCounts = Record<LinkSizeId, number>
export type FirewallCounts = Record<FirewallModelId, number>

export interface Network {
  switches: SwitchGroup[]
  routers: RouterCounts
  links: LinkCounts
  firewalls: FirewallCounts
}

/** Instancia de contrato aceito (M4: preco/duracao da oferta + janela de SLA). */
export interface ContractInstance {
  id: number
  type: string
  acceptedTs: number
  /** Receita mensal contratada (oferta ±20%). */
  monthly: number
  /** Fim do contrato (ms reais). */
  endTs: number
  /** Janela de SLA por contrato: tempo online decorrido e uptime ponderado (s reais). */
  winSec: number
  upSec: number
}

/** Oferta do mercado dinamico (M4). */
export interface MarketOffer {
  id: number
  type: string
  monthly: number
  durationMonths: number
  expiresTs: number
}

export type IncidentKind = 'utility' | 'ddos' | 'fiber' | 'psu' | 'upsmod' | 'cracunit' | 'human'

export interface Incident {
  id: number
  kind: IncidentKind
  startTs: number
  /** Duracao em s reais (= horas de jogo). */
  durSec: number
  /** Magnitude: Gbps (ddos/fiber), kW (psu) etc. */
  mag: number
}

export interface LogEntry {
  ts: number
  text: string
}

export type MarketEventKind = 'vazamento' | 'recessao'

export interface MarketEvent {
  kind: MarketEventKind
  untilTs: number
}

export interface Stats {
  totalClicks: number
  totalEarned: number
  totalSpent: number
}

export interface SaveV4 {
  version: 4
  createdTs: number
  lastTs: number
  seed: number
  money: number
  lifetimeProfit: number
  workLevel: number
  builds: Build[]
  equipment: EquipGroup[]
  infra: Infra
  network: Network
  contracts: ContractInstance[]
  offers: MarketOffer[]
  incidents: Incident[]
  log: LogEntry[]
  reputation: number
  marketEvent: MarketEvent | null
  /** Agendamentos (ms reais) e estado do RNG persistido. */
  nextOfferTs: number
  nextEventCheckTs: number
  rngState: number
  scrubbing: boolean
  nextId: number
  /** Temperatura virtual do site (°C). Congelada offline. */
  tempC: number
  stats: Stats
}

export function newInfra(): Infra {
  return { premises: 'quarto', dedicatedCircuit: false, racks42: 0, racks48: 0, upsModules: 0, cracUnits: 0, generator: 0 }
}

export function newNetwork(): Network {
  return {
    switches: [],
    routers: { r1f: 0, r2f: 0 },
    links: { l1: 0, l10: 0, l100: 0 },
    firewalls: { fws: 0, fwm: 0, fwl: 0 },
  }
}

export function newSave(now: number, seed: number): SaveV4 {
  return {
    version: 4,
    createdTs: now,
    lastTs: now,
    seed,
    money: 0,
    lifetimeProfit: 0,
    workLevel: 0,
    builds: [],
    equipment: [],
    infra: newInfra(),
    network: newNetwork(),
    contracts: [],
    offers: [],
    incidents: [],
    log: [],
    reputation: 20,
    marketEvent: null,
    nextOfferTs: now,
    nextEventCheckTs: now,
    rngState: seed >>> 0,
    scrubbing: false,
    nextId: 1,
    tempC: 22,
    stats: { totalClicks: 0, totalEarned: 0, totalSpent: 0 },
  }
}
