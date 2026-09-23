# CLAUDE.md — Lead Intelligence Engine (LIE)

Este arquivo estabelece regras permanentes de trabalho para este projeto. Deve ser respeitado em todas as sessões futuras.

## 1. Objetivo do Projeto

O LIE é uma plataforma de inteligência comercial para:

CAPTAR → QUALIFICAR → PRIORIZAR → ABORDAR → ACOMPANHAR → CONVERTER → APRENDER.

O objetivo atual é evoluir o sistema existente de captura e qualificação de leads para uma V1 comercialmente utilizável, preservando o que já funciona e evitando reconstruções desnecessárias.

## 2. Regra Fundamental de Trabalho

Antes de implementar qualquer mudança:
- investigar o código existente;
- entender o fluxo atual;
- identificar arquivos e dependências afetados;
- reutilizar componentes existentes sempre que possível;
- não inventar APIs, arquivos, modelos ou comportamentos que não existam;
- explicar o diagnóstico antes de mudanças arquiteturais relevantes.

Não alterar código, banco de dados ou configuração sem autorização explícita do usuário para aquela etapa.

## 3. Proteção de Credenciais

NUNCA:
- abrir, ler, exibir, copiar ou revelar conteúdo de `.env`;
- abrir, ler, exibir, copiar ou revelar credenciais, tokens, chaves ou segredos;
- alterar credenciais;
- imprimir segredos no terminal;
- incluir segredos em código, logs, commits ou documentação.

Arquivos `.env.*` devem ser tratados como sensíveis, exceto `.env.example` quando necessário.

Existe uma credencial Apify que foi exposta anteriormente durante o diagnóstico. Não reproduzir, citar ou recuperar esse valor. Ao final do diagnóstico do projeto, lembrar o usuário de revogar/rotacionar essa credencial e utilizar somente a nova credencial no `.env`.

## 4. Mock e Custo

Preservar o modo MOCK existente durante desenvolvimento e testes quando ele estiver configurado.

Não contratar, ativar ou adicionar serviços pagos, APIs pagas, créditos adicionais, infraestrutura paga ou dependências com custo sem autorização explícita.

Priorizar testes locais, mocks, infraestrutura já existente e soluções de baixo custo.

## 5. Arquitetura Atual

Stack principal:
- Next.js 14.2.15
- Prisma 5.22.0
- Supabase Postgres
- Node.js
- APIs internas Next.js
- Apify para aquisição de leads
- Anthropic/Claude para funcionalidades de inteligência

Respeitar a arquitetura existente e evitar migrações tecnológicas desnecessárias.

## 6. Separação Conceitual Obrigatória

Manter rigorosamente separados:
- **FIT** / aderência ao ICP;
- **INTENT** / intenção ou sinais de compra;
- **CONVERSION** / resultado comercial.

Nunca tratar um lead com alto FIT como automaticamente tendo alta intenção.
Nunca tratar alta intenção como conversão.
Conversão somente pode ser determinada por evidência do processo comercial.

## 7. Evolução Comercial

A evolução planejada do LIE é:

CAPTAR → QUALIFICAR → PRIORIZAR → ABORDAR → ACOMPANHAR → CONVERTER → APRENDER

A camada comercial deve considerar, progressivamente:
- priorização de HOT leads;
- recomendação de abordagem;
- scripts personalizados;
- mensagens iniciais;
- histórico de interações;
- pipeline comercial;
- estados como novo, contatado, respondeu, qualificado, proposta, convertido e perdido;
- registro de resultados;
- análise de conversão;
- aprendizado com leads convertidos e não convertidos;
- melhoria futura da prospecção e priorização.

Não implementar toda essa evolução de uma vez. Trabalhar incrementalmente.

## 8. Banco de Dados

Não alterar schema Prisma, criar migration, apagar dados ou modificar estruturas persistentes sem autorização explícita.

Antes de qualquer alteração de banco:
- explicar o motivo;
- identificar impacto;
- propor a mudança;
- aguardar aprovação.

Nunca executar comandos destrutivos no banco sem autorização explícita.

## 9. Preservação do Sistema

Não remover funcionalidades existentes simplesmente para simplificar uma implementação.

Antes de modificar uma função existente:
- entender quem a utiliza;
- verificar dependências;
- preservar comportamento compatível quando possível.

Evitar refatorações amplas quando uma alteração localizada resolver o problema.

## 10. Testes

Toda alteração relevante deve ser acompanhada de validação adequada.

Sempre que possível:
- executar lint/build/testes relevantes;
- testar APIs afetadas;
- verificar regressões;
- informar exatamente o que foi testado.

Não afirmar que algo funciona sem ter evidência.

## 11. Segurança e LGPD

O LIE trabalha com dados comerciais e informações de leads.

Considerar:
- minimização de dados;
- proteção de dados pessoais;
- controle de acesso;
- rastreabilidade;
- segurança de credenciais;
- uso responsável de informações;
- respeito à LGPD;
- abordagem comercial não abusiva e sem spam.

## 12. Git e Deploy

Não executar:
- `git push`;
- deploy;
- publicação;
- criação de release;
- alteração de repositório remoto;

sem autorização explícita do usuário.

Comandos locais de inspeção Git são permitidos quando necessários para diagnóstico.

## 13. Processo de Trabalho

Para tarefas complexas, seguir esta ordem:

INVESTIGAR → DIAGNOSTICAR → PROPOR → AGUARDAR APROVAÇÃO → IMPLEMENTAR → TESTAR → REPORTAR

Quando o usuário pedir apenas diagnóstico, não implementar.

## 14. Relatório de Alterações

Após qualquer implementação, informar:
- arquivos alterados;
- o que foi alterado;
- motivo;
- testes executados;
- resultado dos testes;
- riscos ou pontos pendentes;
- próximo passo recomendado.

## 15. Economia de Contexto

Evitar análises repetitivas e desnecessariamente amplas.

Preferir:
- leitura direcionada;
- investigação por etapas;
- reutilização do conhecimento já obtido na sessão;
- alterações pequenas e verificáveis.

Não reanalisar todo o projeto quando apenas uma parte for necessária.

## 16. Regra de Autorização

O usuário é quem autoriza mudanças no projeto.

Se houver dúvida sobre:
- alteração arquitetural;
- mudança de banco;
- remoção de funcionalidade;
- nova dependência;
- serviço pago;
- exposição de dados;
- operação potencialmente destrutiva;

parar e perguntar antes de executar.

## 17. Estado Atual

O projeto já possui funcionalidades de:
- clientes;
- perfis;
- entrevistas;
- especificações de prospecção;
- execução de prospecção;
- processamento de leads;
- normalização;
- deduplicação;
- scoring;
- re-scoring;
- integração/mock com Apify;
- integração/mock com Anthropic.

Essas funcionalidades devem ser consideradas patrimônio existente do projeto.

## 18. Prioridade Atual

A prioridade não é construir um sistema perfeito.

A prioridade é transformar o núcleo existente em uma V1 comercialmente utilizável e validável com clientes reais, mantendo:
- confiabilidade;
- simplicidade;
- baixo custo;
- rastreabilidade;
- capacidade de aprendizado.

## 19. Regra Final

Não presumir.
Não inventar.
Não apagar.
Não alterar sem autorização.
Investigar primeiro.
Implementar incrementalmente.
Testar depois.
