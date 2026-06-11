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
} as const
