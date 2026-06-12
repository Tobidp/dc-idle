import { describe, expect, it } from 'vitest'
import { exportSave, importSave, migrateV1toV2, parseSave } from './persistence'
import { newSave } from '../engine/types'
import { M1_PRESET_TO_PARTS, makeBuild } from '../engine/build'
import * as eco from '../engine/economy'

describe('export/import v4', () => {
  it('round-trip preserva campos e sanitiza grupos orfaos', () => {
    const s = newSave(1_000, 42)
    const b = makeBuild(M1_PRESET_TO_PARTS['hn1100-b'])
    s.money = 123.45
    s.builds = [b]
    s.equipment = [
      { buildId: b.id, count: 2 },
      { buildId: 'ghost', count: 1 },
    ]
    s.infra.racks42 = 1
    const out = importSave(exportSave(s))
    expect(out.version).toBe(4)
    expect(out.money).toBe(123.45)
    expect(out.equipment).toEqual([{ buildId: b.id, count: 2 }])
    expect(out.infra.racks42).toBe(1)
  })

  it('rejeita payload invalido', () => {
    expect(() => importSave('@@nao-e-base64@@')).toThrow()
    expect(() => parseSave('{"version":3}')).toThrow()
  })
})

describe('migracoes v1/v2 -> v3', () => {
  const v1 = {
    version: 1 as const,
    createdTs: 10,
    lastTs: 20,
    seed: 7,
    money: 500,
    lifetimeProfit: 900,
    workLevel: 2,
    equipment: [
      { presetId: 'rbt2', count: 2 },
      { presetId: 'hn1100-b', count: 1 },
      { presetId: 'desconhecido', count: 9 },
    ],
    stats: { totalClicks: 3, totalEarned: 1000, totalSpent: 100 },
  }

  it('converte presets em builds equivalentes e preserva capacidades', () => {
    const v2 = parseSave(JSON.stringify(v1))
    expect(v2.version).toBe(4)
    expect(v2.network.switches).toEqual([])
    expect(v2.contracts).toEqual([])
    expect(v2.infra.premises).toBe('quarto')
    expect(v2.tempC).toBe(22)
    const t = eco.totals(v2.builds, v2.equipment)
    expect(t.vcpu).toBe(2 * 24 + 64)
    expect(t.watts).toBe(2 * 180 + 370)
    expect(t.units).toBe(3)
  })

  it('migrateV1toV2 mantem metadados', () => {
    const v2 = migrateV1toV2(v1)
    expect(v2.money).toBe(500)
    expect(v2.workLevel).toBe(2)
    expect(v2.stats.totalClicks).toBe(3)
  })

  it('payload v2 ganha rede vazia e contratos vazios', () => {
    const v2 = {
      version: 2 as const,
      createdTs: 1,
      lastTs: 2,
      seed: 3,
      money: 10,
      lifetimeProfit: 10,
      workLevel: 0,
      builds: [],
      equipment: [],
      infra: { premises: 'quarto' as const, dedicatedCircuit: false, racks42: 0, racks48: 0, upsModules: 0, cracUnits: 0 },
      tempC: 22,
      stats: { totalClicks: 0, totalEarned: 0, totalSpent: 0 },
    }
    const out = parseSave(JSON.stringify(v2))
    expect(out.version).toBe(4)
    expect(out.network.routers).toEqual({ r1f: 0, r2f: 0 })
    expect(out.contracts).toEqual([])
  })
})
