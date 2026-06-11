import { describe, expect, it } from 'vitest'
import {
  coolingStatus,
  phaseOf,
  placeUnits,
  stepTemp,
  throttleMult,
  type UnitItem,
} from '../site'
import { newInfra, type Infra } from '../types'

const inf = (patch: Partial<Infra>): Infra => ({ ...newInfra(), ...patch })
const units = (n: number, u: number, watts: number): UnitItem[] =>
  Array.from({ length: n }, () => ({ buildId: 'x', u, watts }))

describe('placeUnits (FFD)', () => {
  it('aloca dentro de U e PDU do rack', () => {
    const p = placeUnits(inf({ racks42: 1 }), units(12, 1, 370))
    expect(p.ok).toBe(true)
    expect(p.racks[0].usedU).toBe(12)
    expect(p.racks[0].usedKw).toBeCloseTo(4.44, 6)
  })

  it('transborda para a bancada quando a PDU satura', () => {
    // 14x370 W = 5,18 kW: rack 42U recebe 13 (4,81 kW); a 14ª vai para a bancada
    const p = placeUnits(inf({ racks42: 1 }), units(14, 1, 370))
    expect(p.ok).toBe(true)
    expect(p.racks[0].usedU).toBe(13)
    expect(p.benchUsedU).toBe(1)
  })

  it('falha por PDU quando ha U mas nao ha kW (bancada cheia)', () => {
    const p = placeUnits(inf({ racks42: 1 }), units(22, 1, 370))
    expect(p.ok).toBe(false)
    expect(p.unplaced).toBe(1)
    expect(p.failReason).toBe('pdu')
  })

  it('falha por espaco (U) sem racks', () => {
    const p = placeUnits(inf({}), units(3, 4, 180)) // 12U > bancada 8U
    expect(p.ok).toBe(false)
    expect(p.failReason).toBe('space')
  })
})

describe('coolingStatus / PUE', () => {
  it('carga dentro da dissipacao ambiente: deficit 0, PUE 1', () => {
    const c = coolingStatus(inf({}), 0.5)
    expect(c.deficitFrac).toBe(0)
    expect(c.pue).toBe(1)
  })

  it('deficit sem CRAC na sala comercial', () => {
    const c = coolingStatus(inf({ premises: 'comercial' }), 10)
    expect(c.deficitFrac).toBeCloseTo(0.7, 6) // (10-3)/10
  })

  it('CRAC remove o excedente e compoe o PUE com perdas do UPS', () => {
    const c = coolingStatus(inf({ premises: 'comercial', cracUnits: 1, upsModules: 1 }), 10)
    expect(c.cracRemovedKw).toBeCloseTo(7, 6)
    expect(c.cracElecKw).toBeCloseTo(7 / 3, 6)
    expect(c.upsLossKw).toBeCloseTo(0.5, 6)
    expect(c.deficitFrac).toBe(0)
    expect(c.pue).toBeCloseTo((10 + 7 / 3 + 0.5) / 10, 6)
  })
})

describe('termica', () => {
  it('+1 °C/h por 10% de deficit', () => {
    expect(stepTemp(22, 0.5, 2)).toBeCloseTo(32, 6)
  })
  it('recupera ate o piso de 22 °C', () => {
    expect(stepTemp(30, 0, 2)).toBeCloseTo(26, 6)
    expect(stepTemp(23, 0, 5)).toBe(22)
  })
  it('throttle escalonado', () => {
    expect(throttleMult(26)).toBe(1)
    expect(throttleMult(27)).toBe(0.9)
    expect(throttleMult(33)).toBe(0.7)
    expect(throttleMult(36)).toBe(0.4)
  })
})

describe('fase', () => {
  it('F1 sem rack; F2 com 1 rack; F3 com 4 racks + UPS', () => {
    expect(phaseOf(inf({}), true)).toBe(1)
    expect(phaseOf(inf({ racks42: 1 }), true)).toBe(2)
    expect(phaseOf(inf({ premises: 'comercial', racks42: 2, racks48: 2, upsModules: 1 }), true)).toBe(3)
  })
})
