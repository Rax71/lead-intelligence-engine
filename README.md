# Lead Intelligence Engine — Sprints 01 a 05

Aplicação base, banco, Interview Engine, Client Profile + Prospection Spec,
Apify Adapter e agora **Lead Processing + Scoring**: os itens brutos do
Google Maps viram `Lead`s normalizados, deduplicados e pontuados.

> Este projeto foi montado num ambiente sem acesso à internet, então as
> dependências não puderam ser instaladas nem testadas em runtime aqui.
> O código foi checado com o compilador TypeScript usando stubs de tipo
> (sem dependências reais) e não apresentou erros de sintaxe/lógica — mas a
> validação completa só acontece quando você rodar localmente.

## O que existe até agora

**Sprint 01:** aplicação Next.js + schema Prisma (7 tabelas) + tela Clientes.

**Sprint 02:** Interview Engine (motor por LLM, sem grafo por setor) + tela
de chat da entrevista.

**Sprint 03:** Prospection Spec Generator + telas de revisão/edição/
aprovação do perfil e da spec.

**Sprint 04:** Apify Adapter — Actor Registry + Cost-Aware Execution, coleta
real via Google Maps Scraper.

**Sprint 05 (novo):**
- `lib/lead-normalizer.ts` — converte cada item bruto do Google Maps
  (`title`, `categoryName`, `address`, `phone`, `website`, `totalScore`,
  `placeId`, etc.) num formato comum, e deduplica por `placeId` (com
  fallback por nome+telefone para itens sem `placeId`).
- `lib/scoring-engine.ts` — pontua os leads normalizados via API do Claude,
  usando as `exclusions` (com ação INCLUDE/PRIORITIZE/LOWER_SCORE/REVIEW/
  EXCLUDE), `intent_signals` e `scoring_rules` da `ProspectionSpec`. Mesma
  filosofia dos motores anteriores: raciocínio do modelo, não fórmula fixa.
- `lib/lead-processor.ts` — orquestra tudo: normaliza → deduplica → pontua
  → persiste como `Lead`. Idempotente (reprocessar a mesma run não gasta a
  API de novo).
- Botão **"Processar leads"** na tela `/prospection-spec/[id]`, depois de
  uma coleta concluída.
- Tela nova `/leads/client/[id]` — lista os leads de um cliente ordenados
  por score, com badge de temperatura, motivos de fit/exclusão ao expandir a
  linha, e uma seção separada (recolhida) para os leads descartados por
  exclusão — isso sustenta o relatório "pesquisados/filtrados/descartados/
  finais" do Sprint 06.

### Sobre a qualidade do scoring (limitação real)

Os dados do Google Maps são só estruturais (nome, categoria, endereço,
telefone, site, nota). Não há como o Scoring Engine saber sinais de
intenção reais (ex.: "está contratando", "reclamação recente") só com isso —
o prompt já instrui o modelo a ser conservador nesses campos em vez de
inventar. Sinais de intenção mais ricos dependeriam de fontes adicionais
(sites, redes sociais) fora do escopo deste sprint.

## Passo a passo

Se você já configurou o projeto nos sprints anteriores, siga direto abaixo.
Senão, veja a seção **"Setup do zero"** mais abaixo primeiro.

### 1. Instalar dependências e atualizar o banco

Não há nenhum campo novo nas tabelas neste sprint — só use as tabelas já
criadas nos sprints anteriores. Se por algum motivo você pulou os sprints
anteriores, rode `npx prisma migrate dev --name init` uma vez, do zero.

```bash
npm install
```

### 2. Rodar a aplicação

```bash
npm run dev
```

Fluxo para testar o Sprint 05 de ponta a ponta:
1. Rode uma coleta (Sprint 04) até ver "run completed" com itens coletados.
2. Clique em **"Processar leads (normalizar + pontuar)"**.
3. Confira o resumo (únicos / qualificados / para revisão / descartados) e
   clique em **"Ver leads →"**.
4. Na tela de leads, confirme que os scores fazem sentido: leads cuja
   categoria bate com o `target` da spec devem ter score mais alto que
   leads de categoria não relacionada.
5. Expanda uma linha para ver os motivos de fit/sinais negativos.

## Critério de aceite deste sprint

- [ ] "Processar leads" cria registros na tabela `leads` do Supabase
- [ ] A soma de qualificados + para revisão + descartados bate com o total
      de itens únicos (deduplicados)
- [ ] Um lead cuja categoria bate claramente com uma exclusão `EXCLUDE` da
      spec aparece na lista de "descartados", não na lista principal
- [ ] Os scores variam de forma coerente (não são todos iguais, não são
      todos 100)
- [ ] Clicar em "Processar leads" duas vezes na mesma run não duplica os
      leads nem gasta a API do Claude de novo (idempotente — confirme
      olhando se o resumo é idêntico e se não demorou o mesmo tempo da
      primeira vez)
- [ ] A tela `/leads/client/[id]` ordena os leads do maior para o menor
      score

Se todos os itens acima passarem, o Sprint 05 está validado e pronto para o
Sprint 06 (Relatório — consolidar tudo isso numa visão só, com contagens de
pesquisados/filtrados/descartados/finais).

## Setup do zero (se este é seu primeiro sprint rodando o projeto)

### 1. Criar o projeto Supabase

1. Crie um projeto gratuito em https://supabase.com.
2. Em **Project Settings → Database**, copie:
   - a **Connection string** no modo *Transaction* (porta 6543) → vai em
     `DATABASE_URL`
   - a **Connection string** no modo *Session* (porta 5432) → vai em
     `DIRECT_URL`

### 2. Gerar as chaves (Claude + Apify)

- API do Claude: https://console.anthropic.com/settings/keys
- Token da Apify: https://console.apify.com/settings/integrations

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env
# edite .env com DATABASE_URL, DIRECT_URL, ANTHROPIC_API_KEY e APIFY_TOKEN
```

### 4-5. Instalar dependências e criar as tabelas

```bash
npm install
npx prisma migrate dev --name init
npm run dev
```

## Decisões deste sprint (para registro)

- O scoring roda em **um único lote** (todos os leads de uma run numa
  chamada só à API do Claude), não um lead por vez — mais barato e mais
  consistente entre leads da mesma run.
- Leads excluídos pela spec (`action: EXCLUDE`) não são descartados
  silenciosamente — viram registros `Lead` com `status: DISCARDED`,
  visíveis (mas recolhidos) na tela de leads. Isso é o que vai alimentar as
  contagens do relatório no Sprint 06.
- `needs_review` (`action: REVIEW`) vira `status: REVIEWED` — aparece na
  lista principal, não fica escondido, mas fica marcado para o operador
  olhar com mais atenção.
- `confidence_score` mede completude de dados (telefone/site/endereço
  presentes), não qualidade do fit — são conceitos diferentes e o prompt do
  Scoring Engine já os separa.
