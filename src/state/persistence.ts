// Persistencia (especificacao §18): localStorage versionado, validacao zod,
// migracao v1 -> v2, backup de save corrompido e export/import Base64.

import { z } from 'zod'
import { newInfra, type SaveV2 } from '../engine/types'
import { sanitize } from '../engine/economy'
import { M1_PRESET_TO_PARTS, makeBuild } from '../engine/build'
import { BAL } from '../data/balance'

export const SAVE_KEY = 'dcidle.save.v1' // chave estavel; o conteudo carrega `version`
export const CORRUPT_KEY = 'dcidle.save.v1.corrupt'

const statsSchema = z.object({
  totalClicks: z.number().min(0),
  totalEarned: z.number().min(0),
  totalSpent: z.number().min(0),
})

const baseFields = {
  createdTs: z.number().finite(),
  lastTs: z.number().finite(),
  seed: z.number().finite(),
  money: z.number().finite(),
  lifetimeProfit: z.number().finite(),
  workLevel: z.number().int().min(0),
  stats: statsSchema,
}

const saveV1Schema = z.object({
  version: z.literal(1),
  ...baseFields,
  equipment: z.array(z.object({ presetId: z.string(), count: z.number().int().min(0) })),
})

const partsSchema = z.object({
  modelId: z.enum(['RB-T2', 'HN-1100', 'HN-2200']),
  cpuId: z.string(),
  cpuCount: z.number().int().min(1),
  dimmId: z.string(),
  dimmCount: z.number().int().min(1),
  nicId: z.string(),
  psuCount: z.union([z.literal(1), z.literal(2)]),
  nvmeId: z.string().nullable(),
  nvmeCount: z.number().int().min(0),
})

const saveV2Schema = z.object({
  version: z.literal(2),
  ...baseFields,
  builds: z.array(z.object({ id: z.string(), parts: partsSchema })),
  equipment: z.array(z.object({ buildId: z.string(), count: z.number().int().min(0) })),
  infra: z.object({
    premises: z.enum(['quarto', 'comercial']),
    dedicatedCircuit: z.boolean(),
    racks42: z.number().int().min(0),
    racks48: z.number().int().min(0),
    upsModules: z.number().int().min(0),
    cracUnits: z.number().int().min(0),
  }),
  tempC: z.number().finite(),
})

type SaveV1 = z.infer<typeof saveV1Schema>

export function migrateV1toV2(v1: SaveV1): SaveV2 {
  const builds: SaveV2['builds'] = []
  const equipment: SaveV2['equipment'] = []
  for (const g of v1.equipment) {
    const parts = M1_PRESET_TO_PARTS[g.presetId]
    if (!parts || g.count <= 0) continue
    const b = makeBuild(parts)
    if (!builds.some((x) => x.id === b.id)) builds.push(b)
    equipment.push({ buildId: b.id, count: g.count })
  }
  return {
    version: 2,
    createdTs: v1.createdTs,
    lastTs: v1.lastTs,
    seed: v1.seed,
    money: v1.money,
    lifetimeProfit: v1.lifetimeProfit,
    workLevel: v1.workLevel,
    builds,
    equipment,
    infra: newInfra(),
    tempC: BAL.thermal.baseTempC,
    stats: v1.stats,
  }
}

/** Aceita payload v1 ou v2; devolve sempre v2 saneado. */
export function parseSave(json: string): SaveV2 {
  const raw: unknown = JSON.parse(json)
  const version = (raw as { version?: unknown }).version
  const v2 = version === 1 ? migrateV1toV2(saveV1Schema.parse(raw)) : (saveV2Schema.parse(raw) as SaveV2)
  const clean = sanitize(v2.builds, v2.equipment)
  v2.builds = clean.builds
  v2.equipment = clean.equipment
  return v2
}

export interface LoadResult {
  save: SaveV2 | null
  corrupt: boolean
}

export function loadSave(): LoadResult {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(SAVE_KEY)
  } catch {
    return { save: null, corrupt: false }
  }
  if (!raw) return { save: null, corrupt: false }
  try {
    return { save: parseSave(raw), corrupt: false }
  } catch {
    try {
      localStorage.setItem(CORRUPT_KEY, raw)
      localStorage.removeItem(SAVE_KEY)
    } catch {
      /* sem acao */
    }
    return { save: null, corrupt: true }
  }
}

export function writeSave(payload: SaveV2): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload))
  } catch {
    /* storage cheio/indisponivel */
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    /* sem acao */
  }
}

// ---------- Export/Import (Base64 Unicode-safe) ----------

export function exportSave(payload: SaveV2): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

export function importSave(b64: string): SaveV2 {
  const bin = atob(b64.trim())
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return parseSave(new TextDecoder().decode(bytes))
}
