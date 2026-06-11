// Progresso offline (especificacao §16): forma fechada, teto, sem incidentes.
// Termica congelada offline (temperatura nao varia; decisao registrada).

import { BAL } from '../data/balance'
import { netPerSec } from './economy'
import type { SaveV2 } from './types'

export interface OfflineResult {
  elapsedSeconds: number
  paidSeconds: number
  gained: number
  capped: boolean
}

export function computeOffline(
  save: Pick<SaveV2, 'lastTs' | 'builds' | 'equipment' | 'infra' | 'tempC'>,
  nowMs: number,
  capSeconds: number = BAL.offline.capRealSeconds,
): OfflineResult {
  const elapsedSeconds = Math.max(0, (nowMs - save.lastTs) / 1000)
  const paidSeconds = Math.min(elapsedSeconds, capSeconds)
  const gained = netPerSec(save) * paidSeconds
  return { elapsedSeconds, paidSeconds, gained, capped: elapsedSeconds > capSeconds }
}
