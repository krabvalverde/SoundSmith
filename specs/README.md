# SoundSmith — Especificações SDD

**SoundSmith** é um aplicativo **desktop (Electron)** para Mestres de RPG tocarem
trilhas sonoras dinâmicas e **sincronizadas em tempo real** com seus jogadores.
A persistência é local em **SQLite**. Não há backend próprio: a sincronização
multiplayer acontece máquina-a-máquina sobre uma **VPN externa** que o grupo já
utiliza (Hamachi, ZeroTier, Tailscale, etc.).

Estas especificações seguem **Spec Driven Development (SDD)**: cada documento
descreve *o quê* e *as regras*, com requisitos numerados e critérios de aceitação
verificáveis, antes da implementação.

## Fonte de design

O design visual de referência foi importado do projeto Claude Design
`bd9f4c93-17c7-4585-9a3e-6923eeaf7b14` (arquivo `SoundSmith.dc.html`). Todas as
telas, cores, tipografia e componentes descritos aqui derivam desse protótipo.

## Ordem de construção

O projeto é construído em partes, nesta ordem:

| # | Módulo | Documento | Depende de |
|---|--------|-----------|------------|
| 0 | Fundação (shell, perfil, configurações, banco, design system) | [`00-fundacao.md`](./00-fundacao.md) | — |
| 1 | **Campanhas** | [`01-campanhas.md`](./01-campanhas.md) | Fundação |
| 2 | **Estúdio** | [`02-estudio.md`](./02-estudio.md) | Campanhas |
| 3 | **Player** | [`03-player.md`](./03-player.md) | Campanhas, Estúdio |
| 4 | **Sala** (multiplayer online) | [`04-sala.md`](./04-sala.md) | Player |
| 5 | **Correções** (shell, identidade, player) | [`05-correcoes.md`](./05-correcoes.md) | Fundação, Player |
| 6 | **Identidade Visual** ("A Forja") | [`06-identidade-visual.md`](./06-identidade-visual.md) | Fundação, telas 01–04 |

> A **Fundação (0)** não é uma "parte" pedida explicitamente, mas reúne os
> elementos transversais (navegação, perfil do Mestre, Configurações, esquema
> SQLite, design system) sem os quais as quatro partes não se sustentam. Ela é
> implementada junto com / imediatamente antes de **Campanhas**.

## Decisões de produto registradas

As decisões abaixo foram confirmadas com o cliente e são premissas firmes de
todos os documentos:

1. **Plataforma:** Electron, somente desktop. Sem versão web/mobile.
2. **Banco:** SQLite local (uma instalação = um Mestre).
3. **Rede:** Host roda servidor local (porta padrão `:7842`); jogadores conectam
   pelo **IP da VPN externa** + **código da sala**. Sem relay/servidor próprio.
4. **Sincronização:** jogadores **baixam o áudio da campanha uma vez** (cache
   local) ao entrar na sala; depois trafegam **apenas comandos de sincronização**.
5. **Cliente do jogador:** o **mesmo app** SoundSmith, em modo "Entrar em Sala".
6. **Importação de áudio:** arquivos são **copiados** para a biblioteca gerenciada
   pelo app; a campanha fica autocontida.
7. **Modelo de dados:** **por campanha (isolado)** — uma faixa pertence a uma
   única campanha; loops pertencem a uma faixa.
8. **Transição de loop:** ao trocar o loop ativo, **espera o fim da região atual**
   e então engata o novo loop, aplicando fades.
9. **Controles na sessão:** o Mestre comanda toda a reprodução; cada jogador
   ajusta apenas o **próprio volume local**. O Mestre vê status/latência
   (somente leitura).
10. **Fim de faixa em "Sem Loop":** **avança automaticamente** para a próxima
    faixa da fila.
11. **Perfil do Mestre:** **perfil local único**, configurado na 1ª execução
    (nome + iniciais/cor). Sem login/conta.
12. **Nome do jogador:** **digitado ao entrar** na sala; cor e iniciais geradas
    automaticamente.
13. **Configurações de áudio:** **dispositivo de saída** é funcional; **taxa de
    amostragem** é apenas informativa nesta versão.

### Detalhes confirmados (2ª rodada)

14. **Código da sala:** **6 caracteres alfanuméricos** (A–Z, 0–9; recomendado
    excluir ambíguos `0/O`, `1/I`). **Sem senha** — o código é o único controle de
    acesso. Único entre salas ativas e renovado a cada nova sala.
15. **Download na Sala:** ao entrar, o jogador baixa a **campanha inteira** (cache
    local, reaproveitando arquivos já presentes).
16. **Tela "Entrar em Sala":** especificada (SDD 04 §5.2) com 3 estados
    (formulário · download · sessão do jogador); acesso pelo botão **Entrar em
    Sala** no Dashboard. Mockup em [`design/entrar-na-sala.html`](./design/entrar-na-sala.html).
17. **Player — loop padrão:** **"Sem Loop"** ao carregar a faixa.
18. **Player — fim da fila:** após a última faixa, a fila **recomeça da primeira**
    (loop contínuo).
19. **Estúdio — loops não se sobrepõem:** sobreposição é validada e bloqueada.
20. **Estúdio — edição de tempos:** por **digitação** e por **arraste** na
    waveform (ambos).
21. **Faixas:** gerência estrutural (adicionar/remover/reordenar) em **Campanhas**;
    **renomear** também disponível no **Estúdio**.

## Convenções dos documentos

- **RF-xx** — Requisito Funcional (verificável).
- **RN-xx** — Regra de Negócio.
- **CA-xx** — Critério de Aceitação (formato Dado/Quando/Então).
- **QA-xx** — Questão em Aberto (a resolver antes de implementar o item).
- IDs são prefixados pelo módulo (ex.: `CAMP-RF-01`, `SALA-RN-03`).
