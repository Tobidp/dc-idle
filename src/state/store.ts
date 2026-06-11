// Store Zustand (especificacao §18). Logica em /engine; aqui orquestracao.
// Loop iniciado em main.tsx, fora do React. M2: termica integrada no tick.

import { create } from 'zustand'
import { newSave, type BuildParts, type SaveV2 } from '../engine/types'
import * as eco from '../engine/economy'
import { coolingStatus, stepTemp } from '../engine/site'
import { computeOffline, type OfflineResult } from '../engine/offline'
import { BAL } from '../data/balance'
import { randomSeed } from '../utils/rng'
import { writeSave, clearSave } from './persistence'

export type Tab = 'dashboard' | 'racks' | 'shop' | 'config'

interface UiState {
  tab: Tab
  offlineReport: OfflineResult | null
  corruptNotice: boolean
}

export interface GameStore extends SaveV2 {
  ui: UiState
  init: (save: SaveV2 | null, now: number, corrupt: boolean) => void
  tickNow: (now: number) => void
  persist: () => void
  clickWork: () => void
  buyWorkUpgrade: () => void
  buyBuild: (parts: BuildParts) => void
  buyInfra: (kind: eco.InfraKind) => void
  setTab: (tab: Tab) => void
  dismissOffline: () => void
  importPayload: (payload: SaveV2, now: number) => void
  hardReset: (now: number) => void
}

export function toPayload(s: GameStore): SaveV2 {
  return {
    version: 2,
    createdTs: s.createdTs,
    lastTs: s.lastTs,
    seed: s.seed,
    money: s.money,
    lifetimeProfit: s.lifetimeProfit,
    workLevel: s.workLevel,
    builds: s.builds,
    equipment: s.equipment,
    infra: s.infra,
    tempC: s.tempC,
    stats: s.stats,
  }
}

/** Aplica intervalo decorrido (load/import/aba suspensa): ganho offline, termica congelada. */
function withElapsed(save: SaveV2, now: number): { save: SaveV2; report: OfflineResult } {
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
    const net = eco.netPerSec(s)
    const delta = net * dt
    // Termica: 1 s real = 1 h de jogo -> dtHours = dt
    const itKw = eco.totals(s.builds, s.equipment).watts / 1000
    const cooling = coolingStatus(s.infra, itKw)
    const tempC = stepTemp(s.tempC, cooling.deficitFrac, dt)
    set({
      money: s.money + delta,
      lifetimeProfit: s.lifetimeProfit + delta,
      tempC,
      lastTs: now,
      stats: {
        ...s.stats,
        totalEarned: s.stats.totalEarned + Math.max(0, delta),
        totalSpent: s.stats.totalSpent + Math.max(0, -delta),
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
