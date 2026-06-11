# DC IDLE — Especificação de Design e Técnica
**Versão:** 1.0 (para validação) · **Data:** 2026-06-10 · **Título do produto:** provisório (pendência P1)

---

## 1. Sumário do produto

Jogo idle/incremental para navegador, single-player, client-side, hospedado em GitHub Pages. Premissa: uma pessoa que acabou de conhecer computadores progride de um único PC até o maior datacenter do mundo. Sem animações e sem imagens raster; interface composta por ícones de linha e painéis numéricos. Todas as configurações de equipamento seguem padrões reais de mercado (form factor em U, DIMMs, RAID, LACP, BGP, oversubscription, redundância N/N+1/2N, classificação Tier I–IV). Interação exclusivamente por seleções, checkboxes e botões — sem CLI.

## 2. Decisões registradas

| # | Item | Decisão |
|---|------|---------|
| D1 | Entrega | Projeto multi-arquivo, repositório GitHub, deploy em GitHub Pages |
| D2 | Profundidade técnica | Realista: topologia, redundância N+1/2N, oversubscription, Tier I–IV |
| D3 | Mecânicas v1 | Progresso offline, prestígio, incidentes, mercado dinâmico de contratos |
| D4 | Stack | React + Vite + TypeScript; build e deploy via GitHub Actions |
| D5 | Visual | Ícones de linha + painéis numéricos; sem animação |
| D6 | Receitas extras | Mineração de criptomoeda, CDN/cache embarcado (modelo OCA/GGC), VPS self-service |
| D7 | Idioma da UI | pt-BR com termos técnicos em inglês (inferido do enunciado; reversível) |

## 3. Premissa e fases de progressão

| Fase | Nome | Desbloqueio | Características |
|------|------|-------------|-----------------|
| F1 | Quarto | início | Botão **Work** (freelas), 1 PC, primeiro servidor torre usado |
| F2 | Homelab | 1º rack | Rack doméstico, switch 1G, primeiros contratos pequenos |
| F3 | Sala comercial | 4 racks + UPS | Energia dedicada, NAS, firewall, equipe inicial |
| F4 | Datacenter | 12 racks + gerador | Tier I→IV, spine-leaf, BGP, cache embarcado, VPS |
| F5 | Hyperscale | Tier III + Legado ≥ 1 | Salas adicionais, contratos premium, caminho ao "maior do mundo" |

Condição de vitória simbólica: indicador "Ranking mundial" (lista fictícia de 20 operadoras) atinge #1 por capacidade IT (kW) — o jogo continua após isso (gênero idle).

## 4. Modelo de tempo e economia

- **Escala de tempo:** `1 s real = 1 h de jogo`. Logo: 1 dia = 24 s; **1 mês = 720 s (12 min)**; 1 ano = 8.640 s (2,4 h).
- Valores "mensais" (contratos, salários, trânsito) são convertidos para fluxo por segundo: `valor/720`.
- **Tick lógico:** 1.000 ms, com acumulador baseado em `Date.now()` (corrige drift e abas em segundo plano). Render desacoplado (subscribe no store).
- **Conta de energia por segundo real:** `kW_IT × PUE × tarifa($/kWh)` — coerente porque 1 s real = 1 h de jogo.
- Formatação numérica: sufixos K, M, B, T, Qa…; separadores pt-BR.

## 5. Recursos e indicadores

| Recurso | Unidade | Origem | Consumo |
|---------|---------|--------|---------|
| Dinheiro | $ | Work, contratos, VPS, mineração | Compras, salários, energia, trânsito, diesel, multas |
| vCPU | un. | Servidores (núcleos × SMT 2; overcommit configurável 1:1–4:1) | Contratos, VPS |
| RAM | GB | DIMMs instalados | Contratos, VPS |
| Storage útil | TB | Discos × fórmula RAID | Contratos, VPS |
| Banda LAN | Gbps | Portas/uplinks | Tráfego interno (ratios) |
| Banda WAN | Gbps | Links de operadora | Contratos, VPS, cache, DDoS |
| Energia | kW | Cadeia concessionária→UPS→PDU | Equipamentos (IT) + overhead (PUE) |
| Refrigeração | kW térmico | Unidades CRAC | Calor ≈ kW elétrico IT (1 W ≈ 3,412 BTU/h) |
| Espaço | U / racks | Racks comprados | Equipamentos |
| Conhecimento (KP) | pt | 1 KP/h de jogo de operação + marcos | Árvore de pesquisa |
| Reputação | 0–100 | SLA cumprido, certificações, cache | Quantidade/qualidade de ofertas |
| Legado | pt | Prestígio (§15) | Loja do investidor |

## 6. Catálogo de equipamentos e configuração

Marcas fictícias (evita marca registrada): **Hypernode** (servidores), **Switchline** (switches), **RouteCore** (roteadores), **StorBay** (storage), **FireWatch** (firewalls), **VoltGrid** (energia), **ChillCore** (refrigeração). Padrões de especificação seguem o mercado real. Consumo de cada unidade é calculado por composição: `P = P_chassi + Σ P_componentes`.

### 6.1 Servidores

| Modelo | Form | Sockets | CPUs (opções) | DIMM slots | RAM/DIMM | NIC (opções) | PSU | Baias |
|---|---|---|---|---|---|---|---|---|
| RB-T2 (torre usada) | torre (4U equiv.) | 2 | 6c/45 W (fixa) | 8 × DDR3 | 8/16 GB | 2×1G fixa | 1 | 4 HDD |
| HN-1100 | 1U | 1–2 | 8c/16c/32c | 16 × DDR4 | 16/32/64 GB | 2×10G ou 2×25G | 1–2 | 4 NVMe |
| HN-2200 | 2U | 2 | 16c/32c/64c | 24 × DDR4/5 | 32/64/128 GB | até 2×100G | 1–2 | 8 NVMe + 0–4 GPU |
| HN-4400 | 2U | 4 | 32c/64c | 48 × DDR5 | 64/128 GB | 2×100G | 2 | 8 NVMe |
| HN-G8 | 4U | 2 | 32c/64c | 24 × DDR5 | 64/128 GB | 2×100G | 2–4 | 8 GPU |

Regras: 2ª PSU (checkbox) = redundância de alimentação do host (requisito p/ caminho A+B); vCPU = núcleos físicos × 2 (SMT, premissa declarada); overcommit acima de 2:1 reduz performance score dos contratos alocados (tech Orquestração mitiga).

### 6.2 Switches

| Modelo | Papel | Portas downlink | Uplinks |
|---|---|---|---|
| SL-24G | acesso (homelab) | 24×1G | 2×10G |
| SL-48T | ToR | 48×10G | 6×40G |
| SL-48X | ToR | 48×25G | 8×100G |
| SL-32C | spine/agregação | 32×100G | — |
| SL-32D | spine | 32×400G | — |

Configuração: nº de uplinks ativos; LACP (checkbox; IEEE 802.1AX) agrega banda; breakout 100G→4×25G (tech); par MLAG (tech) = ToR redundante.

### 6.3 Roteadores

| Modelo | Tipo | Capacidade |
|---|---|---|
| RC-1F | fixo | 4×10G; 1 sessão BGP |
| RC-2F | fixo | 2×100G + 8×10G; 4 sessões |
| RC-M6 | **modular** | chassi 6 slots; line cards LC-8×10G / LC-4×100G / LC-2×400G; route processor simples ou duplo (checkbox = N+1); 2–4 fontes |

BGP (RFC 4271) para trânsito e peering; 2 roteadores + 2 operadoras = borda redundante.

### 6.4 Storage

| Modelo | Tipo | Baias | Controladora |
|---|---|---|---|
| JBOD-12 | DAS | 12 | — (liga a um servidor) |
| SB-N12 | NAS | 12 | 1 ou 2 (checkbox) |
| SB-AF24 | SAN all-flash | 24 NVMe | 2 (padrão) |

Discos: HDD 8/16/20 TB; SSD SATA 4/8 TB; NVMe 8/16 TB. RAID por grupo (select): 0, 1, 5, 6, 10 + hot spare (checkbox).

Capacidade útil (n discos de capacidade c): `R0 = n·c` · `R1 = c` · `R5 = (n−1)·c` · `R6 = (n−2)·c` · `R10 = (n/2)·c`. Tolerância a falha: R0 = 0 discos (perda de dados em falha); R5 = 1; R6 = 2; R10 = 1 por espelho. Rebuild: 4 h de jogo em estado degradado; hot spare inicia rebuild automaticamente.

### 6.5 Firewalls

| Modelo | Throughput | Mitigação DDoS | HA |
|---|---|---|---|
| FW-S | 1 Gbps | 0,5 Gbps | — |
| FW-M | 10 Gbps | 5 Gbps | par ativo/passivo (checkbox) |
| FW-L | 100 Gbps | 40 Gbps | par (checkbox) |

Assinatura "scrubbing" (mensal): +50 Gbps de mitigação na borda. Firewall é exigência de contratos e-commerce/fintech/governo; HA conta para Tier III/IV.

### 6.6 Infraestrutura física

| Item | Especificação |
|---|---|
| Rack 42U | PDU única 5 kW |
| Rack 48U | 2 PDUs 8,6 kW (caminhos A+B — habilita alimentação dupla por rack) |
| UPS VG-20 | frame até 6 módulos de 20 kVA (≈18 kW, FP 0,9); autonomia 10 min à carga nominal do módulo; módulos extras = N+1/2N |
| Gerador VG-150 | 150 kVA standby; partida 30 s de jogo; diesel $40/h de jogo em operação |
| CRAC CC-30 | 30 kW de refrigeração; COP 3,0 (consome 10 kW elétricos) |
| Link WAN | 1/10/100 Gbps por operadora; 2ª operadora (checkbox); trânsito $/Gbps/mês |

## 7. Energia, refrigeração e PUE

**Cadeia:** Concessionária → (Gerador standby) → UPS → PDU do rack → equipamento. Validações contínuas:
1. `kW_IT por rack ≤ capacidade da(s) PDU(s)`;
2. `kW_IT total ≤ capacidade UPS remanescente após 1 falha` (se N+1) ou nominal (se N);
3. `kW refrigeração ≥ kW_IT`, senão temperatura virtual do site sobe.

**Térmica:** faixa recomendada ASHRAE 18–27 °C. T > 27 °C → performance −10% (throttle); T > 35 °C → desligamentos aleatórios de hosts até equilíbrio. Déficit acumula a 1 °C por hora de jogo por 10% de déficit; retorno na mesma taxa com superávit.

**PUE** = energia total / energia IT. Base do jogo: 1,60 (refrigeração 0,45 + perdas elétricas 0,15). Techs reduzem: confinamento de corredores → 1,40; free cooling → 1,25; DCIM/otimização → 1,15 (piso). Custo de energia usa o PUE corrente (§4).

## 8. Rede e topologia (oversubscription)

Estágios: **(a)** switch único plano → **(b)** três camadas (acesso/agregação/núcleo) → **(c)** spine-leaf (tech).

**Ratio por camada:** `ratio = Σ banda downlink em uso / Σ banda uplink ativa` (LACP soma uplinks). Score de rede do site = pior camada:

| Ratio | Score |
|---|---|
| ≤ 3:1 | 100% |
| 3–6:1 | 90% |
| 6–12:1 | 75% |
| > 12:1 | 50% |

Prática de mercado situa o acesso entre 2:1 e 4:1; não há norma única — o limiar 3:1 é **parâmetro de jogo**. O score multiplica a qualidade entregue a contratos sensíveis a banda/latência (flag por contrato) e compõe o uptime medido (§10). Exemplo no catálogo: SL-48X com 48×25G ocupadas e 8×100G ativas → 1.200/800 = 1,5:1.

Redundância de rede: MLAG (par de ToR), 2 roteadores de borda, 2 operadoras. Borda redundante é exigência de Tier III+.

## 9. Classificação Tier e redundância

Avaliação automática por checklist booleano sobre a configuração do site, segundo o modelo do Uptime Institute (Tier Standard: Topology):

| Tier | Checklist do jogo (resumo) | Disponibilidade de referência |
|---|---|---|
| I | UPS + refrigeração dedicada; caminho único (N) | 99,671% |
| II | Componentes redundantes: UPS N+1, CRAC N+1, gerador presente | 99,741% |
| III | Manutenção simultânea: caminhos elétricos A+B até o rack (racks 48U + 2ª PSU), N+1 em tudo, 2 operadoras, borda redundante | 99,982% |
| IV | Tolerância a falhas: 2N em energia e refrigeração, MLAG, compartimentação | 99,995% |

Os percentuais são os publicados pelo Uptime Institute e funcionam como **teto de uptime base** do site; incidentes não absorvidos pela redundância reduzem o realizado. **Certificação:** auditoria paga (custo + 1 dia de jogo de indisponibilidade comercial); o selo é pré-requisito de contratos premium e só vale enquanto o checklist permanecer satisfeito.

## 10. Contratos e mercado dinâmico

**Atributos de cada contrato:** tipo, recursos (vCPU, GB RAM, TB, Gbps), receita mensal, duração (meses de jogo), SLA alvo, exigências (tier mínimo, firewall, isolamento VLAN, certificação), sensibilidade a rede (flag), Δ reputação.

| Tipo (exemplos) | Recursos típicos | SLA | Exigências |
|---|---|---|---|
| Blog pessoal | 1 vCPU, 1 GB | 99,0% | — |
| Site PME | 2 vCPU, 4 GB, 0,1 TB | 99,5% | — |
| Loja virtual | 8 vCPU, 16 GB, 0,5 TB, 0,1 Gbps | 99,9% | firewall |
| Backend de app | 16 vCPU, 64 GB, 1 TB, 0,5 Gbps | 99,9% | VLAN |
| SaaS B2B | 64 vCPU, 256 GB, 5 TB, 1 Gbps | 99,95% | Tier II, VLAN |
| Plataforma de vídeo | 32 vCPU, 128 GB, 20 TB, 10 Gbps | 99,9% | sensível a rede |
| Fintech | 96 vCPU, 512 GB, 10 TB, 2 Gbps | 99,95% | Tier III cert., firewall HA, compliance |
| Órgão público | 128 vCPU, 1 TB RAM, 50 TB, 5 Gbps | 99,99% | Tier IV cert., compliance |

**Mercado dinâmico:** pool de ofertas regenerado a cada 1–3 dias de jogo; quantidade e qualidade ∝ reputação + marketing; ofertas expiram (24–72 h de jogo); preços oscilam ±20% sob eventos ("vazamento na concorrente" → +demanda 1 semana; "recessão" → −preços; "lançamento de IA" → +demanda GPU).

**Medição de SLA:** janela = 1 mês de jogo (720 s). `uptime_contrato = uptime_site − penalidades específicas` (DDoS não mitigado se exposto, throttle térmico/overcommit nos recursos alocados, score de rede < 75% se sensível). Multas no fechamento da janela, em créditos sobre a fatura (modelo padrão de mercado): até −0,1 p.p. do alvo → 10%; até −1,0 p.p. → 25%; abaixo → 50% + risco de rescisão (50%) e −5 reputação.

## 11. Receitas adicionais

**11.1 Mineração de criptomoeda.** GPUs em HN-2200/HN-G8. Receita/s = `hashrate × preço(t) × k`. Preço = passeio aleatório geométrico com limites [0,2×; 5×] do preço inicial e drift 0; *halving* a cada 2 anos de jogo (−50% emissão); eventos bull/bear. Consumo 300 W/GPU + calor integral. Sem SLA — destino para capacidade ociosa; risco cambial é do jogador.

**11.2 CDN/cache embarcado (modelo OCA/GGC/FNA).** Parceiros fictícios "StreamBox" e "FindCo". Requisitos espelhando o modelo real: tráfego egress mínimo de 5 Gbps de pico, sessão BGP ativa, alimentação redundante, 2–4U livres. O appliance é fornecido **sem custo** e **sem remuneração direta** — fiel ao modelo real, cujo benefício é indireto: no jogo, −40% do custo de trânsito sobre o tráfego elegível, +5 reputação e desbloqueio da linha de contratos "provedor regional".

**11.3 VPS/cloud self-service.** Requer techs Virtualização + Portal self-service. Jogador define planos e preço; demanda/s = f(reputação, preço relativo à referência, marketing); churn 3%/mês; consome frações de vCPU/RAM/TB/Gbps; sem equipe de suporte, gera tickets (incidentes S3).

## 12. Funcionários e automação

Cobertura realista: 1 contratado cobre 1 turno de 8 h de jogo/dia; **3 por cargo = cobertura 24/7**. Fora de cobertura, a automação do cargo pausa. Senioridade Jr/Pl/Sr multiplica custo e eficiência (×1 / ×1,6 / ×2,5 de eficácia; ×1 / ×1,5 / ×2,2 de salário).

| Cargo | Automatiza | Efeito principal | Salário mensal (Jr) |
|---|---|---|---|
| Estagiário | botão Work | 1 clique/s por estagiário | $300 |
| Técnico NOC | incidentes S2/S3 | MTTR −50% no turno | $1.400 |
| Sysadmin | provisionamento/tickets VPS | tickets resolvidos; +5% capacidade efetiva | $2.200 |
| Eng. de redes | LACP/MLAG/ratios | elimina erro humano de rede; alerta ratio > 3:1 | $3.200 |
| Facilities/Eletricista | manutenção preventiva | taxa de falha física −30% | $1.800 |
| Vendedor | aceite de ofertas | aceita ofertas que casem com filtros definidos pelo jogador | $1.600 + 2% comissão |
| Gerente | — | +10% eficiência da equipe (1 por 5 funcionários) | $4.000 |

## 13. Incidentes

Modelo de probabilidade por componente: `λ/h de jogo = AFR/8.760` por unidade; por tick, `P = 1 − e^(−Σλ)`. Sorteios com RNG semeado (§18). Severidades S1 (site), S2 (serviço), S3 (degradação). MTTR base 2 h de jogo; NOC reduz. Log persistente (200 últimos eventos).

| Evento | Frequência/base | Absorvido por | Consequência sem proteção |
|---|---|---|---|
| Falha de disco | AFR ≈ 1,4% (ref. Backblaze) | RAID 1/5/6/10 (+hot spare) | R0: perda de dados → multa máxima + −10 reputação |
| Falha de PSU | AFR 2% (**parâmetro de jogo**) | 2ª PSU | host down até troca |
| Falha módulo UPS/CRAC | AFR 3% (**parâmetro de jogo**) | N+1 / 2N | queda parcial / evento térmico |
| Queda da concessionária | 2×/ano de jogo, 1–6 h | UPS (ponte) → gerador + diesel | site down (S1) |
| Rompimento de fibra | 1×/ano por operadora | 2ª operadora | WAN down (S1 comercial) |
| DDoS | freq. ∝ reputação; 1–200 Gbps | mitigação (firewalls + scrubbing) | contratos expostos degradados |
| Erro humano | 2% por ação manual de rede | Eng. de redes contratado | incidente S2 aleatório |

Tier alcançado reduz impacto na prática porque as redundâncias exigidas absorvem a primeira falha de cada cadeia. Incidentes são suprimidos offline (§16).

## 14. Pesquisa — árvore de Conhecimento

Geração: 1 KP/h de jogo com operação ativa + bônus por marcos (1º contrato, 1º rack, Tier I…). Ramos e nós principais:

| Ramo | Sequência |
|---|---|
| Computação | Virtualização (habilita vCPU/VPS) → Overcommit configurável → Orquestração (auto-balanceamento, mitiga overcommit) |
| Rede | VLANs (isolamento p/ contratos) → LACP → MLAG → Spine-Leaf → BGP → Peering/IX (trânsito −30%) |
| Storage | RAID 5/6/10 → Hot spare → Tiering (HDD+NVMe no mesmo pool) |
| Facilities | Corredor quente/frio → Confinamento (PUE 1,40) → Free cooling (1,25) → DCIM (1,15; cap offline 24 h) |
| Segurança | Firewall HA → Scrubbing → Compliance (auditoria p/ fintech/governo) |
| Negócio | Marketing (ofertas +) → Portal self-service (VPS) → Conta-chave (ofertas premium simultâneas +1) |

## 15. Prestígio

Tema: **venda da empresa / IPO**. Ao prestigiar: `Legado ganho = floor(√(lucro líquido da run / 10⁹))`, mínimo 1 para habilitar o botão. Reset: equipamentos, contratos, dinheiro, equipe e techs zerados; permanecem Legado, estatísticas, conquistas e compras da loja.

Bônus passivo: **+2% de renda global por ponto de Legado**. Loja do investidor (gasta Legado): capital inicial ($10k/50k/250k), manter 1 tech à escolha, Work ×2, +1 oferta simultânea no mercado, estagiário gratuito.

## 16. Progresso offline

No load: `Δt = now − lastTs`; `ganho = taxaLíquida(lastTs) × min(Δt, cap)`. Cap base 12 h reais; 24 h com DCIM. Cálculo em forma fechada (sem simulação passo a passo); mineração usa preço médio da sessão anterior; incidentes não ocorrem offline (decisão de design — evita punição sem agência). Painel "Enquanto você esteve fora" com o detalhamento.

## 17. UI/Telas e direção visual

**Telas (tabs):** Dashboard · Compras (catálogo + modal de configuração com selects/checkboxes e prévia de consumo/capacidade) · Racks (painel numérico por rack: U, kW, térmica) · Rede (camadas, ratios, borda) · Contratos (mercado | ativos com status de SLA) · Equipe · Pesquisa · Incidentes (log) · Prestígio · Config (export/import do save, hard reset, formato numérico).

**Direção visual** (decisões deliberadas, tokens definidos no M0):
- **Assinatura:** *ratio meters* — réguas numéricas `usado : disponível` (downlink:uplink, kW, U, kVA, TB) presentes em todos os painéis; é a identidade visual e o instrumento central de decisão do jogador.
- **Paleta** (tema escuro técnico, vernáculo de painel NOC/elétrico — âmbar = atenção): fundo `#12161C`, painel `#1A2129`, borda `#2A3442`, texto `#D7DEE7`, texto-dim `#8A97A6`, ok `#3FB68B`, atenção `#E0A03C`, crítico `#D4574E`.
- **Tipografia:** Space Grotesk (títulos/labels) + IBM Plex Mono com algarismos tabulares (todos os números). Números nunca em fonte proporcional.
- **Ícones:** lucide-react (linha, stroke 1,5 px) — compatível com D5.
- Sem animações (requisito); estados comunicados por cor e valor. Responsivo ≥ 360 px (tabs inferiores no mobile); foco de teclado visível; `aria-label` nos controles.

## 18. Arquitetura técnica

- **Stack:** Vite + React 18 + TypeScript estrito.
- **Estado:** Zustand — store fora da árvore React, selectors por painel, padrão consolidado e documentado para ticks frequentes. Alternativa registrada: Redux Toolkit (descartada por boilerplate sem ganho funcional aqui).
- **Engine pura** em `/src/engine` (zero dependência de React): `tick(state, dtHoras, rng) → state'`, além de `applyPurchase`, `evaluateTier`, `computeRatios`, `settleSlaWindow`, `offlineGain`, `prestige`. Testável isoladamente.
- **RNG determinístico:** mulberry32 com seed gravada no save — incidentes e mercado reprodutíveis.
- **Agregação (escala):** equipamentos armazenados como grupos `{catalogId, configHash, count, rackId}` — custo O(grupos), não O(unidades). Incidentes sorteiam grupo ponderado por `count`.
- **Persistência:** `localStorage["dcidle.save.v1"]`; autosave 30 s + `beforeunload`; export/import JSON (Base64) na tela Config; schema versionado com migrações; validação com zod no load (save corrompido → rejeita com mensagem, preserva backup anterior).
- **Save (esqueleto):**

```ts
interface SaveV1 {
  version: 1; seed: number; lastTs: number;
  money: number; lifetimeProfit: number; legacy: number;
  knowledge: number; reputation: number;
  equipment: EquipGroup[]; racks: Rack[];
  power: PowerChain; cooling: CoolingPlant; network: NetworkState;
  contracts: ContractInstance[]; marketOffers: Offer[];
  staff: StaffState; techs: string[]; cryptoPrice: number;
  stats: Stats; flags: Record<string, boolean>;
}
```

- **Estrutura de pastas:**

```
/src
  /engine      # lógica pura: economy, power, thermal, network, tier, incidents, market, offline, prestige
  /data        # catálogos tipados: equipment.ts, contracts.ts, techs.ts, staff.ts, balance.ts
  /state       # store Zustand, persistência, migrações
  /components  # um diretório por tela
  /i18n        # pt-BR.ts (strings centralizadas; preparado p/ EN)
  /utils       # format.ts, rng.ts
/.github/workflows/deploy.yml
vite.config.ts          # base: '/<NOME_DO_REPO>/'
```

- **Deploy:** GitHub Actions → Pages (fluxo documentado por Vite e GitHub): `actions/checkout@v4` → `actions/setup-node@v4` → `npm ci && npm run build` → `actions/upload-pages-artifact` → `actions/deploy-pages`; em Settings → Pages, Source = GitHub Actions.
- **Testes:** Vitest na engine (fórmulas RAID, ratios, checklist de Tier, janela de SLA, offline, prestígio).

## 19. Balanceamento inicial (valores-semente)

Todos centralizados em `/data/balance.ts`; **parâmetros de jogo, sem fonte externa** — sujeitos a ajuste em M7. Curva de custo padrão por categoria: `custo_n = base × 1,12ⁿ`.

| Item | Valor inicial |
|---|---|
| Work | $1/clique; upgrades ×1,5 de valor, custo crescente 1,15ⁿ |
| RB-T2 | $180 · HN-1100 base $1.200 · HN-2200 $4.800 · HN-G8 $12.000 |
| CPU 8c/16c/32c/64c | $300 / $900 / $2.600 / $7.000 |
| DIMM 16/32/64/128 GB | $40 / $85 / $190 / $420 |
| NIC 2×25G / 2×100G | +$350 / +$1.400 · 2ª PSU +$120 |
| SL-24G / SL-48X / SL-32C | $150 / $4.500 / $18.000 |
| RC-1F / RC-M6 (chassi) / LC-4×100G | $800 / $9.000 / $3.500 |
| HDD 16 TB / NVMe 8 TB | $280 / $700 |
| Rack 42U / 48U | $900 / $2.600 |
| UPS módulo 20 kVA / Gerador / CRAC 30 kW | $6.000 / $25.000 / $9.000 |
| Tarifa de energia | $0,12/kWh |
| Trânsito | $800/Gbps/mês (Peering −30%) |
| Firewall FW-S/M/L | $400 / $3.500 / $30.000 · Scrubbing $1.000/mês |
| Auditoria Tier I–IV | $2k / $8k / $30k / $100k |

## 20. Roadmap de implementação

| Marco | Conteúdo | Critério de aceite |
|---|---|---|
| M0 | Scaffold Vite+TS+ESLint, tokens visuais, CI → Pages | URL pública atualiza a cada push na `main` |
| M1 | Core loop: Work, dinheiro, RB-T2/HN-1100, tick, save/load, offline básico | Fechar o navegador e voltar preserva estado e paga offline |
| M2 | Racks, energia, refrigeração, PUE, conta de luz, térmica | Comprar acima da PDU/cooling gera consequência observável |
| M3 | Switches/roteadores, ratios, score de rede; contratos estáticos; SLA simples | Ratio > 3:1 degrada contrato sensível de forma mensurável |
| M4 | Mercado dinâmico, incidentes completos, multas/créditos | DDoS sem mitigação gera multa na janela seguinte |
| M5 | Equipe/turnos, mineração, VPS, cache embarcado | 3 NOC mantêm MTTR reduzido 24/7; cache reduz fatura de trânsito |
| M6 | Checklist Tier I–IV + auditoria, 2N, prestígio | Site 2N certificado destrava contrato governo; prestígio concede Legado correto |
| M7 | Balanceamento, acessibilidade, i18n-ready, QA, página "como jogar" | Sessão de 12 min (1 mês de jogo) sem erro de console; Lighthouse a11y ≥ 90 |

## 21. Simplificações e lacunas documentadas

1. Fator de potência fixo 0,9 (kVA→kW); sem modelagem trifásica.
2. Sem endereçamento IP/subnetting real — isolamento abstraído como flag "VLAN" por contrato.
3. Multi-site/latência geográfica fora da v1 (estrutura prevê `siteId` para v2).
4. Térmica em modelo de tanque único por site (sem hotspots por rack).
5. SLA medido em janela mensal única (sem percentis/p99).
6. AFR de PSU/UPS/CRAC sem fonte pública consolidada → declarados como parâmetros de jogo.
7. Mercado cripto inteiramente fictício (sem feed real).
8. Sem leaderboard/multiplayer — Pages é estático; exigiria backend externo (fora de escopo).
9. Disponibilidades Tier funcionam como teto estatístico, não como simulação elétrica real.

## 22. Pendências de decisão

| # | Pendência | Proposta padrão |
|---|---|---|
| P1 | Nome do produto e do repositório | provisório "DC IDLE" |
| P2 | Moeda exibida | $ neutro |
| P3 | Ritmo (tempo-alvo até o 1º prestígio) | ~8 h |
| P4 | Licença do repositório | MIT |

## 23. Referências de padrões reais

1. Uptime Institute — *Tier Classification System / Tier Standard: Topology* (disponibilidades 99,671 / 99,741 / 99,982 / 99,995%) — uptimeinstitute.com/tiers
2. The Green Grid — *WP#49: PUE — A Comprehensive Examination of the Metric* (2012)
3. ASHRAE TC 9.9 — *Thermal Guidelines for Data Processing Environments* (faixa recomendada 18–27 °C)
4. Patterson, Gibson & Katz (1988) — *A Case for Redundant Arrays of Inexpensive Disks (RAID)*, ACM SIGMOD
5. IETF RFC 4271 — *BGP-4* — datatracker.ietf.org/doc/html/rfc4271
6. IEEE 802.1AX (Link Aggregation/LACP); IEEE 802.3 (Ethernet)
7. Backblaze — *Drive Stats* (AFR médio de HDD ≈ 1,4%) — backblaze.com/cloud-storage/resources/hard-drive-test-data
8. Netflix Open Connect (openconnect.netflix.com), Google GGC e Meta FNA — programas de cache embarcado: appliance cedido, sem remuneração direta ao host
9. Oversubscription 2:1–4:1 no acesso — prática recorrente em guias de design de datacenter (Cisco/Arista); sem norma normativa única
10. Vite — *Deploying a Static Site (GitHub Pages)* — vite.dev/guide/static-deploy
11. GitHub Docs — *GitHub Pages* e `actions/deploy-pages` — docs.github.com/en/pages
