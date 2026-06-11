import { describe, expect, it } from 'vitest'
import * as eco from '../economy'
import { M1_PRESET_TO_PARTS, makeBuild } from '../build'
import { newInfra, type Build, type EquipGroup, type Infra, type SaveV2 } from '../types'

type EcoState = Pick<SaveV2, 'builds' | 'equipment' | 'infra' | 'tempC'>

function stateOf(
  counts: Record<string, number>,
  infra: Partial<Infra> = {},
  tempC = 22,
): EcoState {
  const builds: Build[] = []
  const equipment: EquipGroup[] = []
  for (const [presetId, count] of Object.entries(counts)) {
    const b = makeBuild(M1_PRESET_TO_PARTS[presetId])
    builds.push(b)
    equipment.push({ buildId: b.id, count })
  }
  return { builds, equipment, infra: { ...newInfra(), ...infra }, tempC }
}

describe('totals', () => {
  it('soma capacidades por grupo', () => {
    const s = stateOf({ rbt2: 2, 'hn1100-b': 1 })
    const t = eco.totals(s.builds, s.equipment)
    expect(t.vcpu).toBe(2 * 24 + 64)
    expect(t.watts).toBe(2 * 180 + 370)
    expect(t.u).toBe(2 * 4 + 1)
    expect(t.units).toBe(3)
  })
})

describe('fluxo de caixa', () => {
  it('renda avulsa com throttle 1 a 22 °C', () => {
    const s = stateOf({ rbt2: 1 })
    expect(eco.incomePerSec(s)).toBeCloseTo((24 * 8) / 720, 10)
  })
  it('renda com throttle 0,9 a 28 °C', () => {
    const s = stateOf({ rbt2: 1 }, {}, 28)
    expect(eco.incomePerSec(s)).toBeCloseTo(((24 * 8) / 720) * 0.9, 10)
  })
  it('energia = (IT + CRAC + perdas UPS) × tarifa', () => {
    // 50× hn1100-b = 18,5 kW IT na sala comercial com 1 UPS e 1 CRAC
    const s = stateOf({ 'hn1100-b': 50 }, { premises: 'comercial', upsModules: 1, cracUnits: 1 })
    const it = 18.5
    const crac = Math.min(it - 3, 30) / 3
    const loss = it * 0.05
    expect(eco.energyCostPerSec(s)).toBeCloseTo((it + crac + loss) * 0.12, 8)
  })
  it('aluguel da sala comercial', () => {
    expect(eco.rentPerSec({ ...newInfra(), premises: 'comercial' })).toBeCloseTo(250 / 720, 10)
  })
})

describe('preco progressivo por modelo', () => {
  it('usa unidades do mesmo modelo entre builds diferentes', () => {
    const s = stateOf({ 'hn1100-a': 1, 'hn1100-b': 2 })
    expect(eco.countOfModel(s.builds, s.equipment, 'HN-1100')).toBe(3)
    expect(eco.buildPrice(s, M1_PRESET_TO_PARTS['hn1100-a'])).toBe(Math.round(1660 * 1.12 ** 3))
  })
})

describe('canBuyBuild — bloqueios fisicos', () => {
  it("bloqueia por entrada da instalacao ('feed')", () => {
    // 6 torres no rack (1,08 kW); +1 torre = 1,26 kW > 1,2 kW do quarto
    const s = stateOf({ rbt2: 6 }, { racks42: 1 })
    const check = eco.canBuyBuild({ money: 1e9, ...s }, M1_PRESET_TO_PARTS['rbt2'])
    expect(check.ok).toBe(false)
    expect(check.reason).toBe('feed')
  })

  it("bloqueia por teto do UPS ('ups')", () => {
    // 48× hn1100-b = 17,76 kW ≤ 18 kW (1 modulo); +1 = 18,13 kW > 18 kW
    const s = stateOf({ 'hn1100-b': 48 }, { premises: 'comercial', racks48: 2, upsModules: 1 })
    const check = eco.canBuyBuild({ money: 1e9, ...s }, M1_PRESET_TO_PARTS['hn1100-b'])
    expect(check.ok).toBe(false)
    expect(check.reason).toBe('ups')
  })

  it("bloqueia por espaco ('space') sem rack", () => {
    const s = stateOf({ rbt2: 2 }) // 8U na bancada cheia
    const check = eco.canBuyBuild({ money: 1e9, ...s }, M1_PRESET_TO_PARTS['rbt2'])
    expect(check.ok).toBe(false)
    expect(check.reason).toBe('space')
  })

  it('bloqueia por dinheiro apos passar nos limites fisicos', () => {
    const check = eco.canBuyBuild({ money: 0, ...stateOf({}) }, M1_PRESET_TO_PARTS['rbt2'])
    expect(check.reason).toBe('money')
    expect(check.price).toBe(180)
  })
})

describe('infraestrutura', () => {
  it('UPS exige sala comercial', () => {
    const c = eco.canBuyInfra({ money: 1e9, infra: newInfra() }, 'ups')
    expect(c.ok).toBe(false)
    expect(c.reason).toBe('premises')
  })
  it('limite de vagas de rack no quarto (1)', () => {
    const c = eco.canBuyInfra({ money: 1e9, infra: { ...newInfra(), racks42: 1 } }, 'r42')
    expect(c.reason).toBe('limit')
  })
  it('aplica compras', () => {
    let infra = newInfra()
    infra = eco.applyBuyInfra(infra, 'comercial')
    infra = eco.applyBuyInfra(infra, 'ups')
    infra = eco.applyBuyInfra(infra, 'r48')
    expect(infra).toMatchObject({ premises: 'comercial', upsModules: 1, racks48: 1 })
  })
})

describe('sanitize', () => {
  it('remove grupos orfaos e builds sem uso', () => {
    const b = makeBuild(M1_PRESET_TO_PARTS['rbt2'])
    const out = eco.sanitize([b], [
      { buildId: b.id, count: 1 },
      { buildId: 'ghost', count: 5 },
      { buildId: b.id + '_zero', count: 0 },
    ])
    expect(out.equipment).toEqual([{ buildId: b.id, count: 1 }])
    expect(out.builds).toEqual([b])
  })
})
