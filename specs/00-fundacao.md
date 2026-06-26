# SDD 00 — Fundação (App Shell, Perfil, Configurações, Banco e Design System)

- **Status:** Rascunho aprovável
- **Versão:** 1.0
- **Pré-requisitos:** nenhum
- **Habilita:** Campanhas, Estúdio, Player, Sala

---

## 1. Objetivo

Estabelecer a base técnica e de experiência compartilhada por todos os módulos:
a janela Electron, a navegação, o perfil local do Mestre, a tela de
Configurações, o esquema SQLite completo, o motor de áudio e o design system.

## 2. Escopo

### Dentro do escopo
- Estrutura do app Electron (processo principal, *preload*, *renderer*).
- Navegação entre as 5 telas (Sala, Player, Campanhas, Estúdio, Configurações).
- Perfil local único do Mestre (criação na 1ª execução).
- Tela de Configurações (Áudio, Rede, VPN, Tema, Bibliotecas, Sobre).
- Esquema e migrações do SQLite.
- Motor de áudio compartilhado (Web Audio API).
- Design system (tokens de cor, tipografia, componentes base).

### Fora do escopo
- Lógica específica de cada módulo (descrita nos SDDs 01–04).
- Qualquer autenticação remota / contas.

---

## 3. Arquitetura técnica

### 3.1 Processos Electron

| Processo | Responsabilidade |
|----------|------------------|
| **Main** | Ciclo de vida da janela, acesso ao sistema de arquivos, SQLite (`better-sqlite3`), servidor/cliente de rede da Sala (SDD 04), seleção de dispositivos, diálogos nativos. |
| **Preload** | Ponte segura (`contextBridge`) expondo uma API tipada (`window.soundsmith.*`) ao renderer. `nodeIntegration` desligado, `contextIsolation` ligado. |
| **Renderer** | UI (telas) e **motor de áudio** via Web Audio API. Toda manipulação de áudio (decode, ganho, fades, loop) roda aqui. |

- **RF-00-01** — Toda comunicação renderer↔main passa pelo `preload` via IPC; o
  renderer não acessa `fs`, `net` nem o SQLite diretamente.
- **RF-00-02** — O app abre em janela única redimensionável, tamanho mínimo
  `1100×720`, tema escuro fixo (ver Design System).
- **RF-00-03** — O banco SQLite e a biblioteca de áudio residem no diretório de
  dados do usuário do Electron (`app.getPath('userData')`), em
  `userData/soundsmith.db` e `userData/library/`.

### 3.2 Stack sugerida (não normativa)

Electron + (framework de UI à escolha da implementação) · `better-sqlite3` ·
Web Audio API · `ws` (servidor/cliente de sincronização, SDD 04) · servidor HTTP
estático embutido para transferência de arquivos (SDD 04). A escolha do framework
de UI é livre desde que respeite o design system.

---

## 4. Navegação (App Shell)

A navegação é uma **barra lateral à direita** (rail de 94 px) com itens, na ordem
de cima para baixo:

| Rótulo (UI) | Ícone (lucide) | Tela | Documento |
|-------------|----------------|------|-----------|
| **Sala** | `house` | Dashboard / Sessão | SDD 04 |
| **Player** | `circle-play` | Reprodução | SDD 03 |
| **Campanhas** | `library` | Biblioteca | SDD 01 |
| **Estúdio** | `waypoints` | Editor de trilha | SDD 02 |
| **Config** | `settings` (rodapé do rail) | Configurações | este doc |

- **RF-00-04** — Há sempre exatamente uma tela ativa; o item ativo recebe destaque
  (glow + borda na cor de destaque).
- **RF-00-05** — A tela inicial padrão ao abrir o app é **Sala** (Dashboard).
- **RN-00-01** — Trocar de tela **não interrompe** a reprodução de áudio em curso
  (o motor de áudio é independente da tela visível).

---

## 5. Perfil do Mestre

- **RN-00-02** — Existe **um único perfil local** por instalação. Não há login,
  conta nem servidor de autenticação.
- **RF-00-06** — Na **primeira execução** (quando não há perfil no banco), o app
  solicita o **nome do Mestre**. As **iniciais** (até 2 letras) e uma **cor de
  avatar** são geradas automaticamente a partir do nome.
- **RF-00-07** — O nome e o avatar do Mestre aparecem no cabeçalho da Sala
  ("Bom jogo, Mestre &lt;nome&gt;") e no canto superior direito.
- **RF-00-08** — O Mestre pode editar seu nome em Configurações; iniciais e cor
  são recalculadas.
- **QA-00-01** — O Mestre pode escolher manualmente a cor do avatar, ou é sempre
  derivada do nome? *(Premissa atual: derivada; ajustável se desejado.)*

---

## 6. Configurações

Tela única e rolável (`data-screen-label="Configuracoes"`), dividida em seções.
Todos os valores são persistidos (tabela `app_settings`).

### 6.1 Áudio
- **RF-00-09** — **Dispositivo de Saída:** lista os dispositivos de saída de áudio
  do sistema; a seleção redireciona a reprodução para o dispositivo escolhido
  (via `setSinkId`/Web Audio). **Funcional nesta versão.**
- **RF-00-10** — **Taxa de Amostragem:** exibida apenas como **informação**
  (somente leitura nesta versão); reflete a taxa do dispositivo/contexto de áudio.
- **RF-00-11** — **Crossfade entre loops:** *toggle* booleano. Quando ligado,
  trocas de loop usam crossfade; quando desligado, corte seco. (Comportamento
  detalhado no SDD 02/03.)

### 6.2 Rede
- **RF-00-12** — Exibe e permite editar a **Porta do Host** (padrão `7842`).
- **RF-00-13** — Exibe o **Modo** atual ("Host (Servidor)" quando há sala ativa).
- **RF-00-14** — **Buffer de Sync** (ms, padrão `120`): tempo de antecedência
  aplicado aos comandos agendados para os jogadores (ver SDD 04). Editável.

### 6.3 VPN
> Como a VPN é **externa** (decisão de produto #3), o app **não gerencia** a VPN —
> apenas **detecta e exibe** informações da interface de rede para facilitar o
> compartilhamento da sala.
- **RF-00-15** — Exibe **Status** (Conectado/Desconectado) e o **IP** da interface
  de rede usada para hospedar (o "IP da VPN"). O usuário pode selecionar qual
  interface/IP usar quando houver mais de uma.
- **RF-00-16** — O campo "Provedor" é informativo/editável (rótulo livre, ex.:
  nome da VPN do grupo). O texto "SoundSmith Relay" do protótipo é apenas
  *placeholder* visual.
- **QA-00-02** — Confirmar se a detecção automática de IP é suficiente ou se o
  Mestre deve poder digitar um IP manualmente (ex.: NAT/encaminhamento).

### 6.4 Tema Visual
- **RF-00-17** — **Cor de Destaque:** seleção entre as cores predefinidas
  (`#8b5cf6` roxo [padrão], `#3b82f6`, `#10b981`, `#f59e0b`, `#ec4899`). Aplica-se
  a botões, seleções e destaques em todo o app; persistida.

### 6.5 Bibliotecas de Músicas
- **RF-00-18** — Lista de **pastas-fonte** que o Mestre adiciona para procurar
  áudios ao importar (mostra caminho e contagem de arquivos de áudio).
- **RN-00-03** — Essas pastas são **apenas fontes de navegação** para importação.
  Elas **não** são a biblioteca interna; ao importar, os arquivos são copiados
  para `userData/library/` (ver SDD 01).
- **RF-00-19** — O Mestre pode adicionar e remover pastas-fonte.

### 6.6 Sobre
- **RF-00-20** — Exibe nome do app, versão e build. Botão "Verificar
  Atualizações" pode ser *placeholder* nesta versão.
- **QA-00-03** — Atualização automática está no escopo? *(Premissa: não nesta
  versão.)*

---

## 7. Esquema SQLite (completo)

O esquema abaixo é a fonte única de verdade do modelo de dados; cada módulo
referencia as tabelas que lhe dizem respeito. Modelo **por campanha (isolado)**.

```sql
-- Perfil local único do Mestre
CREATE TABLE profile (
  id            INTEGER PRIMARY KEY CHECK (id = 1),  -- linha única
  name          TEXT NOT NULL,
  initials      TEXT NOT NULL,
  avatar_color  TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Configurações chave/valor
CREATE TABLE app_settings (
  key    TEXT PRIMARY KEY,   -- ex.: 'accent_color', 'output_device_id',
  value  TEXT                --     'crossfade_loops', 'host_port',
);                           --     'sync_buffer_ms', 'vpn_provider', 'vpn_ip'

-- Pastas-fonte para importação (Configurações > Bibliotecas)
CREATE TABLE library_paths (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  path      TEXT NOT NULL UNIQUE,
  added_at  TEXT NOT NULL
);

-- Campanhas
CREATE TABLE campaigns (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  initials    TEXT NOT NULL,        -- derivado do nome
  color_base  TEXT NOT NULL,        -- cor de fundo da capa
  color_glow  TEXT NOT NULL,        -- cor do brilho radial da capa
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- Faixas (pertencem a uma campanha; arquivo já copiado p/ library/)
CREATE TABLE tracks (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id       INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,           -- editável; inicia do nome do arquivo
  file_path         TEXT NOT NULL,           -- relativo a userData/library/
  original_filename TEXT NOT NULL,
  format            TEXT NOT NULL,           -- mp3 | wav | flac | ogg | m4a | aac
  duration_ms       INTEGER,                 -- extraído na importação
  file_size_bytes   INTEGER,
  sample_rate       INTEGER,
  channels          INTEGER,
  waveform_peaks    BLOB,                    -- picos pré-calculados p/ Estúdio
  order_index       INTEGER NOT NULL DEFAULT 0,
  import_status     TEXT NOT NULL DEFAULT 'ready', -- pending|ready|error
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

-- Loops (regiões nomeadas dentro de uma faixa)
CREATE TABLE loops (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id     INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  color        TEXT NOT NULL,
  start_ms     INTEGER NOT NULL,
  end_ms       INTEGER NOT NULL,
  fade_in_ms   INTEGER NOT NULL DEFAULT 0,
  fade_out_ms  INTEGER NOT NULL DEFAULT 0,
  notes        TEXT,
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  CHECK (end_ms > start_ms)
);

-- (Opcional) Configuração de sala persistida entre sessões
CREATE TABLE room_config (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  last_code     TEXT,
  max_players   INTEGER NOT NULL DEFAULT 6,
  updated_at    TEXT
);
```

- **RF-00-21** — As migrações são versionadas; o app aplica migrações pendentes na
  inicialização (`PRAGMA user_version`).
- **RF-00-22** — `PRAGMA foreign_keys = ON` em toda conexão (CASCADE em
  `tracks`/`loops`).

> **Sala/jogadores são estado de runtime** (em memória durante a sessão) e **não**
> são persistidos, exceto `room_config`. Detalhes no SDD 04.

---

## 8. Motor de Áudio (compartilhado)

O motor vive no renderer e é usado pelo Estúdio, Player e Sala.

- **RF-00-23** — Usa **Web Audio API**: cada faixa é decodificada em buffer; o
  grafo inclui um `GainNode` mestre (volume) e ganhos auxiliares para fades.
- **RF-00-24** — Suporta **reprodução com loop de região** (repetir `[start_ms,
  end_ms)`), **loop de faixa inteira** e **reprodução única** (sem loop).
- **RN-00-04** — **Transição entre loops:** ao selecionar um novo loop durante a
  reprodução, o motor **conclui a região atual até `end_ms`** e só então engata o
  novo loop, aplicando `fade_out` do atual e `fade_in` do novo. O *toggle*
  "Crossfade entre loops" (RF-00-11) controla se há sobreposição (crossfade) ou
  corte com fades sequenciais. (Regras completas no SDD 03.)
- **RF-00-25** — Expõe estado consultável: faixa atual, posição (ms), duração,
  estado (tocando/pausado), loop ativo, volume. Esse estado alimenta a UI e a
  sincronização da Sala.
- **RF-00-26** — Formatos suportados: **MP3, WAV, FLAC, OGG** (e, quando o
  decodificador suportar, M4A/AAC).

---

## 9. Design System

### 9.1 Tokens
- **Fundo base:** `#0f0d11`; superfícies `#16131b` / `#16161b` / `#121217`.
- **Texto:** primário `#ECECEF`; secundário `#a6a6b2`/`#9a9aa6`; terciário
  `#7a7a86`/`#6a6a76`.
- **Cor de destaque:** variável (padrão `#8b5cf6`), com versões alfa derivadas.
- **Estados:** sucesso `#22c55e`/`#86efac`; atenção `#f59e0b`/`#fcd34d`;
  erro `#f87171`/`#fca5a5`.
- **Cores de loop (paleta):** teal `#2dd4bf`, azul `#60a5fa`, vermelho `#f87171`,
  roxo `#a78bfa`, magenta `#e879f9`, âmbar `#fbbf24`.
- **Bordas/raios:** bordas `rgba(255,255,255,0.06–0.10)`; raios 10–22 px.
- **Textura:** leve ruído (noise) sobre o fundo; *scrollbars* finas customizadas.

### 9.2 Tipografia
- **Títulos display:** `Metamorphous` (serifada temática).
- **UI/corpo:** `Manrope`.
- **Monoespaçada (tempos, IPs, códigos):** `JetBrains Mono`.

### 9.3 Componentes base
Botões (primário em cor de destaque, secundário contornado, *ghost*), *cards* de
superfície, *dropdowns*/menus flutuantes com *overlay* de fechamento, *modais*,
*chips*/badges de status (com ponto pulsante para "ao vivo"/online), *sliders*
(range) e o componente de **capa de campanha** (gradiente radial `color_glow`
sobre `color_base` + iniciais em `Metamorphous`).

- **RF-00-27** — Iconografia: biblioteca **lucide**.
- **RN-00-05** — A **capa** de campanha/faixa é sempre gerada (iniciais +
  gradiente derivado de `color_base`/`color_glow`); não há upload de imagem nesta
  versão.

---

## 10. Critérios de Aceitação

- **CA-00-01** — *Dado* um app recém-instalado (sem perfil), *quando* o Mestre
  abre o app, *então* é solicitado o nome e, ao confirmar, o perfil é criado e a
  Sala é exibida saudando o Mestre pelo nome.
- **CA-00-02** — *Dado* o app aberto, *quando* o Mestre clica em cada item do rail,
  *então* a tela correspondente é exibida e o item fica destacado, sem
  interromper áudio em reprodução.
- **CA-00-03** — *Dado* que o Mestre escolhe uma cor de destaque diferente em
  Configurações, *quando* navega pelo app, *então* botões e seleções refletem a
  nova cor e a escolha persiste após reabrir o app.
- **CA-00-04** — *Dado* dois dispositivos de saída, *quando* o Mestre seleciona
  outro dispositivo, *então* o áudio passa a sair pelo dispositivo escolhido.
- **CA-00-05** — *Dado* o banco em versão antiga, *quando* o app inicia, *então*
  as migrações pendentes são aplicadas sem perda de dados.

---

## 11. Questões em Aberto
- **QA-00-01** — Cor do avatar do Mestre: derivada ou escolhível?
- **QA-00-02** — Detecção automática de IP da VPN é suficiente, ou permitir IP
  manual?
- **QA-00-03** — "Verificar Atualizações" deve ser funcional nesta versão?
