// Contratos estaticos (especificacao §10) com SLA simples (M3):
// qualidade = throttle termico x (score de rede, se sensivel). A receita efetiva
// escala com a qualidade; janela mensal formal com multas/creditos entra no M4.

import { CONTRACT_TYPES, contractById, type ContractType } from '../data/contracts'
import { totals, throttleMult } from './site'
import {
  accessLayer,
  firewallCount,
  firewallThroughputGbps,
  nicDemandGbps,
  switchCount,
  wanStatus,
  type AccessLayer,
  type WanStatus,
} from './network'
import { BAL } from '../data/balance'
import { NO_EFFECTS, type Effects } from './world'
import type { SaveV4 } from './types'

export type ContractsState = Pick<SaveV4, 'builds' | 'equipment' | 'network' | 'contracts' | 'tempC'>

export interface Alloc {
  vcpu: number
  ramGb: number
  tb: number
  gbps: number
  /** Gbps somados apenas dos contratos que exigem firewall. */
  fwGbps: number
}

export function allocOf(contracts: SaveV4['contracts']): Alloc {
  const a: Alloc = { vcpu: 0, ramGb: 0, tb: 0, gbps: 0, fwGbps: 0 }
  for (const inst of contracts) {
    const c = contractById[inst.type]
    if (!c) continue
    a.vcpu += c.vcpu
    a.ramGb += c.ramGb
    a.tb += c.tb
    a.gbps += c.gbps
    if (c.requires.firewall) a.fwGbps += c.gbps
  }
  return a
}

export interface ContractsStatus {
  access: AccessLayer
  wan: WanStatus
  alloc: Alloc
  /** Capacidade conectada (pool para contratos) = instalada x fracao conectada. */
  pool: { vcpu: number; ramGb: number; tb: number }
  fwThroughputGbps: number
  active: { index: number; inst: SaveV4['contracts'][number]; type: ContractType; quality: number; revenuePerSec: number }[]
  revenuePerSec: number
}

export function contractQuality(
  type: ContractType,
  tempC: number,
  accessScore: number,
  effects: Effects = NO_EFFECTS,
  egressShort = false,
): number {
  if (effects.siteDown || effects.accessDown) return 0
  if (type.gbps > 0 && (effects.ddosUnmitigated || egressShort)) return 0
  const net = type.netSensitive ? accessScore / 100 : 1
  return throttleMult(tempC) * net
}

export function contractsStatus(state: ContractsState, effects: Effects = NO_EFFECTS): ContractsStatus {
  const t = totals(state.builds, state.equipment)
  const access = accessLayer(state.network, nicDemandGbps(state.builds, state.equipment))
  const wan = wanStatus(state.network)
  const alloc = allocOf(state.contracts)
  const pool = {
    vcpu: t.vcpu * access.connectedFrac,
    ramGb: t.ramGb * access.connectedFrac,
    tb: t.storageTb * access.connectedFrac,
  }
  const egressShort = wan.egressGbps - effects.fiberDownGbps + 1e-9 < alloc.gbps
  const active = state.contracts.map((inst, index) => {
    const type = contractById[inst.type]
    const quality = contractQuality(type, state.tempC, access.score, effects, egressShort)
    return { index, inst, type, quality, revenuePerSec: (inst.monthly / BAL.monthSeconds) * quality }
  })
  return {
    access,
    wan,
    alloc,
    pool,
    fwThroughputGbps: firewallThroughputGbps(state.network),
    active,
    revenuePerSec: active.reduce((acc, a) => acc + a.revenuePerSec, 0),
  }
}

export type AcceptDenied =
  | 'locked'
  | 'vlan'
  | 'firewall'
  | 'wan'
  | 'vcpu'
  | 'ram'
  | 'tb'

export interface AcceptCheck {
  ok: boolean
  reason?: AcceptDenied
}

export function canAccept(state: ContractsState, typeId: string): AcceptCheck {
  const c = contractById[typeId]
  if (!c) return { ok: false, reason: 'locked' }
  // Tier/certificacao: avaliacao e auditoria chegam no M6
  if (c.requires.tierMin || c.requires.cert) return { ok: false, reason: 'locked' }

  const st = contractsStatus(state)
  if (c.requires.vlan && switchCount(state.network) === 0) return { ok: false, reason: 'vlan' }
  if (c.requires.firewall) {
    const need = st.alloc.fwGbps + c.gbps
    if (firewallCount(state.network) === 0 || st.fwThroughputGbps + 1e-9 < need)
      return { ok: false, reason: 'firewall' }
  }
  if (st.wan.egressGbps + 1e-9 < st.alloc.gbps + c.gbps) return { ok: false, reason: 'wan' }
  if (st.pool.vcpu + 1e-9 < st.alloc.vcpu + c.vcpu) return { ok: false, reason: 'vcpu' }
  if (st.pool.ramGb + 1e-9 < st.alloc.ramGb + c.ramGb) return { ok: false, reason: 'ram' }
  if (st.pool.tb + 1e-9 < st.alloc.tb + c.tb) return { ok: false, reason: 'tb' }
  return { ok: true }
}

export function listTypes(): ContractType[] {
  return CONTRACT_TYPES
}
