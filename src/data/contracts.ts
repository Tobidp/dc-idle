// Contratos estaticos (especificacao §10). Receitas mensais sao valores-semente
// (parametro de jogo; a §10 nao fixa receita). Mercado dinamico/multas: M4.
// Tipos com exigencia de Tier/certificacao ficam bloqueados ate o M6.

export interface ContractType {
  id: string
  name: string
  vcpu: number
  ramGb: number
  tb: number
  gbps: number
  monthly: number
  slaPct: number
  /** Faixa de duracao das ofertas (meses de jogo). Parametro de jogo. */
  durationM: [number, number]
  netSensitive: boolean
  requires: {
    firewall?: boolean
    vlan?: boolean
    tierMin?: 2 | 3 | 4
    cert?: boolean
  }
}

export const CONTRACT_TYPES: ContractType[] = [
  { id: 'blog', name: 'Blog pessoal', vcpu: 1, ramGb: 1, tb: 0, gbps: 0, monthly: 15, slaPct: 99.0, durationM: [3, 6], netSensitive: false, requires: {} },
  { id: 'pme', name: 'Site PME', vcpu: 2, ramGb: 4, tb: 0.1, gbps: 0, monthly: 40, slaPct: 99.5, durationM: [3, 6], netSensitive: false, requires: {} },
  { id: 'loja', name: 'Loja virtual', vcpu: 8, ramGb: 16, tb: 0.5, gbps: 0.1, monthly: 220, slaPct: 99.9, durationM: [6, 12], netSensitive: false, requires: { firewall: true } },
  { id: 'backend', name: 'Backend de app', vcpu: 16, ramGb: 64, tb: 1, gbps: 0.5, monthly: 520, slaPct: 99.9, durationM: [6, 12], netSensitive: false, requires: { vlan: true } },
  { id: 'saas', name: 'SaaS B2B', vcpu: 64, ramGb: 256, tb: 5, gbps: 1, monthly: 2400, slaPct: 99.95, durationM: [6, 12], netSensitive: false, requires: { tierMin: 2, vlan: true } },
  { id: 'video', name: 'Plataforma de vídeo', vcpu: 32, ramGb: 128, tb: 20, gbps: 10, monthly: 14000, slaPct: 99.9, durationM: [6, 12], netSensitive: true, requires: {} },
  { id: 'fintech', name: 'Fintech', vcpu: 96, ramGb: 512, tb: 10, gbps: 2, monthly: 9500, slaPct: 99.95, durationM: [12, 24], netSensitive: false, requires: { tierMin: 3, cert: true, firewall: true } },
  { id: 'governo', name: 'Órgão público', vcpu: 128, ramGb: 1024, tb: 50, gbps: 5, monthly: 22000, slaPct: 99.99, durationM: [12, 24], netSensitive: false, requires: { tierMin: 4, cert: true } },
]

export const contractById: Record<string, ContractType> = Object.fromEntries(
  CONTRACT_TYPES.map((c) => [c.id, c]),
)
