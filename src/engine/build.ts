// Builds configuraveis (especificacao §6.1): validacao e composicao
// preco/consumo/capacidade a partir dos componentes selecionados.

import { modelById } from '../data/components'
import type { Build, BuildParts } from './types'

export interface BuildStats {
  price: number
  watts: number
  vcpu: number
  ramGb: number
  storageTb: number
  uSize: number
}

export type PartsError =
  | 'model'
  | 'cpu'
  | 'cpuCount'
  | 'dimm'
  | 'dimmCount'
  | 'nic'
  | 'psu'
  | 'nvme'
  | 'nvmeCount'

export function validateParts(parts: BuildParts): PartsError[] {
  const errors: PartsError[] = []
  const model = modelById[parts.modelId]
  if (!model) return ['model']
  const cpu = model.cpuOptions.find((c) => c.id === parts.cpuId)
  if (!cpu) errors.push('cpu')
  if (!Number.isInteger(parts.cpuCount) || parts.cpuCount < 1 || parts.cpuCount > model.sockets)
    errors.push('cpuCount')
  const dimm = model.dimmOptions.find((d) => d.id === parts.dimmId)
  if (!dimm) errors.push('dimm')
  if (!Number.isInteger(parts.dimmCount) || parts.dimmCount < 1 || parts.dimmCount > model.dimmSlots)
    errors.push('dimmCount')
  if (!model.nicOptions.find((n) => n.id === parts.nicId)) errors.push('nic')
  if (parts.psuCount !== 1 && parts.psuCount !== 2) errors.push('psu')
  if (parts.psuCount === 2 && !model.psu2) errors.push('psu')
  if (parts.nvmeId !== null && !model.nvmeOptions.find((n) => n.id === parts.nvmeId)) errors.push('nvme')
  const maxNvme = parts.nvmeId === null ? 0 : model.nvmeSlots
  if (!Number.isInteger(parts.nvmeCount) || parts.nvmeCount < 0 || parts.nvmeCount > maxNvme)
    errors.push('nvmeCount')
  if (parts.nvmeId !== null && parts.nvmeCount === 0) errors.push('nvmeCount')
  return errors
}

/** Pre-condicao: validateParts(parts).length === 0. */
export function computeBuild(parts: BuildParts): BuildStats {
  const model = modelById[parts.modelId]
  const cpu = model.cpuOptions.find((c) => c.id === parts.cpuId)!
  const dimm = model.dimmOptions.find((d) => d.id === parts.dimmId)!
  const nic = model.nicOptions.find((n) => n.id === parts.nicId)!
  const nvme = parts.nvmeId ? model.nvmeOptions.find((n) => n.id === parts.nvmeId)! : null
  const psu2 = parts.psuCount === 2 && model.psu2 ? model.psu2 : null

  return {
    price:
      model.chassisPrice +
      cpu.price * parts.cpuCount +
      dimm.price * parts.dimmCount +
      nic.price +
      (psu2?.price ?? 0) +
      (nvme ? nvme.price * parts.nvmeCount : 0),
    watts:
      model.chassisWatts +
      cpu.watts * parts.cpuCount +
      dimm.watts * parts.dimmCount +
      nic.watts +
      (psu2?.watts ?? 0) +
      (nvme ? nvme.watts * parts.nvmeCount : 0),
    /** vCPU = nucleos fisicos x 2 (SMT; premissa da especificacao §6.1). */
    vcpu: cpu.cores * parts.cpuCount * 2,
    ramGb: dimm.gb * parts.dimmCount,
    storageTb: nvme ? nvme.tb * parts.nvmeCount : 0,
    uSize: model.uSize,
  }
}

/** Identificador deterministico do build (dedupe de configuracoes identicas). */
export function buildId(parts: BuildParts): string {
  const nvme = parts.nvmeId ? `${parts.nvmeId}x${parts.nvmeCount}` : '-'
  return `${parts.modelId}|${parts.cpuId}x${parts.cpuCount}|${parts.dimmId}x${parts.dimmCount}|${parts.nicId}|psu${parts.psuCount}|${nvme}`
}

export function makeBuild(parts: BuildParts): Build {
  return { id: buildId(parts), parts }
}

export function buildLabel(parts: BuildParts): string {
  const model = modelById[parts.modelId]
  const cpu = model.cpuOptions.find((c) => c.id === parts.cpuId)
  const dimm = model.dimmOptions.find((d) => d.id === parts.dimmId)
  const bits = [
    parts.modelId,
    `${parts.cpuCount}×${cpu?.label ?? '?'}`,
    `${parts.dimmCount}×${dimm?.label.split(' ')[0] ?? '?'} GB`,
  ]
  if (parts.nvmeId && parts.nvmeCount > 0) {
    const nvme = model.nvmeOptions.find((n) => n.id === parts.nvmeId)
    bits.push(`${parts.nvmeCount}×${nvme?.label.replace('NVMe ', '') ?? '?'}`)
  }
  if (parts.psuCount === 2) bits.push('2×PSU')
  return bits.join(' · ')
}

/** Mapeamento dos presets fixos do M1 (save v1) para builds equivalentes. */
export const M1_PRESET_TO_PARTS: Record<string, BuildParts> = {
  rbt2: {
    modelId: 'RB-T2',
    cpuId: 'rb6',
    cpuCount: 2,
    dimmId: 'd3-8',
    dimmCount: 4,
    nicId: '1g',
    psuCount: 1,
    nvmeId: null,
    nvmeCount: 0,
  },
  'hn1100-a': {
    modelId: 'HN-1100',
    cpuId: 'e8',
    cpuCount: 1,
    dimmId: 'd4-16',
    dimmCount: 4,
    nicId: '10g',
    psuCount: 1,
    nvmeId: null,
    nvmeCount: 0,
  },
  'hn1100-b': {
    modelId: 'HN-1100',
    cpuId: 'e16',
    cpuCount: 2,
    dimmId: 'd4-32',
    dimmCount: 8,
    nicId: '10g',
    psuCount: 1,
    nvmeId: null,
    nvmeCount: 0,
  },
}
