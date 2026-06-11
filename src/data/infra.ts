// Infraestrutura fisica (especificacao §6.6/§7) + instalacoes (extensao de design
// registrada em docs/decisoes.md): a entrada de energia vem da instalacao; a PDU
// limita por rack; UPS, quando presente, e um teto adicional do caminho eletrico.

import type { PremisesId } from '../engine/types'

export interface Premises {
  id: PremisesId
  label: string
  feedKw: number
  /** Dissipacao termica passiva do ambiente (kW) sem CRAC. */
  ambientCoolKw: number
  /** Espaco fisico para racks. */
  rackSlots: number
  /** Bancada/prateleira embutida (U), sem PDU propria. */
  benchU: number
  rentMonth: number
  price: number
}

export const PREMISES: Record<PremisesId, Premises> = {
  quarto: {
    id: 'quarto',
    label: 'Quarto',
    feedKw: 1.2,
    ambientCoolKw: 1.0,
    rackSlots: 1,
    benchU: 8,
    rentMonth: 0,
    price: 0,
  },
  comercial: {
    id: 'comercial',
    label: 'Sala comercial',
    feedKw: 30,
    ambientCoolKw: 3.0,
    rackSlots: 6,
    benchU: 8,
    rentMonth: 250,
    price: 5000,
  },
}

/** Circuito dedicado (so no quarto): entrada 1,2 kW -> 7 kW. Parametro de jogo. */
export const DEDICATED_CIRCUIT = { price: 1500, feedKw: 7.0 }

export interface RackSpec { id: 'r42' | 'r48'; label: string; u: number; pduKw: number; price: number; dualPdu: boolean }

export const RACKS: Record<'r42' | 'r48', RackSpec> = {
  r42: { id: 'r42', label: 'Rack 42U · PDU 5 kW', u: 42, pduKw: 5, price: 900, dualPdu: false },
  r48: { id: 'r48', label: 'Rack 48U · 2× PDU 8,6 kW (A+B)', u: 48, pduKw: 17.2, price: 2600, dualPdu: true },
}

export const UPS = { moduleKw: 18, modulePrice: 6000, maxModules: 6, lossFraction: 0.05 }
export const CRAC = { coolKw: 30, cop: 3.0, price: 9000, maxUnits: 6 }
