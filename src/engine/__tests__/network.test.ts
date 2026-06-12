import { describe, expect, it } from 'vitest'
import { accessLayer, networkUnits, wanStatus } from '../network'
import { networkScore } from '../../data/network'
import { newNetwork, type Network } from '../types'

const net = (patch: Partial<Network>): Network => ({ ...newNetwork(), ...patch })

describe('networkScore (tabela §8)', () => {
  it('faixas 100/90/75/50', () => {
    expect(networkScore(1.5)).toBe(100)
    expect(networkScore(3)).toBe(100)
    expect(networkScore(5)).toBe(90)
    expect(networkScore(12)).toBe(75)
    expect(networkScore(20)).toBe(50)
  })
})

describe('accessLayer', () => {
  it('exemplo do catalogo: SL-48X 1200G down / 8x100G LACP = 1,5:1', () => {
    const a = accessLayer(
      net({ switches: [{ model: 'sl48x', uplinks: 8, lacp: true, count: 1 }] }),
      1200,
    )
    expect(a.portCapacityGbps).toBe(1200)
    expect(a.uplinkGbps).toBe(800)
    expect(a.ratio).toBeCloseTo(1.5, 6)
    expect(a.score).toBe(100)
  })

  it('sem LACP apenas 1 uplink fica ativo', () => {
    const a = accessLayer(
      net({ switches: [{ model: 'sl48x', uplinks: 8, lacp: false, count: 1 }] }),
      1200,
    )
    expect(a.uplinkGbps).toBe(100)
    expect(a.ratio).toBeCloseTo(12, 6)
    expect(a.score).toBe(75)
  })

  it('demanda acima das portas: fracao conectada e excedente', () => {
    const a = accessLayer(net({ switches: [{ model: 'sl24', uplinks: 2, lacp: true, count: 1 }] }), 48)
    expect(a.portCapacityGbps).toBe(24)
    expect(a.connectedFrac).toBeCloseTo(0.5, 6)
    expect(a.unconnectedGbps).toBe(24)
  })

  it('sem switch: nada conectado; sem demanda: score 100', () => {
    expect(accessLayer(net({}), 40).connectedFrac).toBe(0)
    expect(accessLayer(net({}), 0).score).toBe(100)
  })
})

describe('wanStatus', () => {
  it('egress = min(links, roteadores)', () => {
    const w = wanStatus(net({ routers: { r1f: 1, r2f: 0 }, links: { l1: 0, l10: 0, l100: 1 } }))
    expect(w.egressGbps).toBe(40)
    expect(w.transitPerSec).toBeCloseTo((100 * 800) / 720, 8)
  })

  it('links acima das sessoes BGP derrubam a borda', () => {
    const w = wanStatus(net({ routers: { r1f: 1, r2f: 0 }, links: { l1: 2, l10: 0, l100: 0 } }))
    expect(w.linksOverSessions).toBe(true)
    expect(w.egressGbps).toBe(0)
  })

  it('RC-2F fornece 4 sessoes', () => {
    const w = wanStatus(net({ routers: { r1f: 0, r2f: 1 }, links: { l1: 3, l10: 1, l100: 0 } }))
    expect(w.linksOverSessions).toBe(false)
    expect(w.egressGbps).toBe(13)
  })
})

describe('networkUnits', () => {
  it('equipamentos de rede ocupam U e consomem W', () => {
    const items = networkUnits(
      net({
        switches: [{ model: 'sl48t', uplinks: 6, lacp: true, count: 2 }],
        routers: { r1f: 1, r2f: 0 },
        firewalls: { fws: 0, fwm: 1, fwl: 0 },
      }),
    )
    expect(items).toHaveLength(4)
    expect(items.reduce((a, i) => a + i.watts, 0)).toBe(2 * 150 + 60 + 90)
    expect(items.reduce((a, i) => a + i.u, 0)).toBe(4)
  })
})
