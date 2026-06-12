// Mundo dinamico (M4): incidentes (§13), mercado de ofertas (§10),
// janela de SLA com multas/creditos (§10) e reputacao (§5).
// Tudo puro e deterministico via RNG persistido; suprimido offline (§16).

import { BAL } from '../data/balance'
import { CONTRACT_TYPES, contractById } from '../data/contracts'
import { FIREWALLS } from '../data/network'
import { rngStep } from '../utils/rng'
import { accessLayer, nicDemandGbps, wanStatus } from './network'
import { itKwOf, totals, upsCapacityKw } from './site'
import type { Incident, MarketOffer, Network, SaveV4 } from './types'

export type WorldState = Pick<
  SaveV4,
  | 'builds'
  | 'equipment'
  | 'infra'
  | 'network'
  | 'contracts'
  | 'offers'
  | 'incidents'
  | 'log'
  | 'reputation'
  | 'marketEvent'
  | 'nextOfferTs'
  | 'nextEventCheckTs'
  | 'rngState'
  | 'scrubbing'
  | 'nextId'
  | 'tempC'
  | 'money'
>

// ---------- Efeitos instantaneos dos incidentes ----------

export interface Effects {
  /** Site sem energia neste instante (concessionaria caiu e nao ha cobertura). */
  siteDown: boolean
  /** Gerador em operacao (custo de diesel). */
  generatorRunning: boolean
  /** Camada de acesso fora (erro humano). */
  accessDown: boolean
  /** Gbps de WAN indisponiveis por fibra rompida. */
  fiberDownGbps: number
  /** DDoS ativo nao mitigado (contratos expostos degradados). */
  ddosUnmitigated: boolean
  /** kW de IT fora por falha de PSU (informativo). */
  psuDownKw: number
  /** Modulos UPS / unidades CRAC fora. */
  upsModulesDown: number
  cracUnitsDown: number
}

export const NO_EFFECTS: Effects = {
  siteDown: false,
  generatorRunning: false,
  accessDown: false,
  fiberDownGbps: 0,
  ddosUnmitigated: false,
  psuDownKw: 0,
  upsModulesDown: 0,
  cracUnitsDown: 0,
}

export function ddosMitigationGbps(network: Network, scrubbing: boolean): number {
  return (
    0.5 * network.firewalls.fws +
    5 * network.firewalls.fwm +
    40 * network.firewalls.fwl +
    (scrubbing ? BAL.scrubbingMitigationGbps : 0)
  )
}

/** Garante coerencia com o catalogo (FW-S 0,5 / FW-M 5 / FW-L 40 da §6.5). */
void FIREWALLS

export function effectsAt(state: WorldState, now: number): Effects {
  const inc = BAL.incidents
  const e: Effects = { ...NO_EFFECTS }
  const itKw = itKwOf(state)
  for (const i of state.incidents) {
    const elapsedGameH = (now - i.startTs) / 1000
    if (elapsedGameH < 0 || elapsedGameH > i.durSec) continue
    switch (i.kind) {
      case 'utility': {
        const hasGen = state.infra.generator > 0
        const upsOk = state.infra.upsModules > 0 && upsCapacityKw(state.infra) + 1e-9 >= itKw
        if (hasGen) {
          const gap = upsOk ? 0 : inc.genStartupGameH
          if (elapsedGameH < gap) e.siteDown = true
          else e.generatorRunning = true
        } else if (upsOk) {
          if (elapsedGameH > inc.upsAutonomyGameH) e.siteDown = true
        } else {
          e.siteDown = true
        }
        break
      }
      case 'ddos': {
        if (i.mag > ddosMitigationGbps(state.network, state.scrubbing) + 1e-9) e.ddosUnmitigated = true
        break
      }
      case 'fiber':
        e.fiberDownGbps += i.mag
        break
      case 'human':
        e.accessDown = true
        break
      case 'psu':
        e.psuDownKw += i.mag
        break
      case 'upsmod':
        e.upsModulesDown += 1
        break
      case 'cracunit':
        e.cracUnitsDown += 1
        break
    }
  }
  return e
}

// ---------- Contribuicao de uptime por contrato (§10) ----------

/**
 * uptime_contrato: penalidades especificas — site down, acesso fora,
 * throttle termico, score < 75% (se sensivel), DDoS nao mitigado/fibra
 * (se exposto, gbps > 0).
 */
export function upContribution(
  typeId: string,
  throttle: number,
  accessScore: number,
  egressShort: boolean,
  effects: Effects,
): number {
  const c = contractById[typeId]
  if (!c) return 0
  if (effects.siteDown || effects.accessDown) return 0
  const exposed = c.gbps > 0
  if (exposed && (effects.ddosUnmitigated || egressShort)) return 0
  const netPenalty = c.netSensitive && accessScore < 75 ? accessScore / 100 : 1
  return throttle * netPenalty
}

// ---------- Avanco do mundo por tick ----------

export interface WorldDelta {
  state: WorldState
  /** Custos do tick fora do fluxo continuo: multas e diesel ($, ja em valor positivo). */
  fines: number
  dieselCost: number
}

function pushLog(state: WorldState, ts: number, text: string): void {
  state.log = [...state.log, { ts, text }].slice(-200)
}

function roll(state: WorldState): number {
  const r = rngStep(state.rngState)
  state.rngState = r.next
  return r.value
}

function rollRange(state: WorldState, [min, max]: readonly [number, number]): number {
  return min + roll(state) * (max - min)
}

function poisson(state: WorldState, perYear: number, dtSec: number): boolean {
  const lambda = (perYear / BAL.incidents.hoursPerYear) * dtSec
  return roll(state) < 1 - Math.exp(-lambda)
}

function spawnIncident(state: WorldState, now: number, partial: Omit<Incident, 'id' | 'startTs'>): Incident {
  const inc: Incident = { id: state.nextId++, startTs: now, ...partial }
  state.incidents = [...state.incidents, inc]
  return inc
}

function maybeSpawnIncidents(state: WorldState, now: number, dtSec: number, labels: WorldLabels): void {
  const inc = BAL.incidents
  // Queda da concessionaria: 2x/ano (§13)
  if (!state.incidents.some((i) => i.kind === 'utility') && poisson(state, inc.utilityOutagesPerYear, dtSec)) {
    const dur = rollRange(state, inc.utilityDurGameH)
    spawnIncident(state, now, { kind: 'utility', durSec: dur, mag: 0 })
    pushLog(state, now, labels.utility(dur))
  }
  // DDoS: frequencia proporcional a reputacao (§13)
  const ddosPerYear = inc.ddosPerYearBase + inc.ddosPerYearPerRep * state.reputation
  if (!state.incidents.some((i) => i.kind === 'ddos') && poisson(state, ddosPerYear, dtSec)) {
    const gbps = Math.round(rollRange(state, inc.ddosGbps))
    const dur = rollRange(state, inc.ddosDurGameH)
    spawnIncident(state, now, { kind: 'ddos', durSec: dur, mag: gbps })
    const mitigated = gbps <= ddosMitigationGbps(state.network, state.scrubbing)
    pushLog(state, now, labels.ddos(gbps, mitigated))
  }
  // Rompimento de fibra: 1x/ano por link (§13)
  const links = state.network.links
  const linkCount = links.l1 + links.l10 + links.l100
  if (linkCount > 0 && !state.incidents.some((i) => i.kind === 'fiber') && poisson(state, inc.fiberPerYearPerLink * linkCount, dtSec)) {
    const pick = roll(state) * linkCount
    const gbps = pick < links.l1 ? 1 : pick < links.l1 + links.l10 ? 10 : 100
    const dur = rollRange(state, inc.fiberDurGameH)
    spawnIncident(state, now, { kind: 'fiber', durSec: dur, mag: gbps })
    pushLog(state, now, labels.fiber(gbps))
  }
  // Falha de modulo UPS / unidade CRAC: AFR 3% por unidade (§13)
  if (state.infra.upsModules > 0 && poisson(state, inc.upsCracAfr * state.infra.upsModules, dtSec)) {
    spawnIncident(state, now, { kind: 'upsmod', durSec: inc.mttrGameH, mag: 0 })
    pushLog(state, now, labels.upsmod())
  }
  if (state.infra.cracUnits > 0 && poisson(state, inc.upsCracAfr * state.infra.cracUnits, dtSec)) {
    spawnIncident(state, now, { kind: 'cracunit', durSec: inc.mttrGameH, mag: 0 })
    pushLog(state, now, labels.cracunit())
  }
  // Falha de PSU: AFR 2% por host sem 2ª fonte (§13)
  const singlePsu = state.equipment.reduce((acc, g) => {
    const b = state.builds.find((x) => x.id === g.buildId)
    return acc + (b && b.parts.psuCount === 1 ? g.count : 0)
  }, 0)
  if (singlePsu > 0 && !state.incidents.some((i) => i.kind === 'psu') && poisson(state, inc.psuAfr * singlePsu, dtSec)) {
    const t = totals(state.builds, state.equipment)
    const avgKw = t.units > 0 ? t.watts / t.units / 1000 : 0
    spawnIncident(state, now, { kind: 'psu', durSec: inc.mttrGameH, mag: avgKw })
    pushLog(state, now, labels.psu())
  }
}

function expireIncidents(state: WorldState, now: number, labels: WorldLabels): void {
  const still: Incident[] = []
  for (const i of state.incidents) {
    if ((now - i.startTs) / 1000 > i.durSec) pushLog(state, now, labels.resolved(i.kind))
    else still.push(i)
  }
  if (still.length !== state.incidents.length) state.incidents = still
}

// ---------- Mercado dinamico (§10) ----------

const OFFERABLE = CONTRACT_TYPES.filter((c) => !c.requires.tierMin && !c.requires.cert)

function priceFactor(state: WorldState, now: number): number {
  if (state.marketEvent && now < state.marketEvent.untilTs)
    return state.marketEvent.kind === 'vazamento' ? 1.2 : 0.8
  return 1
}

function tickMarket(state: WorldState, now: number, labels: WorldLabels): void {
  const m = BAL.market
  // Eventos de mercado
  if (now >= state.nextEventCheckTs) {
    state.nextEventCheckTs = now + m.eventCheckGameH * 1000
    if (state.marketEvent && now >= state.marketEvent.untilTs) state.marketEvent = null
    if (!state.marketEvent && roll(state) < m.eventChance) {
      const kind = roll(state) < 0.5 ? ('vazamento' as const) : ('recessao' as const)
      state.marketEvent = { kind, untilTs: now + m.eventDurGameH * 1000 }
      pushLog(state, now, labels.marketEvent(kind))
    }
  }
  // Expiracao de ofertas
  const alive = state.offers.filter((o) => o.expiresTs > now)
  if (alive.length !== state.offers.length) state.offers = alive
  // Regeneracao do pool
  if (now >= state.nextOfferTs) {
    const interval = rollRange(state, m.regenGameH) * (state.marketEvent?.kind === 'vazamento' ? 0.5 : 1)
    state.nextOfferTs = now + interval * 1000
    const count = 1 + Math.floor(roll(state) * (1 + state.reputation / 25))
    const factor = priceFactor(state, now)
    const offers: MarketOffer[] = [...state.offers]
    for (let k = 0; k < count && offers.length < m.maxOffers; k++) {
      const type = OFFERABLE[Math.floor(roll(state) * OFFERABLE.length)]
      const jitter = 1 + (roll(state) * 2 - 1) * m.priceJitter
      const durationMonths = Math.round(rollRange(state, type.durationM))
      offers.push({
        id: state.nextId++,
        type: type.id,
        monthly: Math.round(type.monthly * jitter * factor),
        durationMonths,
        expiresTs: now + rollRange(state, m.offerTtlGameH) * 1000,
      })
    }
    state.offers = offers
  }
}

// ---------- Janela de SLA (§10) ----------

function settleWindows(
  state: WorldState,
  now: number,
  dtSec: number,
  throttle: number,
  labels: WorldLabels,
): number {
  let fines = 0
  const access = accessLayer(state.network, nicDemandGbps(state.builds, state.equipment))
  const wan = wanStatus(state.network)
  const effects = effectsAt(state, now)
  const allocGbps = state.contracts.reduce((a, c) => a + (contractById[c.type]?.gbps ?? 0), 0)
  const egressShort = wan.egressGbps - effects.fiberDownGbps + 1e-9 < allocGbps

  const kept: typeof state.contracts = []
  for (const c of state.contracts.map((x) => ({ ...x }))) {
    const type = contractById[c.type]
    if (!type) continue
    c.winSec += dtSec
    c.upSec += dtSec * upContribution(c.type, throttle, access.score, egressShort, effects)

    let cancelled = false
    while (c.winSec >= BAL.sla.windowSec) {
      const upPct = (Math.min(c.upSec, BAL.sla.windowSec) / BAL.sla.windowSec) * 100
      const shortfall = type.slaPct - upPct
      c.winSec -= BAL.sla.windowSec
      c.upSec = Math.max(0, c.upSec - BAL.sla.windowSec)
      if (shortfall > 1e-9) {
        const tier = BAL.sla.tiers.find((t) => shortfall <= t.maxShortfallPp)
        const creditPct = tier ? tier.creditPct : BAL.sla.worstCreditPct
        const fine = (c.monthly * creditPct) / 100
        fines += fine
        pushLog(state, now, labels.fine(type.name, upPct, type.slaPct, creditPct, fine))
        if (!tier) {
          state.reputation = Math.max(0, state.reputation - BAL.sla.repPenalty)
          if (roll(state) < BAL.sla.cancelChance) {
            cancelled = true
            pushLog(state, now, labels.cancelledBySla(type.name))
            break
          }
        }
      }
    }
    if (cancelled) continue
    if (now >= c.endTs) {
      state.reputation = Math.min(100, state.reputation + BAL.sla.repOnCompletion)
      pushLog(state, now, labels.completed(type.name))
      continue
    }
    kept.push(c)
  }
  state.contracts = kept
  return fines
}

// ---------- Rotulos (injetados pela UI; engine livre de i18n) ----------

export interface WorldLabels {
  utility: (durGameH: number) => string
  ddos: (gbps: number, mitigated: boolean) => string
  fiber: (gbps: number) => string
  psu: () => string
  upsmod: () => string
  cracunit: () => string
  human: () => string
  resolved: (kind: string) => string
  marketEvent: (kind: 'vazamento' | 'recessao') => string
  fine: (name: string, upPct: number, slaPct: number, creditPct: number, fine: number) => string
  cancelledBySla: (name: string) => string
  completed: (name: string) => string
}

/**
 * Avanca incidentes, mercado e janelas de SLA por dt (apenas online; §16).
 * Retorna estado novo + custos do tick (multas, diesel).
 */
export function advanceWorld(
  input: WorldState,
  now: number,
  dtSec: number,
  throttle: number,
  labels: WorldLabels,
): WorldDelta {
  const state: WorldState = { ...input }
  expireIncidents(state, now, labels)
  maybeSpawnIncidents(state, now, dtSec, labels)
  tickMarket(state, now, labels)
  const fines = settleWindows(state, now, dtSec, throttle, labels)
  const effects = effectsAt(state, now)
  const dieselCost = effects.generatorRunning ? BAL.incidents.dieselPerGameH * dtSec : 0
  return { state, fines, dieselCost }
}

/** Erro humano em acao manual de rede (§13): 2% por acao. */
export function maybeHumanError(state: WorldState, now: number, labels: WorldLabels): WorldState {
  const next = { ...state }
  if (roll(next) < BAL.incidents.humanErrorPerAction) {
    spawnIncident(next, now, { kind: 'human', durSec: BAL.incidents.humanErrorDurGameH, mag: 0 })
    pushLog(next, now, labels.human())
  }
  return next
}
