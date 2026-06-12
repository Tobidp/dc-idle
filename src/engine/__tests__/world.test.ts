import { describe, expect, it } from 'vitest'
import {
  advanceWorld,
  ddosMitigationGbps,
  effectsAt,
  maybeHumanError,
  upContribution,
  NO_EFFECTS,
  type WorldLabels,
  type WorldState,
} from '../world'
import { newInfra, newNetwork, type SaveV4 } from '../types'
import { M1_PRESET_TO_PARTS, makeBuild } from '../build'
import { BAL } from '../../data/balance'

const L: WorldLabels = {
  utility: () => 'utility',
  ddos: () => 'ddos',
  fiber: () => 'fiber',
  psu: () => 'psu',
  upsmod: () => 'upsmod',
  cracunit: () => 'cracunit',
  human: () => 'human',
  resolved: () => 'resolved',
  marketEvent: () => 'event',
  fine: () => 'fine',
  cancelledBySla: () => 'cancelled',
  completed: () => 'completed',
}

function world(over: Partial<WorldState> = {}): WorldState {
  const b = makeBuild(M1_PRESET_TO_PARTS['hn1100-b'])
  return {
    builds: [b],
    equipment: [{ buildId: b.id, count: 4 }],
    infra: { ...newInfra(), premises: 'comercial', racks42: 1 },
    network: {
      ...newNetwork(),
      switches: [{ model: 'sl48t', uplinks: 6, lacp: true, count: 1 }],
      routers: { r1f: 1, r2f: 0 },
      links: { l1: 0, l10: 1, l100: 0 },
      firewalls: { fws: 0, fwm: 0, fwl: 0 },
    },
    contracts: [],
    offers: [],
    incidents: [],
    log: [],
    reputation: 20,
    marketEvent: null,
    nextOfferTs: 1e15,
    nextEventCheckTs: 1e15,
    rngState: 1,
    scrubbing: false,
    nextId: 1,
    tempC: 22,
    money: 0,
    ...over,
  }
}

function contract(type: string, monthly: number, over: Partial<SaveV4['contracts'][number]> = {}): SaveV4['contracts'][number] {
  return { id: 99, type, acceptedTs: 0, monthly, endTs: 1e15, winSec: 0, upSec: 0, ...over }
}

describe('effectsAt — queda da concessionaria (§13)', () => {
  it('sem UPS e sem gerador: site down durante todo o evento', () => {
    const s = world({ incidents: [{ id: 1, kind: 'utility', startTs: 0, durSec: 4, mag: 0 }] })
    expect(effectsAt(s, 2000).siteDown).toBe(true)
  })

  it('UPS cobre apenas a autonomia de 10 min de jogo', () => {
    const s = world({
      infra: { ...newInfra(), premises: 'comercial', racks42: 1, upsModules: 1 },
      incidents: [{ id: 1, kind: 'utility', startTs: 0, durSec: 4, mag: 0 }],
    })
    expect(effectsAt(s, Math.round(BAL.incidents.upsAutonomyGameH * 1000) - 50).siteDown).toBe(false)
    expect(effectsAt(s, 1000).siteDown).toBe(true)
  })

  it('UPS + gerador: sem queda; gerador em operacao (diesel)', () => {
    const s = world({
      infra: { ...newInfra(), premises: 'comercial', racks42: 1, upsModules: 1, generator: 1 },
      incidents: [{ id: 1, kind: 'utility', startTs: 0, durSec: 4, mag: 0 }],
    })
    const e = effectsAt(s, 2000)
    expect(e.siteDown).toBe(false)
    expect(e.generatorRunning).toBe(true)
  })
})

describe('mitigacao DDoS (§6.5)', () => {
  it('soma firewalls + scrubbing', () => {
    const net = { ...newNetwork(), firewalls: { fws: 2, fwm: 1, fwl: 1 } }
    expect(ddosMitigationGbps(net, false)).toBeCloseTo(2 * 0.5 + 5 + 40, 6)
    expect(ddosMitigationGbps(net, true)).toBeCloseTo(46 + 50, 6)
  })

  it('ataque acima da mitigacao degrada expostos; abaixo, nao', () => {
    const base = world({ network: { ...world().network, firewalls: { fws: 0, fwm: 1, fwl: 0 } } })
    const small = { ...base, incidents: [{ id: 1, kind: 'ddos' as const, startTs: 0, durSec: 4, mag: 4 }] }
    const big = { ...base, incidents: [{ id: 1, kind: 'ddos' as const, startTs: 0, durSec: 4, mag: 80 }] }
    expect(effectsAt(small, 1000).ddosUnmitigated).toBe(false)
    expect(effectsAt(big, 1000).ddosUnmitigated).toBe(true)
  })
})

describe('upContribution (§10)', () => {
  it('DDoS nao mitigado zera apenas contratos expostos (gbps > 0)', () => {
    const e = { ...NO_EFFECTS, ddosUnmitigated: true }
    expect(upContribution('video', 1, 100, false, e)).toBe(0)
    expect(upContribution('blog', 1, 100, false, e)).toBe(1)
  })

  it('score < 75 penaliza apenas sensiveis; throttle atinge todos', () => {
    expect(upContribution('video', 1, 50, false, NO_EFFECTS)).toBeCloseTo(0.5, 6)
    expect(upContribution('blog', 1, 50, false, NO_EFFECTS)).toBe(1)
    expect(upContribution('blog', 0.9, 100, false, NO_EFFECTS)).toBeCloseTo(0.9, 6)
  })
})

describe('janela de SLA — multas e creditos (§10)', () => {
  function settle(upFrac: number, monthly = 1000, type = 'blog') {
    const s = world({
      contracts: [contract(type, monthly, { winSec: 719, upSec: 719 * upFrac })],
    })
    // 1 s final fecha a janela com contribuicao = upFrac (forcada via incidente? nao: usa estado limpo)
    const r = advanceWorld(s, 0, 1, upFrac, L)
    return r
  }

  it('dentro do alvo: sem multa', () => {
    expect(settle(1).fines).toBe(0)
  })

  it('faixas de credito 10% / 25% / 50%', () => {
    // blog SLA 99,0%
    expect(settle(0.9895).fines).toBeCloseTo(100, 6) // shortfall 0,05 pp -> 10%
    expect(settle(0.985).fines).toBeCloseTo(250, 6) // 0,5 pp -> 25%
    expect(settle(0.9).fines).toBeCloseTo(500, 6) // 9 pp -> 50%
  })

  it('violacao grave reduz reputacao e pode rescindir (RNG semeado)', () => {
    const r = settle(0.5)
    expect(r.state.reputation).toBe(20 - BAL.sla.repPenalty)
    expect(r.fines).toBeCloseTo(500, 6)
  })

  it('conclusao no prazo devolve +1 reputacao e remove o contrato', () => {
    const s = world({ contracts: [contract('blog', 15, { endTs: 500 })] })
    const r = advanceWorld(s, 1000, 1, 1, L)
    expect(r.state.contracts).toHaveLength(0)
    expect(r.state.reputation).toBe(21)
  })
})

describe('criterio de aceite do M4', () => {
  it('DDoS sem mitigacao gera multa na janela seguinte', () => {
    // video (SLA 99,9%) exposto; DDoS 80 Gbps sem firewall cobre a janela inteira
    let s = world({
      contracts: [contract('video', 14000)],
      incidents: [{ id: 1, kind: 'ddos', startTs: 0, durSec: 7200, mag: 80 }],
    })
    let fines = 0
    for (let t = 0; t < BAL.sla.windowSec; t += 60) {
      const r = advanceWorld(s, t * 1000, 60, 1, L)
      s = r.state
      fines += r.fines
    }
    expect(fines).toBeCloseTo(14000 * 0.5, 6) // 0% de uptime -> credito de 50%
    expect(s.log.some((e) => e.text === 'fine')).toBe(true)
  })
})

describe('mercado dinamico (§10)', () => {
  it('regenera ofertas deterministicamente e expira pelo TTL', () => {
    const s = world({ nextOfferTs: 0, nextEventCheckTs: 1e15, rngState: 123 })
    const r1 = advanceWorld(s, 0, 1, 1, L)
    expect(r1.state.offers.length).toBeGreaterThan(0)
    expect(r1.state.nextOfferTs).toBeGreaterThan(0)
    const again = advanceWorld(s, 0, 1, 1, L)
    expect(again.state.offers).toEqual(r1.state.offers) // mesmo RNG -> mesmas ofertas
    const far = r1.state.offers[0].expiresTs + 1
    const r2 = advanceWorld({ ...r1.state, nextOfferTs: 1e15 }, far, 1, 1, L)
    expect(r2.state.offers.find((o) => o.id === r1.state.offers[0].id)).toBeUndefined()
  })

  it('precos das ofertas respeitam o jitter de ±20%', () => {
    let s = world({ nextOfferTs: 0, rngState: 9 })
    for (let i = 0; i < 5; i++) s = advanceWorld(s, i * 100000, 1, 1, L).state
    for (const o of s.offers) {
      const base = { blog: 15, pme: 40, loja: 220, backend: 520, video: 14000 }[o.type]!
      expect(o.monthly).toBeGreaterThanOrEqual(Math.floor(base * 0.8))
      expect(o.monthly).toBeLessThanOrEqual(Math.ceil(base * 1.2))
    }
  })
})

describe('erro humano (§13)', () => {
  it('2% por acao: com RNG forcado abaixo do limiar, gera incidente de acesso', () => {
    // procura um estado de RNG cujo primeiro sorteio fique abaixo de 0,02
    let seed = 1
    for (; seed < 5000; seed++) {
      const probe = maybeHumanError(world({ rngState: seed }), 0, L)
      if (probe.incidents.length === 1) break
    }
    const s = maybeHumanError(world({ rngState: seed }), 0, L)
    expect(s.incidents[0]?.kind).toBe('human')
    expect(effectsAt(s, 100).accessDown).toBe(true)
  })
})
