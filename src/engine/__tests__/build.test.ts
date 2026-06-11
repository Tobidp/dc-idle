import { describe, expect, it } from 'vitest'
import { buildId, computeBuild, makeBuild, M1_PRESET_TO_PARTS, validateParts } from '../build'
import type { BuildParts } from '../types'

describe('computeBuild — equivalencia com os presets do M1', () => {
  it('RB-T2 (2×6c, 4×8 GB)', () => {
    const s = computeBuild(M1_PRESET_TO_PARTS['rbt2'])
    expect(s).toMatchObject({ price: 180, watts: 180, vcpu: 24, ramGb: 32, storageTb: 0, uSize: 4 })
  })
  it('HN-1100 entrada (1×8c, 4×16 GB)', () => {
    const s = computeBuild(M1_PRESET_TO_PARTS['hn1100-a'])
    expect(s).toMatchObject({ price: 1660, watts: 175, vcpu: 16, ramGb: 64, uSize: 1 })
  })
  it('HN-1100 denso (2×16c, 8×32 GB)', () => {
    const s = computeBuild(M1_PRESET_TO_PARTS['hn1100-b'])
    expect(s).toMatchObject({ price: 3680, watts: 370, vcpu: 64, ramGb: 256, uSize: 1 })
  })
})

describe('computeBuild — composicao completa (HN-2200 topo)', () => {
  it('soma chassi + componentes', () => {
    const parts: BuildParts = {
      modelId: 'HN-2200',
      cpuId: 'e64',
      cpuCount: 2,
      dimmId: 'd5-128',
      dimmCount: 24,
      nicId: '100g',
      psuCount: 2,
      nvmeId: 'n16',
      nvmeCount: 8,
    }
    const s = computeBuild(parts)
    expect(s.price).toBe(4800 + 2 * 7000 + 24 * 420 + 1400 + 160 + 8 * 1300)
    expect(s.watts).toBe(130 + 2 * 280 + 24 * 6 + 20 + 8 + 8 * 10)
    expect(s.vcpu).toBe(256)
    expect(s.ramGb).toBe(3072)
    expect(s.storageTb).toBe(128)
    expect(s.uSize).toBe(2)
  })
})

describe('validateParts', () => {
  const base = M1_PRESET_TO_PARTS['hn1100-a']
  it('aceita configuracao valida', () => {
    expect(validateParts(base)).toEqual([])
  })
  it('rejeita CPUs acima dos sockets', () => {
    expect(validateParts({ ...base, cpuCount: 3 })).toContain('cpuCount')
  })
  it('rejeita 2ª PSU em modelo sem a opcao', () => {
    expect(validateParts({ ...M1_PRESET_TO_PARTS['rbt2'], psuCount: 2 })).toContain('psu')
  })
  it('rejeita contagem NVMe inconsistente', () => {
    expect(validateParts({ ...base, nvmeId: null, nvmeCount: 2 })).toContain('nvmeCount')
    expect(validateParts({ ...base, nvmeId: 'n8', nvmeCount: 0 })).toContain('nvmeCount')
  })
})

describe('buildId', () => {
  it('e deterministico (dedupe)', () => {
    const a = makeBuild(M1_PRESET_TO_PARTS['hn1100-b'])
    const b = makeBuild({ ...M1_PRESET_TO_PARTS['hn1100-b'] })
    expect(a.id).toBe(b.id)
    expect(buildId(a.parts)).toBe(a.id)
  })
})
