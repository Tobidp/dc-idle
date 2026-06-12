# Registro de decisões

| # | Item | Decisão | Data |
|---|------|---------|------|
| D1 | Entrega | Multi-arquivo, GitHub + GitHub Pages | 2026-06-10 |
| D2 | Profundidade técnica | Realista (topologia, N+1/2N, oversubscription, Tier I–IV) | 2026-06-10 |
| D3 | Mecânicas v1 | Offline + prestígio + incidentes + mercado dinâmico | 2026-06-10 |
| D4 | Stack | React + Vite + TypeScript; deploy via GitHub Actions | 2026-06-10 |
| D5 | Visual | Ícones de linha + painéis numéricos; sem animação | 2026-06-10 |
| D6 | Receitas extras | Mineração, CDN/cache embarcado (OCA/GGC), VPS self-service | 2026-06-10 |
| D7 | Idioma da UI | pt-BR com termos técnicos em inglês | 2026-06-10 |
| P2 | Moeda | $ neutro | 2026-06-10 |
| P3 | Ritmo | Médio: ~8 h até o 1º prestígio (alvo de balanceamento, M7) | 2026-06-10 |
| P4 | Licença | MIT | 2026-06-10 |
| P1 | Nome do produto/repositório | **ABERTO** — provisório "DC IDLE"; o base path do Vite detecta o nome do repo automaticamente, então a escolha não bloqueia nada | — |

Decisões de implementação registradas no código:

- `tsconfig` único com `tsc --noEmit` no build (substitui project references; mesmo efeito de type-check, menos acoplamento).
- Renda "hospedagem avulsa" como placeholder de receita até o M3 (comentado em `src/data/balance.ts`).
- Incidentes não ocorrem offline (especificação §16).
- dt > 600 s dentro da sessão (aba suspensa) é tratado pela rota offline, com o mesmo teto.

Decisões do M2 (infraestrutura física):

- **Gerador VG-150 adiado para o M4**: sem queda de concessionária (incidentes), não tem função; entra junto com o evento que o justifica.
- **PUE calculado, não fixo**: a §7 cita PUE base 1,6; a implementação deriva PUE = (IT + elétrico do CRAC + perdas do UPS) / IT, com CRAC modulante (consome 1 kW a cada 3 kW removidos, COP 3,0) e perdas de 5% quando há UPS. Resultado típico ≈1,38 com CRAC + UPS. Free cooling/techs (M5–M6) ajustarão.
- **Throttle térmico escalonado** (≥27 °C ×0,9; ≥32 ×0,7; ≥35 ×0,4) substitui os "desligamentos" da §7 até o sistema de incidentes (M4). Recuperação fixa de 2 °C/h e temperatura congelada offline são parâmetros de jogo.
- **Instalações como extensão da §6.6**: a entrada de energia vem da instalação (Quarto 1,2 kW → Circuito dedicado 7 kW → Sala comercial 30 kW + aluguel); a PDU limita por rack; o UPS, quando presente, é teto adicional do caminho elétrico. UPS e CRAC exigem sala comercial.
- **Alocação automática** first-fit decreasing por consumo (racks 48U → 42U → bancada 8U). Unidades de saves antigos sem lugar continuam operando (graça de migração), mas novas compras ficam bloqueadas até haver espaço.
- **Migração de save v1 → v2**: presets do M1 viram builds equivalentes (mesmo preço-base, consumo e capacidades); chave do `localStorage` inalterada; import aceita ambas as versões.
- **Adiamentos registrados**: baias de GPU do HN-2200 → M5 (mineração); canais de memória ignorados no configurador (lacuna, §21).

Decisões do M3 (rede e contratos):

- **SLA simples**: a receita efetiva escala com a qualidade (throttle térmico × score de rede quando sensível). A janela mensal formal com multas/créditos e rescisão por SLA entra no M4, conforme o roadmap.
- **Pool estático de contratos**: os 8 tipos da §10 ficam sempre disponíveis e aceitáveis múltiplas vezes; duração/expiração, reputação e oscilação de preço chegam com o mercado dinâmico (M4). Rescisão sem penalidade no M3.
- **Camada de acesso agregada**: portas somadas em Gbps, sem casamento de velocidade por porta (simplificação registrada). Estágios (a)/(b) da §8 ficam abstraídos em camada única; spine-leaf, SL-32C/SL-32D e RC-M6 modular vão para o M6 (Tier/redundância).
- **Capacidade conectada**: pool de contratos = capacidade instalada × fração de NICs com porta de switch; capacidade sem porta não atende contratos (a avulsa, abstraída como acesso local, continua).
- **VLAN** satisfeita por possuir ≥1 switch gerenciável (flag abstrata, §21-2). **Tier/certificação** bloqueiam SaaS/fintech/governo até o M6.
- **Links WAN** sem custo de ativação (parâmetro); trânsito $800/Gbps/mês sobre a capacidade contratada (§19); cada link consome 1 sessão BGP de roteador — links além das sessões derrubam a borda.
- **Equipamentos de rede** ocupam U, consomem W e entram na carga IT (térmica, PUE e bloqueios espaço/PDU/entrada/UPS).
- **Avulsa = capacidade ociosa**: com contratos ativos, a hospedagem avulsa passa a remunerar apenas vCPU não alocada (transição prevista na §19).
- **Preços sem semente na §19** (SL-48T $2.500, RC-2F $6.000, receitas mensais dos 8 contratos) definidos como parâmetros de jogo em `data/`.

Decisões do M4 (mercado, incidentes e SLA):

- **Janela de SLA por contrato** (rolling, 720 s online a partir do aceite) em vez de janela global única — leitura prática da §10 que evita pró-rata no aceite; registrada como interpretação.
- **Tempo offline não conta para a janela de SLA** nem gera incidentes (§16); a renda offline usa a taxa do logout e expirações/fechamentos processam no retorno.
- **Receita efetiva continua escalando com a qualidade (M3)** e, adicionalmente, a janela aplica multas: o score 90/75 afeta só a receita de sensíveis; score < 75 também entra no uptime medido, como na §10.
- **Cobertura de queda de energia** resolvida analiticamente: UPS = ponte de 10 min de jogo (se capacidade ≥ carga); gerador parte em 30 s de jogo (gap coberto pelo UPS quando presente); diesel $40/h de jogo só durante o evento; conta de energia da concessionária zera durante a queda.
- **Incidentes adiados**: falha de disco exige StorBay/RAID (fora do M4); rompimento de fibra usa redução de Gbps por link (2ª operadora/MLAG no M6). Severidades S1–S3 ficam implícitas nos efeitos.
- **Erro humano** aplicado a compras de rede e ajustes de link (2%/ação): derruba a camada de acesso por 1 h de jogo.
- **Ofertas geradas só para tipos sem exigência de Tier/certificação** até o M6; máx. 6 simultâneas; preços inteiros.
- **Log com texto pré-renderizado em pt-BR** (engine recebe rótulos injetados; i18n EN no M7 re-renderiza apenas eventos novos — lacuna registrada).
- **Frequência de DDoS** = 4 + 0,16 × reputação por ano de jogo; duração 2–12 h; demais taxas sem fonte na §13 declaradas parâmetros.
