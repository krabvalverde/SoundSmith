# SDD 05 — Correções (Shell, Identidade e Player)

- **Status:** Rascunho aprovável
- **Versão:** 1.0
- **Pré-requisitos:** SDD 00 (Fundação), SDD 03 (Player)
- **Habilita:** — (correções de qualidade sobre módulos já entregues)

---

## 1. Objetivo

Corrigir quatro defeitos observados após a entrega dos módulos 00–04:

1. A tela **Configurações** não está centralizada horizontalmente.
2. O app exibe o **menu padrão do Electron** (File/Edit/View/Window/Help) abaixo
   da barra de título do Windows — deve ser removido.
3. O app se apresenta como **"Electron"/"app"** (barra de título, build) — deve
   se chamar **"SoundSmith"** em todos os pontos visíveis.
4. O **Player** tem defeitos de reprodução: o botão play não produz som (o áudio
   só inicia ao arrastar a barra de progresso) e a barra de progresso não
   acompanha a região do loop ativo.

Este documento é corretivo: não adiciona funcionalidade nova, apenas faz os
requisitos já especificados (SDD 00 e SDD 03) valerem de fato.

## 2. Escopo

### Dentro do escopo
- CSS de centralização da tela Configurações.
- Remoção do menu de aplicação no processo main.
- Nome do produto: título da janela, metadados de build (`electron-builder`),
  `package.json`.
- Motor de áudio (`AudioEngine`): retomada do `AudioContext` no play e cálculo
  de posição com *wrap* dentro da região de loop.

### Fora do escopo
- Barra de título customizada (*frameless window*) — a barra nativa do Windows
  permanece.
- Qualquer mudança de comportamento do Player além do especificado no SDD 03
  (este documento não altera regras de negócio, só as faz funcionar).
- Ícone do aplicativo e identidade visual do instalador (podem virar spec
  futura).

---

## 3. Diagnóstico (causas-raiz)

| # | Sintoma | Causa | Local |
|---|---------|-------|-------|
| D1 | Configurações alinhada à esquerda | `.config-screen` tem `max-width: 700px` mas não tem `margin: 0 auto`; como o próprio elemento é o contêiner de rolagem (`height: 100%; overflow-y: auto`), a coluna fica presa à esquerda | `src/renderer/src/screens/Configuracoes.css:2-5` |
| D2 | Menu File/Edit/View… visível | O menu de aplicação padrão do Electron nunca é removido; `createWindow()` não configura `autoHideMenuBar` nem há `Menu.setApplicationMenu(null)` | `src/main/index.ts:6-29` |
| D3 | App chama-se "Electron"/"app" | `<title>Electron</title>` no HTML do renderer define o título da janela; `productName: app`, `appId: com.electron.app` e `executableName: app` no builder definem o nome do binário/atalhos | `src/renderer/index.html:5`, `electron-builder.yml:1-2,15` |
| D4 | Play não toca; seek toca | `pause()` chama `ctx.suspend()`, mas `play()` inicia o `AudioBufferSourceNode` sem retomar o contexto — o relógio fica congelado e não há som. Só `seek()` trata o estado `suspended` (chama `ctx.resume()`), por isso arrastar a barra "destrava" o áudio. Toda faixa carregada sem autoplay passa por `play()+pause()`, deixando o contexto suspenso | `src/renderer/src/audio/AudioEngine.ts:139-145` (suspend), `92-137` (play sem resume), `77-85` (seek com resume) |
| D5 | Barra de progresso ignora o loop ativo | A posição é derivada linearmente (`ctx.currentTime - _startTime`). Quando o source está em loop de região (`loopStart`/`loopEnd`), o áudio volta ao início da região mas a posição reportada continua crescendo além de `end_ms` | `src/renderer/src/audio/AudioEngine.ts:225-227` |
| D6 | Troca de loop agendada quebra após a 1ª volta | Consequência de D5: `scheduleLoopChange()` calcula `remaining = end_ms − posição` com a posição linear; depois que o loop deu uma volta, `remaining ≤ 0` e a troca ocorre **imediatamente**, violando PLAY-RN-01 ("esperar o fim da região") | `src/renderer/src/audio/AudioEngine.ts:172-175` |

---

## 4. Requisitos Funcionais

### A — Configurações centralizada
- **COR-RF-01** — O conteúdo da tela Configurações (coluna de `max-width`
  700px) aparece **centralizado horizontalmente** na área útil da tela, em
  qualquer largura de janela ≥ mínimo (1100px). A rolagem vertical continua
  funcionando e a barra de rolagem permanece na borda direita da área útil
  (não colada na coluna de 700px).

### B — Remoção do menu de aplicação
- **COR-RF-02** — A janela **não exibe** o menu de aplicação (File/Edit/View/
  Window/Help) abaixo da barra de título, nem o revela pela tecla `Alt`.
  A barra de título nativa do Windows (minimizar/maximizar/fechar) permanece.
- **COR-RF-03** — Em **desenvolvimento** (`npm run dev`), os atalhos de
  desenvolvedor continuam funcionando mesmo sem menu: `F12`/`Ctrl+Shift+I`
  (DevTools) e `Ctrl+R` (reload). Em **produção**, esses atalhos ficam
  desabilitados (comportamento padrão do `@electron-toolkit/utils`
  `optimizer.watchWindowShortcuts`).

### C — Nome do produto: "SoundSmith"
- **COR-RF-04** — A **barra de título** da janela e a **barra de tarefas** do
  Windows exibem **"SoundSmith"** (título do documento HTML do renderer; nenhuma
  tela sobrescreve `document.title`).
- **COR-RF-05** — Os metadados de build identificam o produto como SoundSmith:
  - `electron-builder.yml`: `productName: SoundSmith`,
    `appId: com.soundsmith.app`, `win.executableName: SoundSmith`
    (atalhos e desinstalador herdam via `${productName}`);
  - `package.json`: `description` e `author` deixam de ser os valores do
    template (`description: "Trilhas sonoras dinâmicas e sincronizadas para
    mesas de RPG"`; `name` já é `soundsmith` e **não muda** — preserva o
    caminho de `userData` e o banco existente).

### D — Player: reprodução

- **COR-RF-06** — O botão **play/pause** funciona a partir de **qualquer
  estado**: primeira faixa carregada (paused), após pause manual, após troca de
  faixa e após seek. Apertar play produz áudio imediatamente, sem exigir
  interação com a barra de progresso (restaura PLAY-RF-01).
- **COR-RF-07** — Com um **loop nomeado** ativo, a barra de progresso e o tempo
  `atual` **acompanham a região**: avançam de `start_ms` até `end_ms` e
  **retornam a `start_ms`** a cada volta, indefinidamente (restaura
  PLAY-RF-02 no contexto de PLAY-RF-06).
- **COR-RF-08** — Com **"Faixa em Loop"** ativo, a posição exibida retorna a
  `0:00` ao fim da faixa a cada volta (mesma regra de *wrap*, região =
  faixa inteira).

## 5. Regras de Negócio

- **COR-RN-01** — O motor de áudio **nunca** inicia um source com o
  `AudioContext` em estado `suspended`: toda entrada de reprodução
  (`play`, `resume`, `seek` com reprodução ativa) garante `ctx.resume()`
  antes de (ou junto com) o `node.start()`.
- **COR-RN-02** — A **posição reportada** (`getState().positionMs`) é derivada
  com *wrap* sobre a região ativa:
  - loop nomeado `[start, end)`: enquanto o tempo linear decorrido for menor
    que `end`, posição = tempo linear; depois,
    `posição = start + ((linear − start) mod (end − start))`;
  - "Faixa em Loop": `posição = linear mod duração`;
  - "Sem Loop": posição = linear (limitada à duração).
- **COR-RN-03** — `scheduleLoopChange()` calcula o tempo restante até o fim da
  região (`remaining`) usando a **posição com wrap** (COR-RN-02), de modo que a
  troca agendada espere o fim do **ciclo corrente** da região, em qualquer
  volta do loop — não apenas na primeira (preserva PLAY-RN-01/02/03).
- **COR-RN-04** — O cálculo de posição com *wrap* deve ser implementado como
  **função pura exportada** (entradas: tempo linear, modo de loop, duração),
  coberta por testes unitários (vitest), pois o defeito D5/D6 não é detectável
  por typecheck.

---

## 6. Critérios de Aceitação

- **COR-CA-01** — *Dado* o app aberto em janela ≥ 1100px, *quando* navego para
  Configurações, *então* a coluna de conteúdo aparece centralizada, com margens
  laterais visualmente iguais.
- **COR-CA-02** — *Dado* o app aberto (dev ou produção), *então* não há menu
  File/Edit/View abaixo da barra de título, e pressionar `Alt` não o revela.
- **COR-CA-03** — *Dado* o app rodando via `npm run dev`, *quando* pressiono
  `F12`, *então* o DevTools abre.
- **COR-CA-04** — *Dado* o app aberto, *então* a barra de título e a barra de
  tarefas mostram "SoundSmith" (não "Electron").
- **COR-CA-05** — *Dado* um build (`npm run build:win`), *então* o executável,
  o atalho e o desinstalador usam o nome "SoundSmith".
- **COR-CA-06** — *Dado* uma campanha selecionada no Player com a faixa
  carregada em pausa, *quando* clico em play, *então* o áudio começa a tocar e
  a barra de progresso avança — **sem** tocar na barra de progresso antes.
- **COR-CA-07** — *Dado* a faixa tocando, *quando* pauso e dou play novamente,
  *então* a reprodução retoma da mesma posição, com áudio.
- **COR-CA-08** — *Dado* um loop nomeado ativo (ex.: 0:30–1:00), *então* a
  barra de progresso oscila entre 0:30 e 1:00, voltando a 0:30 a cada volta,
  e o tempo `atual` idem.
- **COR-CA-09** — *Dado* um loop nomeado tocando há **mais de um ciclo**,
  *quando* seleciono outro loop, *então* a troca ainda é **agendada** para o
  fim do ciclo corrente (indicação de pendente + fades), e não imediata.
- **COR-CA-10** — *Dado* "Faixa em Loop" ativo, *quando* a faixa chega ao fim,
  *então* ela recomeça e a barra volta a `0:00` (sem avançar de faixa).

---

## 7. Verificação

```bash
npm run typecheck   # deve passar limpo
npx vitest run      # testes da função de posição com wrap (COR-RN-04)
npm run dev         # verificação manual: CA-01..04, CA-06..10
npm run build:win   # verificação de CA-05 (nome do executável/atalhos)
```

Roteiro manual mínimo (dev):
1. Abrir Configurações → coluna centralizada (CA-01).
2. Conferir ausência de menu + `Alt` (CA-02) e `F12` abrindo DevTools (CA-03).
3. Título da janela = "SoundSmith" (CA-04).
4. Player: carregar campanha, **não** tocar na barra, clicar play → som
   (CA-06); pausar/retomar (CA-07).
5. Ativar loop nomeado → barra oscilando dentro da região (CA-08); esperar 2+
   voltas e trocar de loop → troca agendada, não imediata (CA-09).
6. "Faixa em Loop" → barra volta a 0:00 no fim da faixa (CA-10).

---

## 8. Questões em Aberto

- **QA-05-01** — Ao centralizar Configurações, aproveitar para definir um
  contêiner de página padrão (ex.: `.screen-column`) reutilizável pelas demais
  telas, ou manter a correção local ao CSS de Configurações? *(Sugestão:
  correção local; padronização fica para uma spec de refatoração visual.)*
- **QA-05-02** — `win.executableName`: usar `SoundSmith` (com maiúsculas) ou
  `soundsmith` (minúsculas, alinhado ao `name` do npm)? Afeta apenas o nome do
  `.exe` gerado. *(Sugestão: `SoundSmith`, é o nome voltado ao usuário.)*
- **QA-05-03** — O ícone do executável/janela ainda é o padrão do Electron.
  Tratar nesta correção ou em spec própria de identidade visual? *(Sugestão:
  spec própria; exige assets.)*
