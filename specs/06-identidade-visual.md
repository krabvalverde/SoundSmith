# SDD 06 — Identidade Visual "A Forja"

- **Status:** Rascunho aprovável
- **Versão:** 1.0
- **Pré-requisitos:** SDD 00 (Fundação), SDD 01–04 (telas existentes), SDD 05 (correções de shell)
- **Habilita:** — (refinamento transversal; emenda ao SDD 00 §9)

---

## 1. Objetivo

Elevar o visual do SoundSmith de "dashboard escuro competente" para uma
identidade própria, derivada do próprio nome do produto: **um ferreiro de som**.
O Mestre usa o app **ao vivo, numa sala escura, durante a sessão de RPG** — o
visual deve servir a essa cena: legível no escuro, quieto quando parado, e
**visivelmente aceso quando há som tocando**.

Este documento **emenda o SDD 00 §9** (Design System). Nenhuma funcionalidade
muda; muda o material, a hierarquia e o movimento.

## 2. Diagnóstico do estado atual

| # | Problema | Evidência |
|---|----------|-----------|
| V1 | **Superfícies sem elevação real** — os três tons de surface são quase idênticos (`#16131b` / `#16161b` / `#121217`); cards, modais e itens de lista se distinguem só por bordas hairline | `styles/tokens.css:4-6` |
| V2 | **Accent sobrecarregado** — a cor de destaque (roxo `#8b5cf6`) sinaliza ao mesmo tempo: nav ativa, botão primário, sessão ao vivo, jogador sincronizando, badge de loop. Nenhum estado tem cor própria; "ao vivo" não se diferencia de "selecionado" | `NavRail.css:34-39`, `Sala.css:61-64,99-121,339` |
| V3 | **Hover/estados baratos** — botão primário faz hover com `opacity: 0.9`; active com `opacity: 0.8`. Não há sensação de material | `styles/components.css:13-15` |
| V4 | **Sem `focus-visible`** — botões, toggles e sliders não têm anel de foco; navegação por teclado é invisível (falha de acessibilidade) | `styles/components.css` (ausência) |
| V5 | **Movimento sem identidade** — só transições de 0.15–0.2s em opacity/background; nenhum momento orquestrado; animações (EQ, pulse) não respeitam `prefers-reduced-motion` | global |
| V6 | **Estados vazios mudos** — texto cinza ("Nenhuma faixa nesta campanha.") sem convite à ação | `Player.tsx:454`, `Sala.css:222-227` |
| V7 | **Metáfora desperdiçada** — "SoundSmith" promete forja; a UI não tem um único elemento que lembre calor, ferro ou brasa. O tema escuro atual é intercambiável com qualquer app | — |

## 3. Escopo

### Dentro do escopo
- Tokens: paleta de superfícies (escada de elevação), cor de estado sonoro
  ("brasa"), escala tipográfica, tokens de movimento.
- Assinatura visual: o estado **"forja acesa"** (§5).
- Refinamento de componentes base: botões, foco visível, cards, nav rail,
  capa de campanha, estados vazios.
- Regras de papel de cor (o que cada cor pode significar).
- Acessibilidade: foco visível, contraste, `prefers-reduced-motion`.
- Diretrizes de texto de interface (microcopy).

### Fora do escopo
- Trocar as famílias tipográficas — `Metamorphous`/`Manrope`/`JetBrains Mono`
  (SDD 00 §9.2) **permanecem**. A serifada temática já é o ativo mais
  distintivo do app; o problema é de escala e hierarquia, não de fonte.
- Ícone do aplicativo/instalador (QA-05-03).
- Novas telas ou mudanças de layout estrutural (grid de colunas etc.).
- Tema claro.

---

## 4. Direção de design — "A Forja"

> **Conceito:** o app em repouso é **ferro frio** — escuro, quieto, arrumado.
> Quando o som toca, a forja acende: **calor entra pela interface** nos pontos
> ligados ao áudio. A cor quente não é decoração; é **informação de estado**
> (há som saindo agora?). O Mestre percebe de canto de olho, no escuro da
> mesa, se a trilha está viva.

Duas consequências estruturais:

1. A **cor de destaque continua variável** (RF-00-17, escolha do Mestre) e
   mantém os papéis de *identidade e seleção*: nav ativa, botão primário,
   foco, links.
2. Nasce uma **segunda cor, fixa, não configurável: a brasa** — reservada
   exclusivamente para "áudio soando agora". Por ser fixa, a identidade do
   produto não depende da escolha de accent do usuário.

### 4.1 Tokens de cor (emenda ao SDD 00 §9.1)

| Token | Valor | Nome | Papel |
|-------|-------|------|-------|
| `--color-bg` | `#121014` | **Carvão** | fundo base (levemente aquecido em relação ao atual `#0f0d11`) |
| `--color-surface-1` | `#191519` | **Ferro** | cards e seções |
| `--color-surface-2` | `#201a1f` | **Ferro polido** | itens de lista, tiles, inputs sobre cards |
| `--color-surface-3` | `#282026` | **Relevo** | hover de itens, thumb de controles |
| `--color-brasa` | `#f0913d` | **Brasa** | estado "som tocando" — exclusivo (RN-06-01) |
| `--color-brasa-clara` | `#ffc07a` | **Brasa clara** | picos do glow, texto sobre fundos com brasa |

- As três superfícies formam **escada de elevação real** (≈ +6% de luminância
  por degrau) — resolve V1. Borda hairline vira reforço, não único separador.
- Textos, estados de sucesso/erro/atenção e a **paleta de loops** (que é
  funcional — cada loop tem cor própria escolhida no Estúdio) permanecem como
  no SDD 00 §9.1.
- Versões alfa da brasa (`10/20/35`) derivadas, como já se faz com o accent.

### 4.2 Escala tipográfica (emenda ao SDD 00 §9.2)

Famílias inalteradas; nasce escala fixa com papéis:

| Token | Tamanho/peso | Família | Uso |
|-------|--------------|---------|-----|
| `--type-display` | 28px / 400 | Metamorphous | título da tela (um por tela, no topo) |
| `--type-title` | 18px / 400 | Metamorphous | título de card/seção temática |
| `--type-body` | 14px / 400–600 | Manrope | corpo, botões, listas |
| `--type-caption` | 12px / 500 | Manrope | descrições, subtítulos de item |
| `--type-eyebrow` | 11px / 700, caps, tracking 0.1em | Manrope | rótulos de seção (padrão único — hoje variam 10–12px e 0.05–0.1em) |
| `--type-data` | 13px / 500 | JetBrains Mono | tempos, latência, IPs, código de sala |

Regra: **Metamorphous nunca em textos longos nem abaixo de 16px** (é fonte de
display; em corpo pequeno vira ruído). Iniciais de capa são a exceção
consagrada.

### 4.3 Movimento

| Token | Valor | Uso |
|-------|-------|-----|
| `--motion-fast` | 150ms | hovers, toggles |
| `--motion-base` | 250ms | entrada/saída de elementos, trocas de estado |
| `--motion-slow` | 600ms | **acender/apagar a forja** (glow de playing) |
| `--motion-ease` | `cubic-bezier(0.2, 0, 0, 1)` | curva padrão (desacelera no fim) |

Um único momento orquestrado (§5); nada de animação ambiente espalhada.

---

## 5. Assinatura — "Forja acesa" (estado sonoro)

O elemento pelo qual o app será lembrado. Quando `playing === true`:

```
   ┌─ Player · Agora tocando ────────────┐
   │        ╭──────────────╮             │
   │   ░░▒▒▓│  CAPA  (LC)  │▓▒▒░░        │   ← halo de brasa radial atrás
   │        ╰──────────────╯             │     da capa (não em volta do card)
   │      ▁▃▅▂▆  eq em brasa             │
   │  ━━━━━━━━━━━━━━●─────────           │   ← ponta do preenchimento da
   │  1:22                    3:47       │     barra com gradiente → brasa
   └─────────────────────────────────────┘
```

- **FORJ-RF-01** — No **Player**, enquanto o áudio toca: (a) um halo radial
  suave em brasa surge **atrás da capa** (fade-in `--motion-slow`); (b) as
  barras do EQ usam brasa (hoje herdam accent); (c) os **últimos ~48px do
  preenchimento** da barra de progresso terminam em gradiente para brasa —
  a "ponta quente" avança com a música. Ao pausar, tudo esfria com fade-out
  na mesma duração.
- **FORJ-RF-02** — Na **Sala**, com sessão ativa **e** som tocando, o
  `live-dot` e o badge "AO VIVO" usam **brasa** (hoje usam accent). Sessão
  ativa sem som tocando: badge em accent (sala aberta, forja fria).
- **FORJ-RF-03** — O **badge de loop** do Player (`LOOP: <NOME>`), quando
  tocando, ganha o glow em brasa já previsto para o estado playing — não a
  cor do loop (a cor do loop já aparece no dot do botão; ver RN-06-01).
- **FORJ-RF-04** — Halo/glow são **compostos por `opacity`/`transform` apenas**
  (sem animar `box-shadow` por frame) para não custar GPU em sessão longa.

## 6. Requisitos — componentes e telas

### Componentes base
- **FORJ-RF-05** — **Botões:** hover do primário clareia o fundo
  (`filter: brightness(1.1)` ou token dedicado) e o active **afunda 1px**
  (`transform: translateY(1px)`); fim dos hovers por opacidade (V3).
  Secundário e ghost ganham fundo `--color-surface-3` no hover.
- **FORJ-RF-06** — **Foco visível:** todo elemento interativo (botões, inputs,
  selects, toggles, sliders, itens de fila, swatches) exibe anel de foco em
  `:focus-visible` — 2px na cor de accent, offset 2px (resolve V4).
- **FORJ-RF-07** — **Cards:** elevação pela escada de superfícies (§4.1);
  hover de itens clicáveis (fila, campanhas recentes, jogadores) usa
  `--color-surface-3`, não borda mais clara.
- **FORJ-RF-08** — **Nav rail:** item ativo mantém accent, mas o tratamento
  atual (borda + glow + fundo, três sinais) reduz para **dois**: fundo alfa +
  ícone/label em accent. Glow fica reservado à forja (§5).
- **FORJ-RF-09** — **Capa de campanha ("selo forjado"):** o gradiente radial
  atual ganha (a) um **anel interno** de 1px em branco-alfa 12% inset, e (b)
  `text-shadow` sutil nas iniciais (2px, preto 40%) — efeito de selo cunhado
  em metal. Vale para todos os tamanhos de capa (Sala, Player, Campanhas).
- **FORJ-RF-10** — **Estados vazios como convite** (resolve V6): ícone lucide
  + uma linha do que fazer + **ação primária quando existir**. Padrões:
  - Fila vazia no Player: "Esta campanha ainda não tem faixas." + botão
    "Adicionar faixas" (navega para Campanhas);
  - Sem jogadores na Sala: "Compartilhe o código da sala para os jogadores
    entrarem." + código em `--type-data`;
  - Sem campanhas: "Crie sua primeira campanha." + botão "Nova campanha".

### Telas
- **FORJ-RF-11** — **Título de tela:** cada tela abre com `--type-display`
  (Metamorphous 28px) — hoje só Configurações tem título de página, em Manrope.
  Sala mantém a saudação como está (o nome do Mestre já é o display da tela).
- **FORJ-RF-12** — **Rótulos de seção:** todos os eyebrows (`.section-label`,
  `.sala-section-title`, `.label`) convergem para `--type-eyebrow` (um padrão,
  não três).
- **FORJ-RF-13** — **Estúdio:** a waveform ganha linha de fundo em
  `--color-surface-3` e as **regiões de loop** mantêm suas cores funcionais —
  brasa não aparece no Estúdio (lá não há reprodução ao vivo, só preview;
  preview usa o mesmo tratamento §5 apenas no mini-transporte).
- **FORJ-RF-14** — **Scrollbar/noise:** mantidos (já são discretos); o overlay
  de noise desce para `z-index` abaixo de modais (hoje 9999 cobre o modal em
  1000 — inofensivo mas incorreto).

## 7. Regras de Negócio

- **RN-06-01** — **Papéis de cor são exclusivos e não se misturam:**
  | Cor | Significa | Nunca significa |
  |-----|-----------|-----------------|
  | Accent (variável) | identidade, seleção, ação primária, foco | "som tocando" |
  | **Brasa (fixa)** | **áudio soando agora** | seleção, hover, decoração |
  | Cores de loop | identidade do loop (dots, regiões, waveform) | estado do app |
  | Sucesso/erro/atenção | resultado de operação, status de conexão | reprodução |
  Um elemento que já usa brasa não usa accent ao mesmo tempo.
- **RN-06-02** — **`prefers-reduced-motion: reduce`:** EQ, pulses, halo e
  transições longas são **desligados ou congelados em estado estático
  equivalente** (ex.: halo aparece sem fade, EQ vira barras estáticas em
  brasa). Informação de estado nunca depende só do movimento.
- **RN-06-03** — **Contraste:** texto primário e secundário ≥ 4.5:1 sobre
  qualquer superfície da escada; brasa sobre Carvão/Ferro ≥ 3:1 para
  elementos gráficos. Verificar os pares ao implementar (a escada de §4.1 foi
  desenhada para isso).
- **RN-06-04** — **Microcopy:** voz ativa, sentence case, pt-BR; botões dizem
  o que fazem ("Salvar alterações", não "OK"); a mesma ação mantém o mesmo
  nome em todo o fluxo (botão "Criar sala" → toast "Sala criada"). Flavor
  temático é permitido **apenas** em títulos e estados vazios — nunca em
  botões, rótulos ou mensagens de erro (erros dizem o que houve e como
  resolver, sem se desculpar).
- **RN-06-05** — Migração de tokens é **global e sem fork**: os valores novos
  substituem os antigos em `tokens.css`; nenhuma tela pode manter hex
  hard-coded dos valores antigos (varredura por `#16131b|#16161b|#121217|#0f0d11`
  deve retornar só `tokens.css` e o `backgroundColor` da janela em
  `src/main/index.ts`, que acompanha `--color-bg`).

---

## 8. Critérios de Aceitação

- **FORJ-CA-01** — *Dado* o Player com faixa **tocando**, *então* halo atrás
  da capa, EQ e ponta da barra de progresso exibem brasa; *quando* pauso,
  *então* os três esfriam (fade-out ~600ms) e nenhum elemento da tela
  permanece em brasa.
- **FORJ-CA-02** — *Dado* qualquer accent escolhido em Configurações
  (RF-00-17), *então* a brasa permanece `#f0913d` — trocar o accent não muda
  nenhum elemento de estado sonoro.
- **FORJ-CA-03** — *Dado* uma sala ativa **sem** reprodução, *então* o badge
  "AO VIVO" usa accent; *quando* o som começa, *então* muda para brasa.
- **FORJ-CA-04** — *Dado* navegação por `Tab` em qualquer tela, *então* cada
  elemento interativo mostra anel de foco visível na ordem esperada.
- **FORJ-CA-05** — *Dado* o SO com "reduzir movimento" ativo, *então* não há
  animação de EQ, pulse ou fade longo — e o estado "tocando" continua
  distinguível (brasa estática presente).
- **FORJ-CA-06** — *Dado* um card sobre o fundo e um item de lista sobre o
  card, *então* as três camadas são distinguíveis sem depender das bordas
  (escada de elevação perceptível).
- **FORJ-CA-07** — *Dado* uma campanha sem faixas aberta no Player, *então*
  o estado vazio mostra ícone, orientação e ação — não apenas uma frase cinza.
- **FORJ-CA-08** — *Dado* qualquer tela, *então* existe exatamente um título
  em Metamorphous 28px no topo e todos os eyebrows têm o mesmo tamanho,
  peso e tracking.
- **FORJ-CA-09** — Varredura de contraste dos pares texto/superfície e
  brasa/superfície passa os mínimos de RN-06-03.
- **FORJ-CA-10** — `git grep -iE '#(16131b|16161b|121217|0f0d11)' -- src` →
  ocorrências apenas em `tokens.css` (valores novos) e `src/main/index.ts`
  (RN-06-05).

---

## 9. Verificação

```bash
npm run typecheck   # sem erros
npm run dev         # roteiro visual abaixo
```

Roteiro manual:
1. Player: play → forja acende (CA-01); trocar accent em Configurações →
   brasa não muda (CA-02).
2. Sala: criar sala parada vs. tocando (CA-03).
3. `Tab` por Sala, Player e Configurações (CA-04).
4. Ativar "reduzir movimento" no Windows → revisitar Player (CA-05).
5. Conferir elevação em Sala (fundo → seção → item) (CA-06).
6. Campanha vazia no Player (CA-07); títulos/eyebrows em todas as telas (CA-08).
7. Verificador de contraste nos pares novos (CA-09) e grep de hex (CA-10).

---

## 10. Questões em Aberto

- **QA-06-01** — O `backgroundColor` da janela (`src/main/index.ts`) deve
  acompanhar o novo Carvão `#121014` — confirmar que não há flash branco na
  abertura com o valor novo.
- **QA-06-02** — A brasa deve aparecer também no **cliente jogador** (modo
  "Entrar em Sala", SDD 04) enquanto recebe áudio? *(Sugestão: sim — mesma
  regra "som soando = brasa", reforça o conceito nos dois lados.)*
- **QA-06-03** — O swatch de accent laranja das Configurações (se existir na
  paleta predefinida) conflita visualmente com a brasa. Remover o laranja das
  opções de accent ou aceitar a coincidência? *(Sugestão: remover/substituir
  por outro tom, preservando RN-06-01 na percepção.)*
- **QA-06-04** — Halo da capa no Player: gradiente CSS estático com fade de
  opacidade (barato) ou leve "respiração" (escala 1→1.02 em ~4s, desligada em
  reduced-motion)? *(Sugestão: começar estático; respiração só se parecer
  morto em uso real.)*
