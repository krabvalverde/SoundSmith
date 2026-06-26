# SDD 04 — Sala (Sessão Multiplayer Online)

- **Status:** Rascunho aprovável
- **Versão:** 1.0
- **Pré-requisitos:** SDD 00, 01, 02, 03 (todos)
- **Habilita:** — (módulo final)

---

## 1. Objetivo

Permitir que o Mestre **hospede uma sessão ao vivo** e que os jogadores **entrem
remotamente** e ouçam a trilha **sincronizada em tempo real**. O Mestre comanda a
reprodução (faixa, loop, play/pause/seek); cada jogador ouve o mesmo, na mesma
posição, ajustando apenas seu próprio volume.

> **Arquitetura (decisões de produto):** sem backend próprio. A máquina do Mestre é
> o **host** (servidor local). Jogadores conectam pelo **IP de uma VPN externa** +
> **código da sala**. Ao entrar, o jogador **baixa o áudio da campanha uma vez**
> (cache local) e, a partir daí, **só comandos de sincronização** trafegam.

## 2. Escopo

### Dentro do escopo
- **Dashboard / Sala** do Mestre: criar/encerrar sala, código, IP, contagem e
  lista de jogadores (status + latência), campanhas recentes.
- **Modo "Entrar em Sala"** (mesmo app) para jogadores: informar IP + código,
  digitar nome, baixar áudio, reproduzir sincronizado.
- **Servidor host** (controle + transferência de arquivos) e **cliente jogador**.
- **Protocolo de sincronização** (comandos + relógio + agendamento).
- Espelhamento do estado do Player (SDD 03) para todos os jogadores.

### Fora do escopo
- Configurar/instalar a VPN (responsabilidade do grupo; o app só usa o IP).
- Chat/voz entre participantes *(ver QA-04-08)*.
- Persistência de histórico de sessões.

---

## 3. Papéis

| Papel | Capacidades |
|-------|-------------|
| **Host (Mestre)** | Cria a sala, escolhe campanha, comanda reprodução (play/pause/seek/faixa/loop), vê jogadores e latência. |
| **Jogador (cliente)** | Entra com IP+código+nome, baixa o áudio, ouve sincronizado, ajusta **só o próprio volume**. Sem controle de reprodução. |

- **SALA-RN-01** — O Mestre é sempre o **host**; jogadores são clientes. Não há
  troca de host nesta versão.

---

## 4. Histórias de Usuário

- **US-04-01** — Como Mestre, quero criar uma sala e compartilhar o código/IP para
  meus jogadores entrarem e ouvirem a trilha junto comigo.
- **US-04-02** — Como jogador, quero entrar pelo código e ouvir exatamente o que o
  Mestre toca, no mesmo ponto, sem precisar dos arquivos de antemão.
- **US-04-03** — Como Mestre, quero ver quem está conectado, se já sincronizou e a
  latência de cada um.
- **US-04-04** — Como jogador, quero ajustar meu próprio volume sem afetar os
  outros.

---

## 5. UI / Telas

### 5.1 Dashboard / Sala — Mestre (`data-screen-label="Dashboard"`)
- Saudação ao Mestre + avatar.
- **Hero "Criar Nova Sala"** com badge "Sessão Multiplayer":
  - Estado **sem sala:** botão primário **Criar Sala** (torna-se host) e botão
    secundário **Entrar em Sala** (torna-se jogador — abre o fluxo da §5.2).
  - Estado **com sala (AO VIVO):** badge pulsante "AO VIVO", botão **Encerrar**, e
    *tiles* com **Código da Sala**, **IP da VPN**, **jogadores conectados (N/6)** e
    botão **Copiar Info**.
- **Campanhas Recentes** (3) + atalho "Ver todas".
- **Jogadores Conectados:** lista com avatar, nome, **status** (Sincronizado /
  Sincronizando… / Conectando…), **latência** (ms) e ponto de cor por estado.

### 5.2 Fluxo "Entrar em Sala" — Jogador

> Tela **nova**, não presente no design importado. Especificada abaixo seguindo o
> design system (SDD 00 §9): tema escuro `#0f0d11`/`#16131b`, fontes Manrope /
> Metamorphous / JetBrains Mono, ícones lucide e a cor de destaque do app. Há um
> mockup HTML de referência em
> [`design/entrar-na-sala.html`](./design/entrar-na-sala.html).

**Acesso:** botão **Entrar em Sala** no Dashboard sem sessão (§5.1). O jogador
permanece no **mesmo app** e assume o papel de cliente. O fluxo tem **três
estados**, num cartão central sobre *backdrop* desfocado (mesmo padrão do modal
"Nova Campanha"):

#### (A) Formulário de entrada
```
┌───────────────────────────────────────────────┐
│  SESSÃO MULTIPLAYER                        [×]  │
│  Entrar em Sala                                 │
│  Conecte-se à mesa do seu Mestre.               │
│                                                 │
│  CÓDIGO DA SALA                                 │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐                  │
│  │K │ │7 │ │P │ │2 │ │Q │ │9 │   6 caracteres   │
│  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘                  │
│                                                 │
│  IP DA VPN DO HOST                              │
│  ┌───────────────────────────────────────────┐ │
│  │ 10.84.0.1                                 │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  SEU NOME                                       │
│  ┌───────────────────────────────────────────┐ │
│  │ Thalíndra                                 │ │
│  └───────────────────────────────────────────┘ │
│                          [ Cancelar ] [ Entrar ]│
└───────────────────────────────────────────────┘
```
- **Código da Sala:** 6 caixas de um caractere (mono, `JetBrains Mono`), aceita só
  letras/números, **auto-maiúsculas**, foco avança ao digitar e colar distribui os
  6 caracteres.
- **IP da VPN do host:** campo de texto (placeholder `10.84.0.1`).
- **Seu Nome:** campo de texto; gera avatar (cor + iniciais) automaticamente.
- **Entrar:** habilitado apenas quando os 3 campos forem válidos.

#### (B) Conectando / Baixando a trilha
```
┌───────────────────────────────────────────────┐
│  Entrando na sala  K7P2Q9                       │
│                                                 │
│   ✓  Conectado ao host                          │
│   ◐  Baixando a trilha                    64 %  │
│      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░   15 / 24 faixas   │
│   ○  Sincronizando relógio                      │
│                                                 │
│   [capa]  "As Minas de Veridian" · 24 faixas    │
│                                    [ Cancelar ] │
└───────────────────────────────────────────────┘
```
- Etapas com ícones de status (✓ feito · ◐ em progresso · ○ pendente · ⚠ erro) e
  barra de progresso do download (faixas baixadas / total). **Cancelar** aborta e
  volta ao Dashboard.

#### (C) Em Sessão — Jogador (tela cheia)
```
 EM SESSÃO · JOGADOR              ● AO VIVO   Sala K7P2Q9   [ Sair ]
 ┌──────────────────────────────────────────────────────────────┐
 │  ┌────────┐   ● LOOP: COMBATE                                  │
 │  │   MV   │   Emboscada nas Minas                              │
 │  │ (capa) │   ▣ As Minas de Veridian                          │
 │  └────────┘   ▌▍▌▍▌  (equalizador)                            │
 │                                                                │
 │   ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░   2:14 / 6:20   (somente leitura)    │
 │                                                                │
 │   🔊 ───────────●──────────  72       VOLUME (somente você)    │
 └──────────────────────────────────────────────────────────────┘
```
- **Espelha** o estado do host: capa da campanha, nome da faixa, **badge do loop**
  ativo, equalizador animado e barra de progresso (somente leitura, acompanha o
  host em sincronia).
- **Único controle do jogador:** o **volume local** (não afeta ninguém).
- Cabeçalho: rótulo "EM SESSÃO · JOGADOR", badge "AO VIVO", código da sala e botão
  **Sair** (desconecta e volta ao Dashboard).
- **Sem** play/pause, *seek* ou troca de loop — são prerrogativas do Mestre.

- **SALA-RF-01** — O fluxo "Entrar em Sala" implementa os três estados acima
  (A formulário · B conexão/download · C sessão do jogador). *(Resolve QA-04-01.)*

---

## 6. Sincronização — Modelo Técnico

### 6.1 Transporte
- **SALA-RF-02** — O host abre **dois canais** ao criar a sala:
  1. **Canal de controle** (WebSocket, porta `host_port`, padrão `7842`) para
     comandos e relógio;
  2. **Canal de arquivos** (HTTP estático no host) para download dos áudios da
     campanha.
- **SALA-RF-03** — Jogadores conectam ao **IP da VPN do host** nessas portas e se
  autenticam com o **código da sala** *(+ nome)*.

### 6.2 Entrada e download (cache local)
- **SALA-RF-04** — Ao entrar, o cliente recebe o **manifesto da campanha** (faixas,
  durações, **loops**, hashes/tamanhos) e baixa **os arquivos ausentes de toda a
  campanha** do canal de arquivos para um **cache local**
  (`userData/room-cache/<campaign>/`). *(Resolve QA-04-04.)*
- **SALA-RN-02** — O cliente **reaproveita** arquivos já em cache (por hash); só
  baixa o que falta. O status do jogador é **"Sincronizando…"** durante o download
  e **"Conectando…"** antes disso.
- **SALA-RF-05** — A reprodução do jogador **só inicia** quando o áudio necessário
  está disponível localmente e o relógio está calibrado → status **"Sincronizado"**.

### 6.3 Relógio e latência
- **SALA-RF-06** — Cliente e host mantêm um **relógio compartilhado**: o cliente
  estima o *offset* e a **latência** por *ping/pong* periódico (estilo NTP simples).
- **SALA-RF-07** — A **latência exibida** ao Mestre é o RTT/2 mais recente de cada
  jogador (ou "—" se indisponível).

### 6.4 Comandos agendados
- **SALA-RN-03** — Todo comando de reprodução é **agendado** para um instante
  **T_alvo = agora_host + sync_buffer_ms** (padrão `120 ms`, configurável). Cada
  cliente converte T_alvo para seu relógio local e executa no mesmo momento → todos
  tocam em sincronia.
- **SALA-RF-08** — Comandos cobertos: `LOAD_TRACK`, `PLAY`, `PAUSE`, `SEEK`,
  `SET_LOOP`, `NEXT/PREV_LOOP`, `NEXT_TRACK` (autoplay), `END_SESSION`.
- **SALA-RN-04** — **Volume não é sincronizado**: cada jogador controla o seu
  localmente (decisão de produto #9). O comando de volume do Mestre afeta só a
  saída do host.

### 6.5 Transição de loop em sincronia
- **SALA-RN-05** — A regra de **"esperar o fim da região"** (SDD 03 §6) é calculada
  sobre a **linha de tempo compartilhada**: o host determina o instante exato do
  `end_ms` da região vigente e agenda o engate do novo loop nesse instante para
  **todos os clientes simultaneamente**, com os fades e o crossfade conforme
  configurado.
- **SALA-RF-09** — Jogadores que entram **no meio** de uma reprodução recebem o
  estado atual (faixa, loop ativo, posição projetada) e se **alinham** à linha de
  tempo em andamento.

### 6.6 Resiliência
- **SALA-RF-10** — Em **queda de conexão** do jogador, ele aparece como
  desconectado e, ao reconectar, **re-sincroniza** (re-alinha relógio, baixa o que
  faltar, alinha posição).
- **SALA-RF-11** — Em desvio de relógio (*drift*) acima de um limiar, o cliente
  faz **micro-ajuste** de posição (re-seek suave) para reconvergir. *(Limiar em
  QA-04-05.)*
- **SALA-RF-12** — Se o **host encerra** a sala, todos os clientes recebem
  `END_SESSION`, param e voltam à tela inicial.

---

## 7. Requisitos Funcionais — Host (Mestre)

- **SALA-RF-13** — **Criar Sala** gera um **código de 6 caracteres alfanuméricos**
  (A–Z e 0–9, maiúsculos; recomenda-se excluir caracteres ambíguos como `0/O` e
  `1/I` para facilitar a leitura — ex.: `K7P2Q9`), inicia os canais de controle e
  arquivos e marca a sessão como **AO VIVO**. *(Resolve QA-04-03.)*
- **SALA-RF-14** — O host exibe **código**, **IP da VPN** (interface escolhida em
  Configurações) e **N/6** jogadores conectados.
- **SALA-RF-15** — **Copiar Info** copia para a área de transferência um texto com
  **IP da VPN + código** para o Mestre compartilhar; o rótulo do botão vira
  "Copiado!" temporariamente.
- **SALA-RF-16** — A **campanha da sessão** é a campanha ativa no Player; o Mestre
  comanda a reprodução pela tela **Player** (SDD 03), que passa a refletir/emitir
  para a sala quando AO VIVO.
- **SALA-RF-17** — O Mestre vê a **lista de jogadores** com nome, avatar gerado,
  status e latência, atualizada em tempo real.
- **SALA-RF-18** — **Encerrar** fecha a sala, desconecta todos e libera as portas.
- **SALA-RF-24** — No Dashboard **sem sessão ativa**, são oferecidas duas ações:
  **Criar Sala** (tornar-se host) e **Entrar em Sala** (tornar-se jogador, §5.2).
- **SALA-RN-06** — **Limite de 6 jogadores** simultâneos (do protótipo
  "N / 6"); entradas além do limite são recusadas com mensagem. *(Configurável em
  `room_config.max_players`; ver QA-04-06.)*
- **SALA-RN-08** — A sala é protegida **apenas pelo código** (sem senha — decisão
  de produto). Para conectar, o jogador fornece **IP da VPN do host + código + seu
  nome**. O código é **único entre salas ativas** e **renovado a cada nova sala**.
  *(Resolve QA-04-02.)*

## 8. Requisitos Funcionais — Jogador (cliente)

- **SALA-RF-19** — O jogador entra informando **IP da VPN + código + nome**.
- **SALA-RN-07** — O **nome é digitado ao entrar**; **cor e iniciais do avatar são
  geradas automaticamente** a partir do nome (decisão de produto #12).
- **SALA-RF-20** — Após entrar, o cliente **baixa toda a campanha** (todas as
  faixas ausentes do cache), com progresso, e então reproduz **sincronizado**.
- **SALA-RF-21** — O jogador ajusta **apenas o próprio volume**; não vê nem usa
  controles de transporte.
- **SALA-RF-22** — O cliente mostra o que está tocando (faixa/loop) espelhado do
  host.

---

## 9. Protocolo (esboço de mensagens)

Mensagens JSON no canal de controle (nomes ilustrativos; formato final a definir):

```jsonc
// cliente → host
{ "type": "JOIN",  "code": "K7P2Q9", "name": "Thalíndra", "have": ["<hash>", ...] }
{ "type": "PONG",  "t1": 123, "t2": 456 }                 // sync de relógio
{ "type": "READY" }                                       // áudio baixado/ok

// host → cliente
{ "type": "WELCOME", "manifest": { /* faixas, loops, hashes, tamanhos */ },
  "fileBaseUrl": "http://10.84.0.1:7842/files/" }
{ "type": "PING",  "t1": 123 }
{ "type": "CMD", "cmd": "SET_LOOP", "loopId": 42, "atHostTime": 99999,
  "crossfade": true }                                     // comando agendado
{ "type": "STATE", /* faixa, loop ativo, posição projetada, tocando */ }
{ "type": "PLAYERS", "list": [ /* nome, status, latência */ ] }
{ "type": "END_SESSION" }
```

- **SALA-RF-23** — O **manifesto** inclui tudo que o cliente precisa para tocar e
  exibir loops sem acesso ao SQLite do host (faixas, durações, loops com
  start/end/fades/cor/nome).

---

## 10. Dados (tabelas envolvidas)

- Host: `campaigns`, `tracks`, `loops` (leitura, para montar manifesto e servir
  arquivos); `room_config` (código/limite).
- **Estado de sessão e jogadores é runtime** (memória) — não persistido.
- Cliente: cache em `userData/room-cache/` (não no SQLite, ou índice leve do
  cache; *ver QA-04-07*).

---

## 11. Critérios de Aceitação

- **SALA-CA-01** — *Quando* o Mestre clica em "Criar Sala", *então* surge a badge
  "AO VIVO", um código e o IP da VPN, e o app passa a aceitar conexões na porta
  configurada.
- **SALA-CA-02** — *Dado* IP+código corretos, *quando* um jogador entra e digita o
  nome, *então* ele aparece na lista do Mestre como "Conectando…" → "Sincronizando…"
  → "Sincronizado", com avatar e latência.
- **SALA-CA-03** — *Dado* dois jogadores sincronizados, *quando* o Mestre dá play,
  *então* ambos começam a ouvir praticamente no mesmo instante (dentro da margem do
  `sync_buffer_ms`).
- **SALA-CA-04** — *Dado* uma faixa tocando em "Exploração", *quando* o Mestre
  seleciona "Combate", *então* todos os jogadores engatam "Combate"
  **simultaneamente** ao fim da região, com os fades.
- **SALA-CA-05** — *Quando* um jogador ajusta seu volume, *então* só o áudio dele
  muda; os demais e o host não são afetados.
- **SALA-CA-06** — *Dado* 6 jogadores conectados, *quando* um 7º tenta entrar,
  *então* a entrada é recusada com mensagem de sala cheia.
- **SALA-CA-07** — *Quando* o jogador já tem o áudio em cache, *então* ele entra sem
  baixar de novo e fica "Sincronizado" rapidamente.
- **SALA-CA-08** — *Quando* o Mestre encerra a sala, *então* todos os jogadores são
  desconectados e retornam à tela inicial.

---

## 12. Questões em Aberto

> **Resolvidas:** **QA-04-01** — tela "Entrar em Sala" especificada (§5.2), acesso
> pelo botão **Entrar em Sala** no Dashboard; **QA-04-02** — **sem senha** (apenas
> o código); **QA-04-03** — código de **6 caracteres alfanuméricos**, único entre
> salas ativas e renovado a cada nova sala; **QA-04-04** — baixa a **campanha
> inteira** ao entrar.

- **QA-04-05** — Margem aceitável de dessincronização e **limiar de re-seek** para
  correção de *drift*.
- **QA-04-06** — Limite de 6 jogadores é **fixo** ou configurável pelo Mestre?
- **QA-04-07** — Política do **cache do jogador**: tamanho máximo, expiração,
  limpeza manual?
- **QA-04-08** — Recursos sociais (chat/voz/reações) estão fora desta versão?
  *(Premissa: sim, fora.)*
- **QA-04-09** — Quando **não há sala ativa**, o Dashboard ainda mostra "Campanhas
  Recentes" e oculta os *tiles*/lista de jogadores? *(Premissa: sim, conforme o
  protótipo.)*
- **QA-04-10** — Comportamento se a **VPN cair** no meio da sessão (host perde o
  IP): pausar e aguardar reconexão?
