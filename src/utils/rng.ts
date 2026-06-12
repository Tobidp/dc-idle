// PRNG deterministico (mulberry32). Usado a partir do M4 (incidentes/mercado);
// a seed ja e gravada no save desde o M1 para reprodutibilidade futura.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}

/** Passo unico do mulberry32 sobre estado persistido (determinismo entre sessoes). */
export function rngStep(state: number): { value: number; next: number } {
  const t = (state + 0x6d2b79f5) >>> 0
  let m = t
  m = Math.imul(m ^ (m >>> 15), m | 1)
  m ^= m + Math.imul(m ^ (m >>> 7), m | 61)
  const value = ((m ^ (m >>> 14)) >>> 0) / 4294967296
  return { value, next: t }
}

/** n passos descartando valores (avanco em lote). */
export function rngRange(state: number, min: number, max: number): { value: number; next: number } {
  const r = rngStep(state)
  return { value: min + r.value * (max - min), next: r.next }
}
