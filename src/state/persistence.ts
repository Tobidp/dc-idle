// Persistencia (especificacao §18): localStorage versionado, validacao zod,
// migracoes v1 -> v2 -> v3, backup de save corrompido e export/import Base64.

import { z } from 'zod'
import { newInfra, newNetwork, type SaveV4 } from '../engine/types'
import { BAL } from '../data/balance'
import { sanitize } from '../engine/economy'
import { M1_PRESET_TO_PARTS, makeBuild } from '../engine/build'
import { contractById } from '../data/contracts'

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

const infraV3Schema = z.object({
  premises: z.enum(['quarto', 'comercial']),
  dedicatedCircuit: z.boolean(),
  racks42: z.number().int().min(0),
  racks48: z.number().int().min(0),
  upsModules: z.number().int().min(0),
  cracUnits: z.number().int().min(0),
})

const infraSchema = infraV3Schema.extend({ generator: z.number().int().min(0) })

const v2Fields = {
  ...baseFields,
  builds: z.array(z.object({ id: z.string(), parts: partsSchema })),
  equipment: z.array(z.object({ buildId: z.string(), count: z.number().int().min(0) })),
  infra: infraV3Schema,
  tempC: z.number().finite(),
}

const saveV2Schema = z.object({ version: z.literal(2), ...v2Fields })

const networkSchema = z.object({
  switches: z.array(
    z.object({
      model: z.enum(['sl24', 'sl48t', 'sl48x']),
      uplinks: z.number().int().min(1),
      lacp: z.boolean(),
      count: z.number().int().min(0),
    }),
  ),
  routers: z.object({ r1f: z.number().int().min(0), r2f: z.number().int().min(0) }),
  links: z.object({ l1: z.number().int().min(0), l10: z.number().int().min(0), l100: z.number().int().min(0) }),
  firewalls: z.object({ fws: z.number().int().min(0), fwm: z.number().int().min(0), fwl: z.number().int().min(0) }),
})

const saveV3Schema = z.object({
  version: z.literal(3),
  ...v2Fields,
  network: networkSchema,
  contracts: z.array(z.object({ type: z.string(), acceptedTs: z.number().finite() })),
})

const contractV4Schema = z.object({
  id: z.number().int(),
  type: z.string(),
  acceptedTs: z.number().finite(),
  monthly: z.number().finite(),
  endTs: z.number().finite(),
  winSec: z.number().min(0),
  upSec: z.number().min(0),
})

const saveV4Schema = z.object({
  version: z.literal(4),
  ...v2Fields,
  infra: infraSchema,
  network: networkSchema,
  contracts: z.array(contractV4Schema),
  offers: z.array(
    z.object({
      id: z.number().int(),
      type: z.string(),
      monthly: z.number().finite(),
      durationMonths: z.number().int().min(1),
      expiresTs: z.number().finite(),
    }),
  ),
  incidents: z.array(
    z.object({
      id: z.number().int(),
      kind: z.enum(['utility', 'ddos', 'fiber', 'psu', 'upsmod', 'cracunit', 'human']),
      startTs: z.number().finite(),
      durSec: z.number().min(0),
      mag: z.number(),
    }),
  ),
  log: z.array(z.object({ ts: z.number().finite(), text: z.string() })).max(200),
  reputation: z.number().min(0).max(100),
  marketEvent: z.object({ kind: z.enum(['vazamento', 'recessao']), untilTs: z.number().finite() }).nullable(),
  nextOfferTs: z.number().finite(),
  nextEventCheckTs: z.number().finite(),
  rngState: z.number(),
  scrubbing: z.boolean(),
  nextId: z.number().int().min(1),
})

type SaveV1 = z.infer<typeof saveV1Schema>
type SaveV2 = z.infer<typeof saveV2Schema>
type SaveV3 = z.infer<typeof saveV3Schema>

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

export function migrateV2toV3(v2: SaveV2): SaveV3 {
  return { ...v2, version: 3, network: newNetwork(), contracts: [] }
}

export function migrateV3toV4(v3: SaveV3): SaveV4 {
  let nextId = 1
  const contracts = v3.contracts
    .map((c) => {
      const type = contractById[c.type]
      if (!type) return null
      const months = Math.round((type.durationM[0] + type.durationM[1]) / 2)
      return {
        id: nextId++,
        type: c.type,
        acceptedTs: c.acceptedTs,
        monthly: type.monthly,
        endTs: c.acceptedTs + months * BAL.monthSeconds * 1000,
        winSec: 0,
        upSec: 0,
      }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
  return {
    ...v3,
    version: 4,
    infra: { ...v3.infra, generator: 0 },
    contracts,
    offers: [],
    incidents: [],
    log: [],
    reputation: BAL.market.startingReputation,
    marketEvent: null,
    nextOfferTs: v3.lastTs,
    nextEventCheckTs: v3.lastTs,
    rngState: v3.seed >>> 0,
    scrubbing: false,
    nextId,
  }
}

/** Aceita payload v1-v4; devolve sempre v4 saneado. */
export function parseSave(json: string): SaveV4 {
  const raw: unknown = JSON.parse(json)
  const version = (raw as { version?: unknown }).version
  let v4: SaveV4
  if (version === 1) v4 = migrateV3toV4(migrateV2toV3(migrateV1toV2(saveV1Schema.parse(raw))))
  else if (version === 2) v4 = migrateV3toV4(migrateV2toV3(saveV2Schema.parse(raw)))
  else if (version === 3) v4 = migrateV3toV4(saveV3Schema.parse(raw))
  else v4 = saveV4Schema.parse(raw) as SaveV4
  const clean = sanitize(v4.builds, v4.equipment)
  v4.builds = clean.builds
  v4.equipment = clean.equipment
  v4.network.switches = v4.network.switches.filter((g) => g.count > 0)
  v4.contracts = v4.contracts.filter((c) => contractById[c.type] !== undefined)
  v4.offers = v4.offers.filter((o) => contractById[o.type] !== undefined)
  return v4
}

export interface LoadResult {
  save: SaveV4 | null
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

export function writeSave(payload: SaveV4): void {
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

export function exportSave(payload: SaveV4): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

export function importSave(b64: string): SaveV4 {
  const bin = atob(b64.trim())
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return parseSave(new TextDecoder().decode(bytes))
}
