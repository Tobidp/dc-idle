// Valores-semente de balanceamento (especificacao §19).
// Parametros de jogo, sem fonte externa; ajuste centralizado aqui (revisao em M7).
// Ritmo-alvo decidido (P3): ~8 h ate o 1º prestigio.

export const BAL = {
  /** Escala de tempo: 1 s real = 1 h de jogo. 1 mes de jogo = 720 s reais. */
  monthSeconds: 720,

  /** Tarifa de energia ($/kWh). Conta: custo/s real = kW_total x tarifa (= IT x PUE x tarifa). */
  energyTariffPerKwh: 0.12,

  /**
   * Hospedagem avulsa: renda passiva base por vCPU ($/vCPU/mes de jogo).
   * Placeholder ate M3 (contratos); permanece depois como renda de capacidade ociosa.
   */
  adhocPerVcpuMonth: 8,

  work: {
    baseValue: 1,
    valueGrowth: 1.5,
    upgradeBaseCost: 15,
    costGrowth: 1.15,
  },

  /** Crescimento de custo por unidade ja possuida do mesmo modelo: preco x g^n. */
  equipCostGrowth: 1.12,

  /** Termica (especificacao §7): faixa ASHRAE 18-27 °C; +1 °C/h por 10% de deficit. */
  thermal: {
    baseTempC: 22,
    degPerHourPer10pctDeficit: 1,
    /** Recuperacao com superavit de refrigeracao (°C/h). Parametro de jogo. */
    recoveryDegPerHour: 2,
    /** Throttle escalonado (substitui desligamentos aleatorios ate o M4). */
    bands: [
      { minC: 35, mult: 0.4 },
      { minC: 32, mult: 0.7 },
      { minC: 27, mult: 0.9 },
    ],
  },

  offline: {
    capRealSeconds: 12 * 3600,
    minReportSeconds: 60,
    inSessionThresholdSeconds: 600,
  },

  tickMs: 1000,
  autosaveMs: 30000,

  /** M4 — SLA (§10): janela mensal por contrato; multas em creditos sobre a fatura. */
  sla: {
    windowSec: 720,
    tiers: [
      { maxShortfallPp: 0.1, creditPct: 10 },
      { maxShortfallPp: 1.0, creditPct: 25 },
    ],
    worstCreditPct: 50,
    cancelChance: 0.5,
    repPenalty: 5,
    repOnCompletion: 1,
  },

  /** M4 — incidentes (§13). Taxas em eventos/ano de jogo (ano = 8.760 h). */
  incidents: {
    hoursPerYear: 8760,
    mttrGameH: 2,
    utilityOutagesPerYear: 2,
    utilityDurGameH: [1, 6] as [number, number],
    genStartupGameH: 30 / 3600,
    upsAutonomyGameH: 10 / 60,
    dieselPerGameH: 40,
    ddosPerYearBase: 4,
    ddosPerYearPerRep: 0.16,
    ddosDurGameH: [2, 12] as [number, number],
    ddosGbps: [1, 200] as [number, number],
    fiberPerYearPerLink: 1,
    fiberDurGameH: [2, 8] as [number, number],
    psuAfr: 0.02,
    upsCracAfr: 0.03,
    humanErrorPerAction: 0.02,
    humanErrorDurGameH: 1,
  },

  /** M4 — mercado dinamico (§10). Tempos em horas de jogo (= s reais). */
  market: {
    regenGameH: [24, 72] as [number, number],
    offerTtlGameH: [24, 72] as [number, number],
    maxOffers: 6,
    priceJitter: 0.2,
    eventCheckGameH: 168,
    eventChance: 0.25,
    eventDurGameH: 168,
    startingReputation: 20,
  },

  scrubbingMonthly: 1000,
  scrubbingMitigationGbps: 50,
  generatorPrice: 25000,

  /** Alerta de transito ocioso no Painel: folga minima (fracao do contratado e Gbps). */
  transitIdleWarn: { frac: 0.5, minGbps: 10 },
} as const
