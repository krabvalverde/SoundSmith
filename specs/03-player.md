# SDD 03 — Player (Reprodução)

- **Status:** Rascunho aprovável
- **Versão:** 1.0
- **Pré-requisitos:** SDD 00 (Fundação), SDD 01 (Campanhas), SDD 02 (Estúdio)
- **Habilita:** Sala

---

## 1. Objetivo

Reproduzir a trilha de uma campanha de forma **dinâmica**: tocar faixas, escolher
o **loop ativo** (a "fase da cena"), controlar reprodução e volume, e navegar pela
**fila** de faixas. Em modo solo (sem Sala), tudo toca apenas na máquina do
Mestre; o mesmo motor é depois reaproveitado pela Sala (SDD 04) para sincronizar
os jogadores.

## 2. Escopo

### Dentro do escopo
- Tela "Agora tocando" (capa, faixa, campanha, equalizador animado).
- Barra de **progresso** e tempos (atual/total).
- **Transporte:** play/pause, loop anterior/próximo, volume.
- **Seletor de Loop:** "Sem Loop", "Faixa em Loop" e os loops nomeados da faixa.
- **Seletor de Campanha** e **fila** de faixas (selecionar faixa para tocar).
- Lógica de **transição entre loops** e **autoplay** ao fim da faixa.

### Fora do escopo
- Definir/editar loops (SDD 02).
- Sincronização com jogadores e estado de sala (SDD 04) — embora o Player seja a
  base que a Sala espelha.

---

## 3. Histórias de Usuário

- **US-03-01** — Como Mestre, quero apertar play e ouvir a faixa, mudando o "loop
  ativo" conforme a cena muda (exploração → combate → boss).
- **US-03-02** — Como Mestre, quero pular para a próxima faixa ou escolher outra na
  fila sem interromper o clima.
- **US-03-03** — Como Mestre, quero deixar a trilha tocando continuamente (autoplay
  da fila) quando não estou marcando loops.

---

## 4. UI / Telas (`data-screen-label="Player"`)

### 4.1 Coluna "Agora tocando"
- Capa grande da campanha + **badge de estado** do loop ("FAIXA EM LOOP",
  "FAIXA COMPLETA" ou "LOOP: <NOME>"), nome da faixa, nome da campanha,
  equalizador animado.
- **Barra de progresso** + tempos `atual` / `total` (mono).
- **Controles:** loop anterior (`skip-back`), **play/pause** central, próximo loop
  (`skip-forward`).
- **Volume** (slider 0–100 + valor).
- **Seção "Escolher Loop"** (grade): botões **Sem Loop** (`infinity`), **Faixa em
  Loop** (`repeat`) e um botão por loop nomeado (cor, nome, intervalo, check no
  ativo).

### 4.2 Coluna direita
- **Seletor de Campanha** (dropdown com capa, nome, contagem de faixas).
- **Fila "Faixas da Campanha"**: lista numerada com nome, subtítulo de estado
  ("Tocando agora" / "Na fila"), duração; clicar toca a faixa.

---

## 5. Requisitos Funcionais

### Reprodução básica
- **PLAY-RF-01** — **Play/Pause** alterna a reprodução da faixa atual a partir da
  posição corrente.
- **PLAY-RF-02** — A **barra de progresso** reflete a posição atual; clicar/arrastar
  faz *seek*. Os tempos `atual`/`total` acompanham.
- **PLAY-RF-03** — O **volume** ajusta o `GainNode` mestre (0–100). Persistido como
  preferência *(ver QA-03-04)*.
- **PLAY-RF-04** — O **Seletor de Campanha** troca a campanha do Player; a fila
  passa a ser as faixas dessa campanha e a primeira faixa é carregada.
- **PLAY-RF-05** — A **fila** lista as faixas da campanha na ordem `order_index`;
  clicar em uma faixa a torna a faixa atual e inicia sua reprodução.

### Loop ativo
- **PLAY-RF-06** — O **Seletor de Loop** define o modo de reprodução da faixa
  atual, com três tipos:
  - **Sem Loop** — toca a faixa inteira **uma vez**;
  - **Faixa em Loop** — repete a **faixa inteira** indefinidamente;
  - **Loop nomeado** — repete a **região `[start, end)`** daquele loop
    indefinidamente.
- **PLAY-RF-07** — **Loop anterior/próximo** (`skip-back`/`skip-forward`) percorrem
  a sequência de loops da faixa. *(A sequência segue `order_index`; ver QA-02-02 /
  QA-03-02 sobre incluir ou não "Sem Loop"/"Faixa em Loop" na navegação.)*
- **PLAY-RF-08** — A **badge** e os **checks** refletem sempre o loop ativo atual.
- **PLAY-RF-09** — O loop ativo padrão ao carregar uma faixa é **"Sem Loop"**
  (decisão de produto). *(Resolve QA-03-03.)*

### Autoplay / fim de faixa
- **PLAY-RF-10** — Em **"Sem Loop"**, ao fim da faixa o Player **avança
  automaticamente** para a **próxima faixa da fila** e inicia sua reprodução.
- **PLAY-RF-11** — Ao chegar ao **fim da fila** em autoplay (após a última faixa),
  a fila **recomeça da primeira faixa**, em loop contínuo. *(Resolve QA-03-01.)*
- **PLAY-RF-12** — A nova faixa iniciada por autoplay assume seu próprio loop ativo
  padrão (PLAY-RF-09).

---

## 6. Regras de Negócio — Transição de Loop (núcleo)

> Decisão de produto: **"esperar o fim da região"**.

- **PLAY-RN-01** — Quando o Mestre seleciona um **novo loop** enquanto a faixa toca,
  a troca é **agendada**: a reprodução **continua o loop atual até `end_ms`** e só
  então **engata** o novo loop a partir do seu `start_ms`.
- **PLAY-RN-02** — Na transição, aplica-se o **`fade_out` do loop que termina** e o
  **`fade_in` do loop que inicia**.
- **PLAY-RN-03** — O *toggle* **"Crossfade entre loops"** (Configurações, RF-00-11)
  governa a sobreposição:
  - **Ligado:** os fades se **sobrepõem** (crossfade) na fronteira da região;
  - **Desligado:** o `fade_out` conclui e então o `fade_in` começa (fades
    **sequenciais**, sem sobreposição).
- **PLAY-RN-04** — Se o novo loop for selecionado quando a posição atual **já passou**
  do `end_ms` da região vigente (ou em "Sem Loop"/"Faixa em Loop"), a troca ocorre
  no **próximo limite natural** aplicável *(ver QA-03-05 para o caso exato)*.
- **PLAY-RN-05** — Trocar para **"Faixa em Loop"** ou **"Sem Loop"** também respeita
  a regra de aguardar o fim da região atual antes de mudar de modo. *(Confirmar em
  QA-03-05.)*
- **PLAY-RN-06** — Há indicação visual de **troca pendente** (loop selecionado mas
  ainda não engatado) enquanto se aguarda o fim da região. *(ver QA-03-06.)*
- **PLAY-RN-07** — Em modo **Sala**, a mesma regra vale, mas a fronteira de troca é
  **calculada sobre a linha de tempo compartilhada** para todos engatarem
  simultaneamente (SDD 04 §6).

---

## 7. Dados (tabelas envolvidas)

`campaigns`, `tracks`, `loops` (leitura). O Player não escreve no modelo de
conteúdo; pode persistir **preferências** (volume, última campanha/faixa) em
`app_settings` *(ver QA-03-04)*.

---

## 8. Critérios de Aceitação

- **PLAY-CA-01** — *Dado* uma faixa tocando em "Exploração", *quando* seleciono
  "Combate", *então* a reprodução continua até o fim de "Exploração" e só então
  passa para "Combate", com os fades configurados.
- **PLAY-CA-02** — *Dado* "Crossfade entre loops" ligado, *quando* ocorre a troca,
  *então* há sobreposição suave; *dado* desligado, os fades são sequenciais.
- **PLAY-CA-03** — *Dado* o modo "Sem Loop" e a faixa chegando ao fim, *então* a
  próxima faixa da fila começa automaticamente.
- **PLAY-CA-04** — *Dado* "Faixa em Loop", *quando* a faixa chega ao fim, *então*
  ela recomeça do início, sem trocar de faixa.
- **PLAY-CA-05** — *Quando* clico numa faixa da fila, *então* ela vira a faixa
  atual, começa a tocar e é marcada como "Tocando agora".
- **PLAY-CA-06** — *Quando* troco a campanha no seletor, *então* a fila e a capa
  passam a refletir a nova campanha.
- **PLAY-CA-07** — *Quando* há uma troca de loop pendente, *então* a UI sinaliza que
  o novo loop entrará ao fim da região atual.

---

## 9. Questões em Aberto

> **Resolvidas:** **QA-03-01** — a fila recomeça da primeira faixa (loop
> contínuo); **QA-03-03** — padrão "Sem Loop"; **QA-03-07** — a próxima faixa do
> autoplay assume o padrão "Sem Loop", mantendo a cadeia contínua.

- **QA-03-02** — Os botões **anterior/próximo loop** navegam **só** pelos loops
  nomeados, ou incluem "Sem Loop"/"Faixa em Loop" na sequência?
- **QA-03-04** — Persistir **volume** e **última campanha/faixa** entre sessões?
- **QA-03-05** — Regra exata de troca quando **não há região vigente** (modo "Sem
  Loop"/"Faixa em Loop") ou a posição já passou do `end_ms`: trocar imediatamente,
  no fim da faixa, ou no início do próximo ciclo?
- **QA-03-06** — Como exibir a **troca pendente** (ex.: pulsar o check do loop
  selecionado, contador até a troca)?
