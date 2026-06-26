# SDD 01 — Campanhas

- **Status:** Rascunho aprovável
- **Versão:** 1.0
- **Pré-requisitos:** SDD 00 (Fundação)
- **Habilita:** Estúdio, Player, Sala

---

## 1. Objetivo

Permitir ao Mestre organizar suas trilhas em **campanhas**: criar, visualizar,
editar e excluir campanhas, e **importar arquivos de áudio** (que viram *faixas*).
É a porta de entrada de conteúdo do app — sem campanhas/faixas, os demais módulos
não têm o que tocar ou editar.

## 2. Escopo

### Dentro do escopo
- Biblioteca de campanhas (grade de *cards*).
- Criação de campanha via modal, com **importação de áudios** (arrastar-soltar ou
  procurar no explorador).
- **Cópia** dos arquivos importados para a biblioteca gerenciada do app.
- Extração de metadados na importação (duração, formato, tamanho, etc.).
- Edição (renomear) e exclusão de campanhas.
- **Gerência de faixas** da campanha: adicionar, renomear, remover e reordenar.

### Fora do escopo
- Edição de loops/regiões (SDD 02 — Estúdio).
- Reprodução (SDD 03 — Player).

---

## 3. Histórias de Usuário

- **US-01-01** — Como Mestre, quero criar uma campanha e adicionar várias músicas
  de uma vez, para preparar a trilha de uma aventura.
- **US-01-02** — Como Mestre, quero ver todas as minhas campanhas com capa, número
  de faixas e quando foram modificadas, para encontrá-las rapidamente.
- **US-01-03** — Como Mestre, quero renomear ou excluir uma campanha, para manter
  minha biblioteca organizada.

---

## 4. UI / Telas

### 4.1 Biblioteca (`data-screen-label="Campanhas"`)
- Cabeçalho: rótulo "Biblioteca", título "Campanhas", botão **Nova Campanha**.
- Grade responsiva de *cards* (`minmax(258px, 1fr)`), cada um com:
  - **Capa** (gradiente `color_glow`/`color_base` + iniciais em `Metamorphous`).
  - Botões de **Editar** (`pencil`) e **Excluir** (`trash-2`) no canto da capa.
  - Nome, **nº de faixas** (`music`), e **"modificado há…"** (`clock`).
- *Card* especial pontilhado **"Criar Nova Campanha"** ao final da grade.

### 4.2 Modal "Nova Campanha"
- Campo **Nome da Campanha** (placeholder "Ex.: As Ruínas de Eldoria").
- **Zona de upload** (arrastar-soltar) com estado de *drag-over* destacado;
  texto "ou clique para procurar"; aceita **MP3 · WAV · FLAC · OGG** (múltiplos).
- Lista de **faixas adicionadas** (staged), cada item com ícone, nome, tamanho e
  botão remover (`x`); contador "N para importar".
- Rodapé: **Cancelar** e **Criar Campanha**.

> O mesmo modal serve para **editar** uma campanha existente (reaproveitando
> campos), conforme RF-01-09.

---

## 5. Requisitos Funcionais

- **CAMP-RF-01** — A biblioteca lista todas as campanhas (tabela `campaigns`),
  ordenadas por `updated_at` desc (mais recentes primeiro).
- **CAMP-RF-02** — Cada *card* mostra capa, nome, contagem de faixas (count em
  `tracks`) e "modificado" em formato relativo ("agora", "há 2 horas", "ontem",
  "há 3 dias", "há 1 semana", "há N semanas").
- **CAMP-RF-03** — O botão **Nova Campanha** (e o *card* pontilhado) abrem o modal
  de criação vazio.
- **CAMP-RF-04** — No modal, o Mestre pode adicionar faixas por **arrastar-soltar**
  ou por **seleção via explorador** (diálogo nativo). Vários arquivos por vez.
- **CAMP-RF-05** — Apenas arquivos de **formatos suportados** (MP3, WAV, FLAC, OGG;
  e M4A/AAC quando suportado) são aceitos; arquivos não suportados são ignorados
  com aviso.
- **CAMP-RF-06** — A lista de faixas *staged* mostra **nome** e **tamanho legível**
  (B/KB/MB) e permite **remover** itens antes de criar.
- **CAMP-RF-07** — Ao clicar **Criar Campanha**:
  1. cria o registro em `campaigns` (gerando iniciais e par de cores);
  2. **copia** cada arquivo *staged* para `userData/library/<campaign_id>/`;
  3. cria um registro em `tracks` por arquivo, com metadados extraídos;
  4. fecha o modal e atualiza a biblioteca.
- **CAMP-RF-08** — A importação extrai e persiste: `duration_ms`, `format`,
  `file_size_bytes`, `sample_rate`, `channels`, `original_filename` e `title`
  inicial (= nome do arquivo sem extensão).
- **CAMP-RF-09** — **Editar campanha** (ícone `pencil`) abre o modal de edição
  permitindo **renomear a campanha** e **gerenciar as faixas** (ver CAMP-RF-12).
- **CAMP-RF-10** — **Excluir campanha** (ícone `trash-2`) pede confirmação e, ao
  confirmar, remove a campanha, suas faixas e loops (CASCADE) **e os arquivos**
  copiados em `userData/library/<campaign_id>/`.
- **CAMP-RF-11** — A importação é **assíncrona** com indicação de progresso; faixas
  ficam com `import_status='pending'` até concluir e `='ready'` depois (ou
  `'error'` em falha).
- **CAMP-RF-12** — No modal de edição, a lista de faixas permite **renomear**
  (`title`), **remover** (com confirmação), **reordenar** (arrastar → `order_index`)
  e **adicionar** novas faixas. Remover uma faixa **apaga seu arquivo** em
  `library/<campaign_id>/` e seus loops (CASCADE). *(A renomeação de faixa também
  está disponível no Estúdio — EST-RF-15.)*

---

## 6. Regras de Negócio

- **CAMP-RN-01** — Os arquivos são **sempre copiados** para a biblioteca do app;
  o original na origem não é movido nem alterado. A campanha é **autocontida**.
- **CAMP-RN-02** — Uma **faixa pertence a exatamente uma campanha** (modelo
  isolado). Não há compartilhamento de faixas entre campanhas; importar a mesma
  música em duas campanhas gera duas cópias.
- **CAMP-RN-03** — **Iniciais** da campanha: primeira letra da 1ª palavra +
  primeira letra da 2ª palavra (ou 2ª letra da 1ª, se houver só uma), em
  maiúsculas. Ex.: "As Minas de Veridian" → "AM" *(ver QA-01-01 sobre stop-words)*.
- **CAMP-RN-04** — **Cores da capa** são atribuídas a partir de uma **paleta
  rotativa** (base+glow). *(ver QA-01-02 sobre cor escolhível.)*
- **CAMP-RN-05** — Nome de campanha é obrigatório; se vazio ao criar, usa
  "Nova Campanha". *(ver QA-01-04 sobre nomes duplicados.)*
- **CAMP-RN-06** — Excluir é **destrutivo e irreversível** (sem lixeira nesta
  versão) — por isso exige confirmação explícita.
- **CAMP-RN-07** — Uma campanha pode existir **sem faixas** (criada vazia e
  preenchida depois). *(Confirmar em QA-01-05.)*

---

## 7. Dados (tabelas envolvidas)

`campaigns`, `tracks` (ver esquema no SDD 00 §7). A criação de campanha grava em
ambas; a contagem de faixas do *card* é `COUNT(*)` de `tracks` por `campaign_id`.

Estrutura em disco:
```
userData/
  soundsmith.db
  library/
    <campaign_id>/
      <track_id>__<arquivo-saneado>.<ext>
```

---

## 8. Critérios de Aceitação

- **CAMP-CA-01** — *Dado* o modal aberto com nome preenchido e 3 áudios válidos
  adicionados, *quando* clico em "Criar Campanha", *então* uma nova campanha
  aparece na biblioteca com "3 faixas" e os 3 arquivos existem em
  `library/<id>/`.
- **CAMP-CA-02** — *Dado* que arrasto um `.txt` e um `.mp3` para a zona, *então*
  apenas o `.mp3` é adicionado à lista *staged*; o `.txt` é rejeitado com aviso.
- **CAMP-CA-03** — *Dado* uma faixa *staged*, *quando* clico no "x" dela, *então*
  ela some da lista e o contador "N para importar" decrementa.
- **CAMP-CA-04** — *Dado* uma campanha existente, *quando* a excluo e confirmo,
  *então* ela some da biblioteca e a pasta `library/<id>/` é removida do disco.
- **CAMP-CA-05** — *Dado* que renomeio uma campanha, *então* o novo nome e as
  iniciais recalculadas aparecem no *card*, e `updated_at` é atualizado (a
  campanha sobe para o topo da lista).
- **CAMP-CA-06** — *Dado* um arquivo grande sendo importado, *então* vejo
  progresso e a faixa só fica disponível para o Estúdio/Player quando
  `import_status='ready'`.
- **CAMP-CA-07** — *Dado* a campanha em edição, *quando* removo uma faixa e
  confirmo, *então* ela some da lista, seu arquivo é apagado do disco e a contagem
  do *card* decrementa; *quando* reordeno faixas e salvo, a nova ordem persiste.

---

## 9. Questões em Aberto

> **Resolvida:** **QA-01-03** — a gerência estrutural de faixas (adicionar,
> remover, reordenar) fica em **Campanhas** (modal de edição), local canônico de
> conteúdo; a **renomeação** também está disponível no **Estúdio** (EST-RF-15) por
> conveniência.

- **QA-01-01** — Geração de iniciais deve ignorar *stop-words* ("As", "de", "O",
  "dos")? Ex.: "As Minas de Veridian" → "AM" ou "MV"? *(O protótipo usa "MV".)*
- **QA-01-02** — A cor da capa deve ser **escolhível** pelo Mestre ou sempre
  automática da paleta?
- **QA-01-04** — Nomes de campanha **duplicados** são permitidos?
- **QA-01-05** — É permitido **criar campanha sem nenhuma faixa**?
- **QA-01-06** — Há limite de tamanho/quantidade de arquivos por importação?
