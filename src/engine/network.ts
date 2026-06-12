// Rede (especificacao §8): camada de acesso agregada (portas em Gbps, sem
// casamento de velocidade — simplificacao registrada), ratio de oversubscription,
// score do site e borda WAN (roteadores + links de transito).

import { FIREWALLS, ROUTERS, SWITCHES, TRANSIT_PER_GBPS_MONTH, WAN_LINKS, networkScore } from '../data/network'
import { modelById } from '../data/components'
import { BAL } from '../data/balance'
import type { Build, EquipGroup, Network } from './types'
import type { UnitItem } from './site'

/** Banda total das NICs dos servidores (demanda de downlink), em Gbps. */
export function nicDemandGbps(builds: Build[], equipment: EquipGroup[]): number {
  const byId = new Map(builds.map((b) => [b.id, b]))
  let g = 0
  for (const grp of equipment) {
    const b = byId.get(grp.buildId)
    if (!b) continue
    const model = modelById[b.parts.modelId]
    const nic = model.nicOptions.find((n) => n.id === b.parts.nicId)
    if (!nic) continue
    const per = nic.id === '1g' ? 2 : nic.id === '10g' ? 20 : nic.id === '25g' ? 50 : 200
    g += per * grp.count
  }
  return g
}

export interface AccessLayer {
  demandGbps: number
  portCapacityGbps: number
  /** Fracao da capacidade de servidores com porta de switch (0..1). */
  connectedFrac: number
  unconnectedGbps: number
  uplinkGbps: number
  /** ratio = downlink em uso / uplink ativo; Infinity sem uplink com demanda. */
  ratio: number
  /** Score do site (100/90/75/50). 100 sem demanda conectada. */
  score: number
}

export function accessLayer(net: Network, demandGbps: number): AccessLayer {
  let portCapacityGbps = 0
  let uplinkGbps = 0
  for (const g of net.switches) {
    const s = SWITCHES[g.model]
    portCapacityGbps += s.downPorts * s.downGbps * g.count
    const active = Math.min(Math.max(1, g.uplinks), s.uplinkPorts)
    const effective = g.lacp ? active : 1
    uplinkGbps += effective * s.uplinkGbps * g.count
  }
  const connectedGbps = Math.min(demandGbps, portCapacityGbps)
  const connectedFrac = demandGbps > 0 ? connectedGbps / demandGbps : portCapacityGbps > 0 ? 1 : 0
  const ratio = connectedGbps === 0 ? 0 : uplinkGbps > 0 ? connectedGbps / uplinkGbps : Infinity
  return {
    demandGbps,
    portCapacityGbps,
    connectedFrac,
    unconnectedGbps: Math.max(0, demandGbps - portCapacityGbps),
    uplinkGbps,
    ratio,
    score: connectedGbps === 0 ? 100 : networkScore(ratio),
  }
}

export interface WanStatus {
  routerCapacityGbps: number
  bgpSessions: number
  linkGbps: number
  linkCount: number
  /** Egress utilizavel = min(links, roteadores); 0 sem roteador ou sem link. */
  egressGbps: number
  /** Links acima das sessoes BGP disponiveis nao operam. */
  linksOverSessions: boolean
  transitPerSec: number
}

export function wanStatus(net: Network): WanStatus {
  const routerCapacityGbps = ROUTERS.r1f.capacityGbps * net.routers.r1f + ROUTERS.r2f.capacityGbps * net.routers.r2f
  const bgpSessions = ROUTERS.r1f.bgpSessions * net.routers.r1f + ROUTERS.r2f.bgpSessions * net.routers.r2f
  let linkGbps = 0
  let linkCount = 0
  for (const id of ['l1', 'l10', 'l100'] as const) {
    linkGbps += WAN_LINKS[id].gbps * net.links[id]
    linkCount += net.links[id]
  }
  const linksOverSessions = linkCount > bgpSessions
  const usableLinkGbps = linksOverSessions ? 0 : linkGbps
  return {
    routerCapacityGbps,
    bgpSessions,
    linkGbps,
    linkCount,
    egressGbps: Math.min(usableLinkGbps, routerCapacityGbps),
    linksOverSessions,
    transitPerSec: (linkGbps * TRANSIT_PER_GBPS_MONTH) / BAL.monthSeconds,
  }
}

export type TransitWarning = 'edge' | 'idle' | null

/**
 * Desperdicio de transito (UX): o transito cobra sobre a capacidade contratada,
 * entao avisa quando ha links pagos sem borda operante ('edge') ou com folga
 * grande em relacao ao alocado em contratos ('idle').
 */
export function transitWarning(net: Network, allocGbps: number): TransitWarning {
  const wan = wanStatus(net)
  if (wan.linkGbps === 0) return null
  if (wan.linksOverSessions) return 'edge'
  const idleGbps = wan.linkGbps - allocGbps
  if (idleGbps / wan.linkGbps >= BAL.transitIdleWarn.frac && idleGbps >= BAL.transitIdleWarn.minGbps)
    return 'idle'
  return null
}

export function firewallThroughputGbps(net: Network): number {
  return (
    FIREWALLS.fws.throughputGbps * net.firewalls.fws +
    FIREWALLS.fwm.throughputGbps * net.firewalls.fwm +
    FIREWALLS.fwl.throughputGbps * net.firewalls.fwl
  )
}

export function firewallCount(net: Network): number {
  return net.firewalls.fws + net.firewalls.fwm + net.firewalls.fwl
}

export function switchCount(net: Network): number {
  return net.switches.reduce((acc, g) => acc + g.count, 0)
}

/** Unidades fisicas de rede (ocupam U, consomem W; entram na alocacao e na carga IT). */
export function networkUnits(net: Network): UnitItem[] {
  const items: UnitItem[] = []
  for (const g of net.switches)
    for (let i = 0; i < g.count; i++)
      items.push({ buildId: `sw:${g.model}`, u: SWITCHES[g.model].u, watts: SWITCHES[g.model].watts })
  for (const id of ['r1f', 'r2f'] as const)
    for (let i = 0; i < net.routers[id]; i++)
      items.push({ buildId: `rt:${id}`, u: ROUTERS[id].u, watts: ROUTERS[id].watts })
  for (const id of ['fws', 'fwm', 'fwl'] as const)
    for (let i = 0; i < net.firewalls[id]; i++)
      items.push({ buildId: `fw:${id}`, u: FIREWALLS[id].u, watts: FIREWALLS[id].watts })
  return items
}
