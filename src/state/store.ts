// Store Zustand (especificacao §18). Logica em /engine; aqui orquestracao.
// Loop iniciado em main.tsx, fora do React. M2: termica integrada no tick.

import { create } from 'zustand'
import { newSave, type BuildParts, type LinkCounts, type SaveV4 } from '../engine/types'
import * as eco from '../engine/economy'
import { coolingStatus, itKwOf, stepTemp, throttleMult } from '../engine/site'
import { computeOffline, type OfflineResult } from '../engine/offline'
import { canAccept } from '../engine/contracts'
import { advanceWorld, effectsAt, maybeHumanError, type WorldLabels } from '../engine/world'
import { T } from '../i18n/pt-BR'
import { BAL } from '../data/balance'
import { randomSeed } from '../utils/rng'
import { writeSave, clearSave } from './persistence'

export type Tab = 'dashboard' | 'racks' | 'contracts' | 'shop' | 'config'

interface UiState {
  tab: Tab
  offlineReport: OfflineResult | null
  corruptNotice: boolean
}

export interface GameStore extends SaveV4 {
  ui: UiState
  init: (save: SaveV4 | null, now: number, corrupt: boolean) => void
  tickNow: (now: number) => void
  persist: () => void
  clickWork: () => void
  buyWorkUpgrade: () => void
  buyBuild: (parts: BuildParts) => void
  buyInfra: (kind: eco.InfraKind) => void
  buyNet: (p: eco.NetPurchase) => void
  adjustLink: (size: keyof LinkCounts, delta: 1 | -1) => void
  acceptOffer: (offerId: number) => void
  cancelContract: (index: number) => void
  toggleScrubbing: () => void
  setTab: (tab: Tab) => void
  dismissOffline: () => void
  importPayload: (payload: SaveV4, now: number) => void
  hardReset: (now: number) => void
}

export function toPayload(s: GameStore): SaveV4 {
  return {
    version: 4,
    createdTs: s.createdTs,
    lastTs: s.lastTs,
    seed: s.seed,
    money: s.money,
    lifetimeProfit: s.lifetimeProfit,
    workLevel: s.workLevel,
    builds: s.builds,
    equipment: s.equipment,
    infra: s.infra,
    network: s.network,
    contracts: s.contracts,
    offers: s.offers,
    incidents: s.incidents,
    log: s.log,
    reputation: s.reputation,
    marketEvent: s.marketEvent,
    nextOfferTs: s.nextOfferTs,
    nextEventCheckTs: s.nextEventCheckTs,
    rngState: s.rngState,
    scrubbing: s.scrubbing,
    nextId: s.nextId,
    tempC: s.tempC,
    stats: s.stats,
  }
}

/** Aplica intervalo decorrido (load/import/aba suspensa): ganho offline, termica congelada. */
function withElapsed(save: SaveV4, now: number): { save: SaveV4; report: OfflineResult } {
  const report = computeOffline(save, now)
  return {
    save: {
      ...save,
      money: save.money + report.gained,
      lifetimeProfit: save.lifetimeProfit + report.gained,
      stats: {
        ...save.stats,
        totalEarned: save.stats.totalEarned + Math.max(0, report.gained),
        totalSpent: save.stats.totalSpent + Math.max(0, -report.gained),
      },
      lastTs: now,
    },
    report,
  }
}

const WORLD_LABELS: WorldLabels = T.world

const freshUi = (corrupt: boolean): UiState => ({ tab: 'dashboard', offlineReport: null, corruptNotice: corrupt })

export const useGame = create<GameStore>()((set, get) => ({
  ...newSave(0, 0),
  ui: freshUi(false),

  init: (loaded, now, corrupt) => {
    if (!loaded) {
      set({ ...newSave(now, randomSeed()), ui: freshUi(corrupt) })
      return
    }
    const { save, report } = withElapsed(loaded, now)
    set({
      ...save,
      ui: {
        tab: 'dashboard',
        offlineReport: report.elapsedSeconds >= BAL.offline.minReportSeconds ? report : null,
        corruptNotice: corrupt,
      },
    })
  },

  tickNow: (now) => {
    const s = get()
    const dt = (now - s.lastTs) / 1000
    if (dt <= 0) return
    if (dt > BAL.offline.inSessionThresholdSeconds) {
      const { save, report } = withElapsed(toPayload(s), now)
      set({ ...save, ui: { ...s.ui, offlineReport: report } })
      return
    }
    // Mundo dinamico (incidentes, mercado, janelas de SLA) — apenas online
    const world = advanceWorld(s, now, dt, throttleMult(s.tempC), WORLD_LABELS)
    const w = world.state
    const effects = effectsAt(w, now)
    const net = eco.netPerSec({ ...s, contracts: w.contracts, scrubbing: w.scrubbing }, effects)
    const delta = net * dt - world.fines - world.dieselCost
    // Termica: 1 s real = 1 h de jogo; congelada com site sem energia
    const cooling = coolingStatus(s.infra, effects.siteDown ? 0 : itKwOf(s), effects.cracUnitsDown)
    const tempC = effects.siteDown ? s.tempC : stepTemp(s.tempC, cooling.deficitFrac, dt)
    set({
      money: s.money + delta,
      lifetimeProfit: s.lifetimeProfit + delta,
      tempC,
      lastTs: now,
      contracts: w.contracts,
      offers: w.offers,
      incidents: w.incidents,
      log: w.log,
      reputation: w.reputation,
      marketEvent: w.marketEvent,
      nextOfferTs: w.nextOfferTs,
      nextEventCheckTs: w.nextEventCheckTs,
      rngState: w.rngState,
      nextId: w.nextId,
      stats: {
        ...s.stats,
        totalEarned: s.stats.totalEarned + Math.max(0, net * dt),
        totalSpent: s.stats.totalSpent + Math.max(0, -(net * dt)) + world.fines + world.dieselCost,
      },
    })
  },

  persist: () => writeSave(toPayload(get())),

  clickWork: () => {
    const s = get()
    const v = eco.workValue(s.workLevel)
    set({
      money: s.money + v,
      lifetimeProfit: s.lifetimeProfit + v,
      stats: { ...s.stats, totalClicks: s.stats.totalClicks + 1, totalEarned: s.stats.totalEarned + v },
    })
  },

  buyWorkUpgrade: () => {
    const s = get()
    const cost = eco.workUpgradeCost(s.workLevel)
    if (s.money < cost) return
    set({
      money: s.money - cost,
      workLevel: s.workLevel + 1,
      lifetimeProfit: s.lifetimeProfit - cost,
      stats: { ...s.stats, totalSpent: s.stats.totalSpent + cost },
    })
  },

  buyBuild: (parts) => {
    const s = get()
    const check = eco.canBuyBuild(s, parts)
    if (!check.ok) return
    const next = eco.applyBuyBuild(s.builds, s.equipment, parts)
    set({
      money: s.money - check.price,
      lifetimeProfit: s.lifetimeProfit - check.price,
      builds: next.builds,
      equipment: next.equipment,
      stats: { ...s.stats, totalSpent: s.stats.totalSpent + check.price },
    })
    get().persist()
  },

  buyInfra: (kind) => {
    const s = get()
    const check = eco.canBuyInfra(s, kind)
    if (!check.ok) return
    set({
      money: s.money - check.price,
      lifetimeProfit: s.lifetimeProfit - check.price,
      infra: eco.applyBuyInfra(s.infra, kind),
      stats: { ...s.stats, totalSpent: s.stats.totalSpent + check.price },
    })
    get().persist()
  },

  buyNet: (p) => {
    const s = get()
    const check = eco.canBuyNet(s, p)
    if (!check.ok) return
    const w = maybeHumanError({ ...s, network: eco.applyBuyNet(s.network, p) }, s.lastTs, WORLD_LABELS)
    set({
      money: s.money - check.price,
      lifetimeProfit: s.lifetimeProfit - check.price,
      network: w.network,
      incidents: w.incidents,
      log: w.log,
      rngState: w.rngState,
      nextId: w.nextId,
      stats: { ...s.stats, totalSpent: s.stats.totalSpent + check.price },
    })
    get().persist()
  },

  adjustLink: (size, delta) => {
    const s = get()
    const w = maybeHumanError(
      { ...s, network: { ...s.network, links: eco.setLink(s.network.links, size, delta) } },
      s.lastTs,
      WORLD_LABELS,
    )
    set({ network: w.network, incidents: w.incidents, log: w.log, rngState: w.rngState, nextId: w.nextId })
    get().persist()
  },

  acceptOffer: (offerId) => {
    const s = get()
    const offer = s.offers.find((o) => o.id === offerId)
    if (!offer || !canAccept(s, offer.type).ok) return
    set({
      contracts: [
        ...s.contracts,
        {
          id: s.nextId,
          type: offer.type,
          acceptedTs: s.lastTs,
          monthly: offer.monthly,
          endTs: s.lastTs + offer.durationMonths * BAL.monthSeconds * 1000,
          winSec: 0,
          upSec: 0,
        },
      ],
      offers: s.offers.filter((o) => o.id !== offerId),
      nextId: s.nextId + 1,
    })
    get().persist()
  },

  toggleScrubbing: () => {
    set((s) => ({ scrubbing: !s.scrubbing }))
    get().persist()
  },

  cancelContract: (index) => {
    const s = get()
    set({ contracts: s.contracts.filter((_, i) => i !== index) })
    get().persist()
  },

  setTab: (tab) => set((s) => ({ ui: { ...s.ui, tab } })),

  dismissOffline: () => set((s) => ({ ui: { ...s.ui, offlineReport: null } })),

  importPayload: (payload, now) => {
    const { save, report } = withElapsed(payload, now)
    set({
      ...save,
      ui: {
        tab: 'config',
        offlineReport: report.elapsedSeconds >= BAL.offline.minReportSeconds ? report : null,
        corruptNotice: false,
      },
    })
    get().persist()
  },

  hardReset: (now) => {
    clearSave()
    set({ ...newSave(now, randomSeed()), ui: freshUi(false) })
    get().persist()
  },
}))
