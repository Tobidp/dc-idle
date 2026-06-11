// Catalogo de componentes por modelo de servidor (especificacao §6.1 e §19).
// Precos e consumos compoem o build: P = chassi + somatorio dos componentes.
// Baias de GPU do HN-2200 adiadas para o M5 (mineracao) — registrado em docs/decisoes.md.

export type ModelId = 'RB-T2' | 'HN-1100' | 'HN-2200'

export interface CpuOpt { id: string; label: string; cores: number; watts: number; price: number }
export interface DimmOpt { id: string; label: string; gb: number; watts: number; price: number }
export interface NicOpt { id: string; label: string; watts: number; price: number }
export interface NvmeOpt { id: string; label: string; tb: number; watts: number; price: number }

export interface ServerModel {
  id: ModelId
  name: string
  note: string
  uSize: number
  chassisWatts: number
  chassisPrice: number
  sockets: number
  dimmSlots: number
  nvmeSlots: number
  cpuOptions: CpuOpt[]
  dimmOptions: DimmOpt[]
  nicOptions: NicOpt[]
  nvmeOptions: NvmeOpt[]
  /** null = sem opcao de 2ª fonte. */
  psu2: { price: number; watts: number } | null
}

export const MODELS: ServerModel[] = [
  {
    id: 'RB-T2',
    name: 'RB-T2 · torre usada',
    note: 'Torre recondicionada (4U equiv.) · DDR3 · 2×1G · PSU única',
    uSize: 4,
    chassisWatts: 70,
    chassisPrice: 90,
    sockets: 2,
    dimmSlots: 8,
    nvmeSlots: 0,
    cpuOptions: [{ id: 'rb6', label: '6c (usado)', cores: 6, watts: 45, price: 20 }],
    dimmOptions: [
      { id: 'd3-8', label: '8 GB DDR3', gb: 8, watts: 5, price: 12.5 },
      { id: 'd3-16', label: '16 GB DDR3', gb: 16, watts: 5, price: 25 },
    ],
    nicOptions: [{ id: '1g', label: '2×1G (fixa)', watts: 0, price: 0 }],
    nvmeOptions: [],
    psu2: null,
  },
  {
    id: 'HN-1100',
    name: 'HN-1100 · 1U',
    note: '1U · até 2 sockets · 16 DIMM DDR4 · 4 baias NVMe',
    uSize: 1,
    chassisWatts: 90,
    chassisPrice: 1200,
    sockets: 2,
    dimmSlots: 16,
    nvmeSlots: 4,
    cpuOptions: [
      { id: 'e8', label: '8c', cores: 8, watts: 65, price: 300 },
      { id: 'e16', label: '16c', cores: 16, watts: 120, price: 900 },
      { id: 'e32', label: '32c', cores: 32, watts: 200, price: 2600 },
    ],
    dimmOptions: [
      { id: 'd4-16', label: '16 GB DDR4', gb: 16, watts: 5, price: 40 },
      { id: 'd4-32', label: '32 GB DDR4', gb: 32, watts: 5, price: 85 },
      { id: 'd4-64', label: '64 GB DDR4', gb: 64, watts: 5, price: 190 },
    ],
    nicOptions: [
      { id: '10g', label: '2×10G', watts: 0, price: 0 },
      { id: '25g', label: '2×25G', watts: 8, price: 350 },
    ],
    nvmeOptions: [
      { id: 'n8', label: 'NVMe 8 TB', tb: 8, watts: 8, price: 700 },
      { id: 'n16', label: 'NVMe 16 TB', tb: 16, watts: 10, price: 1300 },
    ],
    psu2: { price: 120, watts: 5 },
  },
  {
    id: 'HN-2200',
    name: 'HN-2200 · 2U',
    note: '2U · 2 sockets · 24 DIMM · 8 baias NVMe · baias GPU no M5',
    uSize: 2,
    chassisWatts: 130,
    chassisPrice: 4800,
    sockets: 2,
    dimmSlots: 24,
    nvmeSlots: 8,
    cpuOptions: [
      { id: 'e16', label: '16c', cores: 16, watts: 120, price: 900 },
      { id: 'e32', label: '32c', cores: 32, watts: 200, price: 2600 },
      { id: 'e64', label: '64c', cores: 64, watts: 280, price: 7000 },
    ],
    dimmOptions: [
      { id: 'd4-32', label: '32 GB DDR4', gb: 32, watts: 5, price: 85 },
      { id: 'd4-64', label: '64 GB DDR4', gb: 64, watts: 5, price: 190 },
      { id: 'd5-128', label: '128 GB DDR5', gb: 128, watts: 6, price: 420 },
    ],
    nicOptions: [
      { id: '10g', label: '2×10G', watts: 0, price: 0 },
      { id: '25g', label: '2×25G', watts: 8, price: 350 },
      { id: '100g', label: '2×100G', watts: 20, price: 1400 },
    ],
    nvmeOptions: [
      { id: 'n8', label: 'NVMe 8 TB', tb: 8, watts: 8, price: 700 },
      { id: 'n16', label: 'NVMe 16 TB', tb: 16, watts: 10, price: 1300 },
    ],
    psu2: { price: 160, watts: 8 },
  },
]

export const modelById: Record<string, ServerModel> = Object.fromEntries(MODELS.map((m) => [m.id, m]))
