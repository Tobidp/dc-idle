import { describe, expect, it } from 'vitest'
import { allocOf, canAccept, contractsStatus, type ContractsState } from '../contracts'
import { contractsPerSec, adhocPerSec } from '../economy'
import { M1_PRESET_TO_PARTS, makeBuild } from '../build'
import { newInfra, newNetwork, type Network, type SaveV4 } from '../types'
import { BAL } from '../../data/balance'

/**
 * Base: 10x HN-1100 denso (640 vCPU, 2.560 GB, 3,7 kW) + storage via NVMe,
 * 1x SL-48T (480G portas; demanda 10x20G = 200G), RC-1F + link 10G, FW-M.
 */
type TestState = ContractsState & Pick<SaveV4, 'infra'>

function inst(type: string): SaveV4['contracts'][number] {
  const monthly = { blog: 15, loja: 220, video: 14000, saas: 2400 }[type] ?? 100
  return { id: 1, type, acceptedTs: 0, monthly, endTs: 1e15, winSec: 0, upSec: 0 }
}

function baseState(over: Partial<TestState> = {}): TestState {
  const b = makeBuild({ ...M1_PRESET_TO_PARTS['hn1100-b'], nvmeId: 'n16', nvmeCount: 4 })
  const network: Network = {
    ...newNetwork(),
    switches: [{ model: 'sl48t', uplinks: 6, lacp: true, count: 1 }],
    routers: { r1f: 1, r2f: 0 },
    links: { l1: 0, l10: 1, l100: 0 },
    firewalls: { fws: 0, fwm: 1, fwl: 0 },
  }
  return {
    builds: [b],
    equipment: [{ buildId: b.id, count: 10 }],
    network,
    contracts: [],
    tempC: 22,
    infra: { ...newInfra(), premises: 'comercial', racks42: 2 },
    ...over,
  }
}

describe('allocOf', () => {
  it('soma recursos e separa Gbps com exigencia de firewall', () => {
    const a = allocOf([
      inst('loja'),
      inst('video'),
    ])
    expect(a.vcpu).toBe(40)
    expect(a.gbps).toBeCloseTo(10.1, 6)
    expect(a.fwGbps).toBeCloseTo(0.1, 6)
  })
})

describe('canAccept — exigencias', () => {
  it('aceita blog com rede e WAN ativas', () => {
    expect(canAccept(baseState(), 'blog').ok).toBe(true)
  })

  it('Tier/certificacao ficam bloqueados ate o M6', () => {
    expect(canAccept(baseState(), 'saas').reason).toBe('locked')
    expect(canAccept(baseState(), 'fintech').reason).toBe('locked')
    expect(canAccept(baseState(), 'governo').reason).toBe('locked')
  })

  it('VLAN exige switch', () => {
    const s = baseState({ network: { ...newNetwork(), routers: { r1f: 1, r2f: 0 }, links: { l1: 1, l10: 0, l100: 0 } } })
    expect(canAccept(s, 'backend').reason).toBe('vlan')
  })

  it('firewall exige throughput suficiente', () => {
    const noFw = baseState()
    noFw.network = { ...noFw.network, firewalls: { fws: 0, fwm: 0, fwl: 0 } }
    expect(canAccept(noFw, 'loja').reason).toBe('firewall')
  })

  it('egress WAN limita os Gbps alocados', () => {
    const s = baseState()
    expect(canAccept(s, 'video').ok).toBe(true) // 10G de egress
    const comVideo = baseState({ contracts: [inst('video')] })
    expect(canAccept(comVideo, 'loja').reason).toBe('wan') // 10 + 0,1 > 10
  })

  it('pool conectado limita vCPU', () => {
    const s = baseState({ contracts: Array.from({ length: 620 }, () => (inst('blog'))) })
    expect(canAccept(s, 'video').reason).toBe('vcpu') // 620 + 32 > 640
  })
})

describe('SLA simples — criterio de aceite do M3', () => {
  it('ratio > 3:1 degrada contrato sensivel de forma mensuravel', () => {
    const ok = baseState({ contracts: [inst('video')] })
    const okRev = contractsPerSec(ok)
    expect(okRev).toBeCloseTo(14000 / BAL.monthSeconds, 8) // ratio 200/240 -> score 100

    const degradado = baseState({ contracts: [inst('video')] })
    degradado.network = {
      ...degradado.network,
      switches: [{ model: 'sl48t', uplinks: 1, lacp: false, count: 1 }], // uplink 40G -> ratio 5:1
    }
    const st = contractsStatus(degradado)
    expect(st.access.score).toBe(90)
    expect(contractsPerSec(degradado)).toBeCloseTo((14000 / BAL.monthSeconds) * 0.9, 8)
  })

  it('contrato nao sensivel ignora o score; throttle termico atinge ambos', () => {
    const s = baseState({ contracts: [inst('blog')], tempC: 28 })
    s.network = { ...s.network, switches: [{ model: 'sl48t', uplinks: 1, lacp: false, count: 1 }] }
    expect(contractsPerSec(s)).toBeCloseTo((15 / BAL.monthSeconds) * 0.9, 8) // so throttle
  })

  it('vCPU alocada sai da hospedagem avulsa', () => {
    const semContrato = baseState()
    const comContrato = baseState({ contracts: [inst('video')] })
    const diff = adhocPerSec(semContrato) - adhocPerSec(comContrato)
    expect(diff).toBeCloseTo((32 * BAL.adhocPerVcpuMonth) / BAL.monthSeconds, 8)
  })
})

describe('infra fisica integrada', () => {
  it('equipamento de rede entra na carga IT do site', () => {
    const s = baseState()
    const st = contractsStatus(s)
    expect(st.access.portCapacityGbps).toBe(480)
  })
})
