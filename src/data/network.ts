// Catalogo de rede (especificacao §6.2/§6.3/§6.5) e WAN (§6.6).
// Precos sem semente na §19 sao parametros de jogo (registrados em docs/decisoes.md).
// SL-32C/SL-32D (spine) e RC-M6 modular adiados para o M6 (spine-leaf/Tier).

export type SwitchModelId = 'sl24' | 'sl48t' | 'sl48x'

export interface SwitchSpec {
  id: SwitchModelId
  name: string
  downPorts: number
  downGbps: number
  uplinkPorts: number
  uplinkGbps: number
  price: number
  watts: number
  u: number
}

export const SWITCHES: Record<SwitchModelId, SwitchSpec> = {
  sl24: { id: 'sl24', name: 'SL-24G · acesso', downPorts: 24, downGbps: 1, uplinkPorts: 2, uplinkGbps: 10, price: 150, watts: 30, u: 1 },
  sl48t: { id: 'sl48t', name: 'SL-48T · ToR', downPorts: 48, downGbps: 10, uplinkPorts: 6, uplinkGbps: 40, price: 2500, watts: 150, u: 1 },
  sl48x: { id: 'sl48x', name: 'SL-48X · ToR', downPorts: 48, downGbps: 25, uplinkPorts: 8, uplinkGbps: 100, price: 4500, watts: 250, u: 1 },
}

export type RouterModelId = 'r1f' | 'r2f'

export interface RouterSpec {
  id: RouterModelId
  name: string
  capacityGbps: number
  bgpSessions: number
  price: number
  watts: number
  u: number
}

export const ROUTERS: Record<RouterModelId, RouterSpec> = {
  r1f: { id: 'r1f', name: 'RC-1F · 4×10G', capacityGbps: 40, bgpSessions: 1, price: 800, watts: 60, u: 1 },
  r2f: { id: 'r2f', name: 'RC-2F · 2×100G + 8×10G', capacityGbps: 280, bgpSessions: 4, price: 6000, watts: 350, u: 1 },
}

export type LinkSizeId = 'l1' | 'l10' | 'l100'

export interface LinkSpec { id: LinkSizeId; name: string; gbps: number }

export const WAN_LINKS: Record<LinkSizeId, LinkSpec> = {
  l1: { id: 'l1', name: 'Link 1 Gbps', gbps: 1 },
  l10: { id: 'l10', name: 'Link 10 Gbps', gbps: 10 },
  l100: { id: 'l100', name: 'Link 100 Gbps', gbps: 100 },
}

/** Transito: $/Gbps/mes de jogo sobre a capacidade contratada (§19). */
export const TRANSIT_PER_GBPS_MONTH = 800

export type FirewallModelId = 'fws' | 'fwm' | 'fwl'

export interface FirewallSpec {
  id: FirewallModelId
  name: string
  throughputGbps: number
  price: number
  watts: number
  u: number
}

export const FIREWALLS: Record<FirewallModelId, FirewallSpec> = {
  fws: { id: 'fws', name: 'FW-S · 1 Gbps', throughputGbps: 1, price: 400, watts: 25, u: 1 },
  fwm: { id: 'fwm', name: 'FW-M · 10 Gbps', throughputGbps: 10, price: 3500, watts: 90, u: 1 },
  fwl: { id: 'fwl', name: 'FW-L · 100 Gbps', throughputGbps: 100, price: 30000, watts: 400, u: 2 },
}

/** Score de rede pela pior camada (§8); limiar 3:1 e parametro de jogo. */
export function networkScore(ratio: number): number {
  if (ratio <= 3) return 100
  if (ratio <= 6) return 90
  if (ratio <= 12) return 75
  return 50
}
