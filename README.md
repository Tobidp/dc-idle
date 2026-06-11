# DC IDLE <sub>(título provisório — pendência P1)</sub>

Jogo idle/incremental para navegador: de um PC no quarto ao maior datacenter do mundo. Sem animações e sem imagens — ícones de linha e painéis numéricos. Configurações de equipamento seguem padrões reais (form factor em U, DIMMs, RAID, LACP, BGP, oversubscription, redundância N+1/2N, Tier I–IV).

Cliente estático (React + Vite + TypeScript), sem backend. Save em `localStorage`, com export/import.

Especificação completa: [`docs/especificacao-v1.0.md`](docs/especificacao-v1.0.md) · Decisões: [`docs/decisoes.md`](docs/decisoes.md)

## Estado de implementação

| Marco | Conteúdo | Status |
|---|---|---|
| M0 | Scaffold, tokens visuais, CI → GitHub Pages | concluído |
| M1 | Core loop: Work, compras (presets RB-T2/HN-1100), tick, save/load, progresso offline, limite do circuito doméstico (1,2 kW) | concluído |
| M2 | Instalações, racks (PDU), UPS, CRAC, PUE calculado, térmica/throttle, configurador de componentes | concluído |
| M3 | Rede (switches/roteadores), oversubscription, contratos, SLA | pendente |
| M4 | Mercado dinâmico, incidentes, multas | pendente |
| M5 | Equipe/turnos, mineração, VPS, cache embarcado | pendente |
| M6 | Tier I–IV, redundância 2N, prestígio | pendente |
| M7 | Balanceamento, acessibilidade, i18n, QA | pendente |

Nota de design (§19 da especificação): a renda passiva atual ("hospedagem avulsa", $/vCPU/mês) é o placeholder de receita até os contratos do M3; depois permanece como renda de capacidade ociosa.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub (**qualquer nome** — o caminho base do Vite é detectado automaticamente via `GITHUB_REPOSITORY`).
2. Envie o código:

   ```bash
   git init
   git add -A
   git commit -m "M0-M2"
   git branch -M main
   git remote add origin git@github.com:SEU_USUARIO/SEU_REPO.git
   git push -u origin main
   ```

3. No GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. O workflow `Deploy` roda testes, build e publica. URL: `https://SEU_USUARIO.github.io/SEU_REPO/`.

Antes de publicar, substitua o titular em [`LICENSE`](LICENSE) (placeholder `<TITULAR DOS DIREITOS - SUBSTITUIR>`).

## Desenvolvimento local

Requisitos: Node 20+.

```bash
npm install      # instala dependências
npm run dev      # servidor local (http://localhost:5173)
npm run test:run # testes da engine (Vitest)
npm run build    # type-check + build de produção em dist/
npm run lint     # ESLint
```

## Estrutura

```
src/
  engine/      lógica pura, sem React (economia, builds, site físico, offline)
  data/        catálogos e balanceamento (balance.ts concentra todos os números)
  state/       store Zustand + persistência (zod, export/import Base64)
  components/  telas (Painel, Compras, Config) e compartilhados (RatioMeter)
  i18n/        strings pt-BR centralizadas
  styles/      tokens de design + CSS global (sem animações)
  utils/       formatação pt-BR, PRNG determinístico (mulberry32)
.github/workflows/deploy.yml   CI: testes → build → Pages
```

## Mecânicas já ativas

- **Escala de tempo:** 1 s real = 1 h de jogo (1 mês = 12 min reais).
- **Work:** +$ por clique; upgrades multiplicam o valor por 1,5 (custo 1,15ⁿ).
- **Equipamentos:** presets com preço progressivo por modelo (base × 1,12ⁿ) e consumo em W; renda por vCPU; conta de energia kW × PUE × $0,12/kWh.
- **Limites físicos encadeados (M2):** compra de servidor é validada em ordem — espaço em U (racks + bancada, alocação automática first-fit por consumo), PDU por rack (42U: 5 kW; 48U: 2×8,6 kW A+B), entrada da instalação e teto do UPS. Cada bloqueio exibe o motivo.
- **Instalações:** Quarto (1,2 kW, bancada 8U, 1 vaga de rack) → Circuito dedicado (7 kW) → Sala comercial (30 kW, 6 vagas, dissipação ambiente 3 kW, aluguel $250/mês). Fases F1–F3 derivadas da infraestrutura.
- **Energia e PUE:** UPS modular (≈18 kW/módulo, perdas de 5% no caminho) e CRAC (remove 30 kW térmicos, COP 3,0). PUE calculado: (IT + CRAC + perdas UPS) / IT — aparece na conta de energia.
- **Térmica:** calor = potência IT; déficit de refrigeração eleva a temperatura (+1 °C/h por 10% de déficit); throttle escalonado em 27/32/35 °C (×0,9/×0,7/×0,4) reduz a renda — comprar além do cooling tem consequência observável, não bloqueio.
- **Configurador:** CPU, DIMMs, NIC, 2ª PSU e NVMe por modelo (RB-T2, HN-1100, HN-2200); preço/consumo/capacidade compostos peça a peça; preço progressivo por modelo (× 1,12ⁿ). Saves v1 migram automaticamente para builds equivalentes.
- **Offline:** ganho em forma fechada, teto de 12 h, relatório ao retornar; abas suspensas por >10 min usam a mesma rota.
- **Save:** autosave 30 s + `beforeunload` + `visibilitychange`; schema validado (zod); save corrompido vira backup em `dcidle.save.v1.corrupt`; export/import em Base64.

## Licença

MIT — ver [`LICENSE`](LICENSE).
