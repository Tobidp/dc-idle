import { describe, expect, it } from 'vitest'
import { fmtDuration, fmtMoney, fmtShort, fmtWatts } from './format'

describe('fmtShort', () => {
  it('abaixo de 1000 sem sufixo', () => {
    expect(fmtShort(999)).toBe('999')
  })
  it('milhares com 2 casas', () => {
    expect(fmtShort(1530)).toBe('1,53 K')
  })
  it('reduz casas conforme magnitude', () => {
    expect(fmtShort(123456)).toBe('123 K')
    expect(fmtShort(45_600)).toBe('45,6 K')
  })
  it('milhoes', () => {
    expect(fmtShort(1_000_000)).toBe('1,00 M')
  })
  it('negativos', () => {
    expect(fmtShort(-2500)).toBe('\u22122,50 K')
  })
})

describe('fmtMoney', () => {
  it('prefixa $', () => {
    expect(fmtMoney(0)).toBe('$ 0')
  })
})

describe('fmtWatts', () => {
  it('W abaixo de 1000', () => {
    expect(fmtWatts(180)).toBe('180 W')
  })
  it('kW a partir de 1000', () => {
    expect(fmtWatts(1500)).toBe('1,5 kW')
  })
})

describe('fmtDuration', () => {
  it('horas e minutos', () => {
    expect(fmtDuration(3661)).toBe('1 h 1 min')
  })
  it('apenas minutos', () => {
    expect(fmtDuration(90)).toBe('1 min')
  })
  it('apenas segundos', () => {
    expect(fmtDuration(45)).toBe('45 s')
  })
})
