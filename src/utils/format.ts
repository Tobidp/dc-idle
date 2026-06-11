// Formatacao numerica pt-BR com sufixos curtos (especificacao §4).

const SUFFIXES = ['', ' K', ' M', ' B', ' T', ' Qa', ' Qi', ' Sx']

export function fmtShort(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const neg = n < 0
  let v = Math.abs(n)
  let i = 0
  while (v >= 1000 && i < SUFFIXES.length - 1) {
    v /= 1000
    i++
  }
  let out: string
  if (i === 0) {
    out = v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  } else {
    const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2
    out =
      v.toLocaleString('pt-BR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }) + SUFFIXES[i]
  }
  return (neg ? '−' : '') + out
}

export function fmtMoney(n: number): string {
  return '$ ' + fmtShort(n)
}

export function fmtPerSec(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '' : ''
  return sign + fmtMoney(n) + '/s'
}

export function fmtWatts(w: number): string {
  if (Math.abs(w) >= 1000) {
    return (w / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' kW'
  }
  return w.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' W'
}

export function fmtDuration(totalSeconds: number): string {
  const s = Math.floor(totalSeconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h} h ${m} min`
  if (m > 0) return `${m} min`
  return `${s} s`
}

/** 1 s real = 1 h de jogo: converte segundos reais em tempo de jogo legivel. */
export function fmtGameTime(realSeconds: number): string {
  const hours = realSeconds
  const days = hours / 24
  const years = days / 360
  if (years >= 1) return years.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' anos de jogo'
  if (days >= 1) return days.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' dias de jogo'
  return hours.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' h de jogo'
}
