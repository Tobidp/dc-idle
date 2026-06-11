import { describe, expect, it } from 'vitest'
import { exportSave, importSave, migrateV1toV2, parseSave } from './persistence'
import { newSave } from '../engine/types'
import { M1_PRESET_TO_PARTS, makeBuild } from '../engine/build'
import * as eco from '../engine/economy'

describe('export/import v2', () => {
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
    expect(out.version).toBe(2)
    expect(out.money).toBe(123.45)
    expect(out.equipment).toEqual([{ buildId: b.id, count: 2 }])
    expect(out.infra.racks42).toBe(1)
  })

  it('rejeita payload invalido', () => {
    expect(() => importSave('@@nao-e-base64@@')).toThrow()
    expect(() => parseSave('{"version":3}')).toThrow()
  })
})

describe('migracao v1 -> v2', () => {
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
    expect(v2.version).toBe(2)
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
})
