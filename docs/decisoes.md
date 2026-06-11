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
