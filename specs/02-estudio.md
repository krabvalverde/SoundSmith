# SDD 02 — Estúdio (Editor de Trilha / Loops)

- **Status:** Rascunho aprovável
- **Versão:** 1.0
- **Pré-requisitos:** SDD 00 (Fundação), SDD 01 (Campanhas)
- **Habilita:** Player, Sala

---

## 1. Objetivo

Permitir ao Mestre **definir as regiões (loops)** de uma faixa: marcações nomeadas
com início, fim, fades e observações, que representam as "fases de cena"
(Introdução, Exploração, Combate, Boss, Vitória, etc.). Esses loops são o que o
Player e a Sala usam para reagir dinamicamente ao jogo.

## 2. Escopo

### Dentro do escopo
- Seleção de **campanha → faixa** a editar.
- Visualização de **forma de onda (waveform)** com régua de tempo e zoom.
- **Bandas de região** coloridas sobre a waveform (os loops).
- Criar, selecionar, editar e excluir **loops**.
- Painel de **propriedades** do loop (início, fim, duração, fade-in, fade-out,
  observações).
- **Preview do Loop** (tocar apenas a região).
- Transporte mínimo (play/pause/stop, tempo atual, volume) ancorado à faixa.
- **Salvar** alterações.

### Fora do escopo
- Edição destrutiva do áudio (cortar/normalizar/efeitos) — apenas marcações.
- Importar/excluir faixas (SDD 01).
- Reprodução para jogadores (SDD 03/04).

---

## 3. Histórias de Usuário

- **US-02-01** — Como Mestre, quero marcar trechos de uma música (ex.: "Combate",
  "Boss Fase 1") para depois acioná-los conforme a cena evolui na mesa.
- **US-02-02** — Como Mestre, quero ajustar início/fim e fades de cada loop com
  precisão, ouvindo um preview, para que as transições soem bem.
- **US-02-03** — Como Mestre, quero anotar observações em cada loop (ex.: "entrada
  rápida na emboscada") para lembrar a intenção da cena.

---

## 4. UI / Telas (`data-screen-label="Estudio"`)

### 4.1 Cabeçalho
- Capa + rótulo "Estúdio · Editor de Trilha".
- **Seletor de Campanha** (dropdown `library`) → **Seletor de Faixa** (dropdown
  `music`), encadeados (faixa pertence à campanha selecionada).
- Controle de **Zoom** (− / % / +) e botão **Salvar**.

### 4.2 Área principal (grade: editor + lista de loops)
- **Card da waveform:**
  - **Régua** de tempo no topo (0:00 … duração).
  - **Bandas de região** posicionadas proporcionalmente (cada loop = faixa
    colorida com `border-left` na cor do loop e rótulo com o nome).
  - **Canvas** da forma de onda (picos `waveform_peaks`).
  - **Playhead** (linha vertical) na posição atual.
  - **Transporte sob a onda:** play/pause, stop, tempo atual / total, volume.
- **Painel de Propriedades** (do loop selecionado): pílula de cor + nome, botão
  **Preview do Loop**; campos **Início, Fim, Duração, Fade In, Fade Out** e
  **Observações**.
- **Lista "Loops da Faixa"** (direita): itens arrastáveis (`grip-vertical`) com
  cor, nome, intervalo (`início – fim`) e duração; botão **Criar Loop**.

---

## 5. Requisitos Funcionais

### Seleção e navegação
- **EST-RF-01** — O Mestre seleciona uma campanha e, dentro dela, uma faixa. A
  troca de faixa carrega seus loops e sua waveform.
- **EST-RF-02** — A waveform é renderizada a partir de `tracks.waveform_peaks`. Se
  ainda não houver picos calculados, o app os calcula sob demanda e os persiste.
- **EST-RF-03** — Zoom altera a escala horizontal da waveform/régua sem alterar os
  dados; o estado de zoom é visual (não persiste, salvo decisão em QA-02-05).
- **EST-RF-15** — O Mestre pode **renomear a faixa atual** (`tracks.title`)
  diretamente no Estúdio (conveniência ao editar). A gerência estrutural de faixas
  — adicionar, remover e reordenar — fica em **Campanhas** (SDD 01, CAMP-RF-12).

### Loops — CRUD
- **EST-RF-04** — **Criar Loop**: cria um loop na faixa atual com valores padrão
  (ver EST-RN-02), próxima cor disponível da paleta e nome padrão; entra em modo
  de edição.
- **EST-RF-05** — **Selecionar Loop** (na lista ou na banda) destaca-o e carrega
  o painel de Propriedades.
- **EST-RF-06** — **Editar Loop**: o Mestre altera **nome, cor, início, fim,
  fade-in, fade-out e observações**. A **duração** é derivada (`end - start`,
  somente leitura).
- **EST-RF-07** — **Excluir Loop**: remove o loop (com confirmação).
- **EST-RF-08** — **Reordenar Loops**: o Mestre reordena por arrastar
  (`grip-vertical`), persistindo `order_index`. *(ver QA-02-02 sobre o papel da
  ordem.)*
- **EST-RF-09** — Início e fim são definidos de **duas formas, ambas suportadas**:
  (a) **digitando** o tempo no formato `m:ss.d` (ex.: `2:15.0`) no painel de
  Propriedades; (b) **arrastando** as bordas da banda do loop diretamente na
  waveform. As duas vias permanecem sincronizadas em tempo real. *(Resolve
  QA-02-01.)*

### Preview e transporte
- **EST-RF-10** — **Preview do Loop** reproduz apenas a região `[start, end)` do
  loop selecionado, aplicando `fade_in`/`fade_out`, e repete até o Mestre parar.
- **EST-RF-11** — O transporte sob a waveform controla a reprodução da faixa no
  Estúdio (local ao Mestre); clicar/arrastar a waveform move o playhead (*seek*).
- **EST-RF-12** — O volume do Estúdio usa o `GainNode` mestre do motor de áudio
  (SDD 00 §8) e não afeta a configuração da Sala.

### Persistência
- **EST-RF-13** — **Salvar** grava todas as alterações de loops da faixa em `loops`
  e atualiza `tracks.updated_at` e `campaigns.updated_at`.
- **EST-RF-14** — O app sinaliza alterações não salvas e alerta se o Mestre tentar
  sair da faixa/tela com mudanças pendentes. *(ver QA-02-04 sobre autosave.)*

---

## 6. Regras de Negócio

- **EST-RN-01** — Um loop é uma **região `[start_ms, end_ms)`** de uma faixa, com
  `end_ms > start_ms`, ambos dentro de `[0, duration_ms]`.
- **EST-RN-02** — Valores padrão ao criar: início = posição atual do playhead (ou
  0), fim = início + 30 s, **limitado à duração da faixa e ao início do próximo
  loop existente** (para não sobrepor); `fade_in_ms = 0`, `fade_out_ms = 0`, nome =
  "Loop N". Se não houver espaço livre a partir do playhead, o app posiciona o novo
  loop na **próxima lacuna livre**. *(Ajustável; ver QA-02-03.)*
- **EST-RN-03** — **Loops não podem se sobrepor** no tempo (decisão de produto).
  Ao criar ou editar, o app **valida** que a região `[start, end)` não intersecta
  nenhum outro loop da mesma faixa; sobreposição é **bloqueada** com mensagem. Ao
  arrastar uma borda na waveform, ela **para no limite** do loop vizinho.
  *(Resolve QA-02-06.)*
- **EST-RN-04** — `fade_in` e `fade_out` são durações em segundos/ms; um loop pode
  ter fade 0. A soma `fade_in + fade_out` **não pode exceder** a duração do loop.
- **EST-RN-05** — A **cor** do loop sai da paleta de cores de loop (SDD 00 §9.1);
  duas marcações podem repetir cor se a paleta se esgotar.
- **EST-RN-06** — **Transição entre loops (definição):** este é o local onde os
  `fade_in`/`fade_out` são definidos; a aplicação deles na troca de loop (esperar
  o fim da região e então engatar) ocorre no Player/Sala (SDD 03 §6). O Estúdio só
  define os valores e os pré-visualiza isoladamente.
- **EST-RN-07** — Editar loops **não altera o arquivo de áudio**; são apenas
  metadados.

---

## 7. Dados (tabelas envolvidas)

`tracks` (leitura, `waveform_peaks`, `duration_ms`) e `loops` (CRUD completo).
Ver esquema no SDD 00 §7.

---

## 8. Critérios de Aceitação

- **EST-CA-01** — *Dado* uma faixa sem loops, *quando* clico em "Criar Loop",
  *então* surge um loop com valores padrão, selecionado, com banda visível na
  waveform e item na lista.
- **EST-CA-02** — *Dado* um loop selecionado, *quando* altero o fim de `0:42` para
  `1:00` e salvo, *então* a banda e a duração derivada atualizam e o valor persiste
  ao reabrir a faixa.
- **EST-CA-03** — *Dado* um loop com fade-in 1.5s e fade-out 0.8s, *quando* clico
  em "Preview do Loop", *então* ouço apenas a região, com os fades, repetindo.
- **EST-CA-04** — *Dado* `end_ms ≤ start_ms`, *quando* tento salvar, *então* o app
  bloqueia com mensagem de validação.
- **EST-CA-05** — *Dado* alterações não salvas, *quando* troco de faixa, *então* o
  app me alerta antes de descartar.
- **EST-CA-06** — *Dado* que reordeno loops na lista e salvo, *então* a nova ordem
  (`order_index`) persiste.
- **EST-CA-07** — *Dado* um loop em `2:15–3:30`, *quando* tento criar/editar outro
  loop cuja região invada esse intervalo, *então* o app bloqueia com mensagem de
  sobreposição; *ao arrastar* a borda contra o loop vizinho, ela para no limite.

---

## 9. Questões em Aberto

> **Resolvidas:** **QA-02-01** — início/fim editáveis tanto **digitando** quanto
> **arrastando** na waveform (ambos); **QA-02-06** — loops **não** podem se
> sobrepor.

- **QA-02-02** — A **ordem** dos loops tem efeito funcional (ex.: "próximo loop" no
  Player segue essa ordem) ou é apenas organização visual?
- **QA-02-03** — Valor padrão de duração ao criar loop (30 s?) e regra de nome
  padrão.
- **QA-02-04** — **Autosave** ou salvar manual (botão "Salvar")? O protótipo mostra
  botão manual.
- **QA-02-05** — O nível de **zoom** deve ser lembrado por faixa?
- **QA-02-07** — As anotações ("Observações") são exibidas ao jogador na Sala, ou
  são só para o Mestre? *(Premissa: só Mestre.)*
- **QA-02-08** — Ao arrastar/digitar tempos, deve haver *snap* (ímã) a um grid
  (ex.: 0,1 s) ou a marcadores?
