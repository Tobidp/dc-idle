import { describe, expect, it } from 'vitest'
import { computeOffline } from '../offline'
import { netPerSec } from '../economy'
import { M1_PRESET_TO_PARTS, makeBuild } from '../build'
import { BAL } from '../../data/balance'
import { newInfra, type SaveV2 } from '../types'

function baseState(): Pick<SaveV2, 'lastTs' | 'builds' | 'equipment' | 'infra' | 'tempC'> {
  const b = makeBuild(M1_PRESET_TO_PARTS['rbt2'])
  return { lastTs: 0, builds: [b], equipment: [{ buildId: b.id, count: 1 }], infra: newInfra(), tempC: 22 }
}

describe('computeOffline', () => {
  it('paga taxa liquida x tempo abaixo do teto', () => {
    const s = baseState()
    const r = computeOffline(s, 100_000)
    expect(r.paidSeconds).toBe(100)
    expect(r.gained).toBeCloseTo(netPerSec(s) * 100, 8)
  })

  it('aplica o teto de 12 h', () => {
    const s = baseState()
    const r = computeOffline(s, 24 * 3600 * 1000)
    expect(r.paidSeconds).toBe(BAL.offline.capRealSeconds)
    expect(r.capped).toBe(true)
  })

  it('aluguel da sala comercial entra no liquido offline', () => {
    const s = { ...baseState(), infra: { ...newInfra(), premises: 'comercial' as const } }
    const r = computeOffline(s, 100_000)
    expect(r.gained).toBeCloseTo((netPerSec(s)) * 100, 8)
    expect(netPerSec(s)).toBeLessThan(netPerSec(baseState()))
  })

  it('relogio para tras nao gera ganho', () => {
    const r = computeOffline({ ...baseState(), lastTs: 10_000 }, 5_000)
    expect(r.elapsedSeconds).toBe(0)
    expect(r.gained).toBe(0)
  })
})
