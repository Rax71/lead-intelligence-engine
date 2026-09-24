import { callClaude } from "./anthropic";
import { NormalizedLead } from "./lead-normalizer";

const SYSTEM_PROMPT = `Você é o Scoring Engine do Lead Intelligence Engine.

TAREFA
Receber uma PROSPECTION_SPEC e uma lista de leads brutos (dados estruturais do Google Maps — nome, categoria, endereço, telefone, site, avaliação) e, para cada lead, decidir: deve ser excluído? qual o lead_score (0-100)? confidence_score (0-100)? temperatura? motivos?

PRINCÍPIO FUNDAMENTAL — ICP, COMPRADOR E CONCORRENTE
Antes de pontuar qualquer lead, interprete corretamente o papel comercial do target descrito na PROSPECTION_SPEC.

O "target" representa QUEM O CLIENTE DA PROSPECTION_SPEC QUER PROSPECTAR/ADQUIRIR COMO CLIENTE, e não simplesmente qualquer empresa cuja categoria tenha relação semântica com o serviço oferecido pelo cliente.

Faça sempre esta distinção:
1. PROSPECT/COMPRADOR: empresa ou profissional que potencialmente pode contratar o produto/serviço oferecido pelo cliente.
2. FORNECEDOR/PRESTADOR: empresa ou profissional que oferece o mesmo tipo de produto/serviço que o cliente da prospecção oferece.
3. CONCORRENTE: fornecedor/prestador que disputa o mesmo mercado do cliente.
4. NÃO-ICP: empresa/profissional que não corresponde ao perfil de comprador definido no target.

Uma categoria relacionada ao serviço vendido NÃO significa automaticamente aderência ao ICP.

Exemplo:
Se o cliente da prospecção é uma empresa de contabilidade e seu target é "empresas e profissionais que podem contratar serviços contábeis", então:
- outro escritório de contabilidade = CONCORRENTE/FORNECEDOR → NÃO é prospect comprador → excluir ou marcar como não-ICP;
- empresa de comércio = potencial PROSPECT/COMPRADOR → pode ser elegível;
- empresa de serviços = potencial PROSPECT/COMPRADOR → pode ser elegível;
- profissional autônomo = potencial PROSPECT/COMPRADOR se o target incluir autônomos → pode ser elegível.

Nunca considere um concorrente como lead quente apenas porque sua categoria é relacionada ao serviço vendido.

REGRAS

1. EXCLUSÕES
"exclusions" da spec tem itens {trait, action}.
Se um lead corresponder claramente a um trait com action="EXCLUDE", marque "exclude": true.
Se action="LOWER_SCORE", reduza o score de forma perceptível e explique em "negative_signals".
Se action="REVIEW", marque "needs_review": true.
"INCLUDE"/"PRIORITIZE" não penalizam.

2. INTERPRETAÇÃO DO TARGET
O target deve ser interpretado como PERFIL DO COMPRADOR que o cliente deseja alcançar.
Não confunda:
- o setor do cliente que está realizando a prospecção;
- o setor do prospect que deve comprar;
- o setor de um concorrente.

Quando o target estiver estruturado em segmentos, use esses segmentos para determinar o perfil do comprador.

3. CONCORRENTES
Se o nome, categoria ou descrição disponível indicar de forma clara que o lead presta o mesmo serviço principal oferecido pelo cliente e, portanto, pertence ao lado fornecedor/concorrente do mercado, não trate esse lead como aderente ao ICP comprador.

Quando houver evidência clara de concorrência:
- "exclude": true;
- "lead_score": 0 ou valor muito baixo;
- incluir uma justificativa explícita em "negative_signals";
- não gerar "fit_reasons" positivas baseadas apenas na relação da categoria com o serviço vendido.

Se houver dúvida real sobre ser concorrente, prefira "needs_review": true em vez de inventar certeza.

4. FIT
"fit_reasons" deve explicar por que o lead corresponde ao PERFIL DO COMPRADOR definido no target.

Não use como justificativa simplesmente:
"Indústria relacionada ao alvo"
ou
"Categoria relacionada ao serviço".

A justificativa deve indicar a relação comercial correta, por exemplo:
- "Empresa de comércio potencialmente enquadrada no segmento comprador definido no ICP."
- "Profissional autônomo incluído explicitamente no target."
- "Empresa de serviços compatível com o perfil de comprador definido na spec."

Se os dados disponíveis não permitirem confirmar o fit, seja conservador.

5. DADOS E INTENÇÃO
Os dados disponíveis são majoritariamente estruturais (nome, categoria, endereço, telefone, site, nota, número de avaliações).
NÃO há como saber sinais de intenção reais (ex.: está procurando contador, está contratando, reclamou de um fornecedor) somente com esses dados.

Portanto:
- não invente intenção;
- não transforme fit em intenção;
- deixe intent_reasons e pain_reasons vazios ou conservadores quando a informação não permitir inferência segura.

6. CONFIDENCE SCORE
confidence_score reflete a confiabilidade/completude dos dados disponíveis, como telefone, site e endereço.
Não representa a qualidade do fit nem a intenção comercial.

7. LEAD SCORE
lead_score representa principalmente a qualidade comercial do lead em relação ao ICP comprador, considerando também exclusões e scoring_rules.

Um lead com excelente qualidade cadastral, mas que seja concorrente ou não-ICP, não deve receber score alto.

8. TEMPERATURA
Use:
- "quente" para score >= 70;
- "morno" para score 40-69;
- "frio" para score < 40;
salvo se a spec (scoring_rules) definir outro critério explícito.

9. CANAL
recommended_channel deve vir de preferred_channels/contact_requirements da spec quando existirem.
Se não houver essas informações, sugira o canal mais óbvio dado os dados disponíveis.

10. INTENT_LEVEL
Para intent_level, classifique EVIDÊNCIA DE INTENÇÃO COMERCIAL — nunca fit, nunca qualidade cadastral.

Não classifique "intent_level" como alto só porque:
- o lead tem boa aderência ao ICP;
- telefone/site estáo presentes;
- há muitas avaliações;
- a nota é alta;
- a empresa parece bem estabelecida.

Use exatamente um destes valores:
- "alta": há evidência suficientemente forte e explícita de algum intent_signal relevante presente nos dados disponíveis.
- "média": há algum indício relacionado a um intent_signal, mas não suficientemente forte para "alta".
- "baixa": não há evidência positiva de intenção, mas os dados permitem concluir apenas que não há sinal identificável.
- "indeterminada": os dados disponíveis são insuficientes para uma classificação responsável.

Dado que os dados de entrada são majoritariamente estruturais do Google Maps, é esperado e correto que a maioria dos leads receba "baixa" ou "indeterminada".

11. DECISÃO CONSERVADORA
Quando houver conflito entre:
- uma interpretação ampla da categoria;
- e a definição explícita do comprador no target;

priorize a definição do comprador no target.

Não presuma que "relacionado ao serviço" significa "potencial cliente".

FORMATO DE SAÍDA — responda SOMENTE com um JSON válido, sem markdown:
{
  "results": [
    {
      "index": 0,
      "exclude": false,
      "needs_review": false,
      "lead_score": 0,
      "confidence_score": 0,
      "temperature": "frio",
      "intent_level": "indeterminada",
      "intent_source": null,
      "fit_reasons": [],
      "intent_reasons": [],
      "pain_reasons": [],
      "negative_signals": [],
      "recommended_action": "",
      "recommended_channel": ""
    }
  ]
}`;

export type ScoringResult = {
  index: number;
  exclude: boolean;
  needsReview: boolean;
  leadScore: number;
  confidenceScore: number;
  temperature: string;
  intentLevel: string;
  intentSource: string | null;
  fitReasons: string[];
  intentReasons: string[];
  painReasons: string[];
  negativeSignals: string[];
  recommendedAction: string | null;
  recommendedChannel: string | null;
};

// Os 4 únicos valores válidos, definidos pelo usuário (não inventados aqui).
// Normaliza variações de acentuação/caixa que o LLM possa devolver (ex.:
// "Media", "MÉDIA", "media" sem acento) para o valor canônico "média" e cai em
// "indeterminada" para qualquer coisa fora desse conjunto, sem nunca
// lançar erro nem bloquear o lote inteiro por causa deste campo.
const VALID_INTENT_LEVELS = ["alta", "média", "baixa", "indeterminada"] as const;

function normalizeIntentLevel(value: unknown): string {
  if (typeof value !== "string") return "indeterminada";

  const stripped = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove acentos para comparar

  switch (stripped) {
    case "alta":
      return "alta";
    case "media":
      return "média";
    case "baixa":
      return "baixa";
    case "indeterminada":
      return "indeterminada";
    default:
      return "indeterminada";
  }
}

function normalizeIntentSource(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "MOCK") return "MOCK";
  if (normalized === "OBSERVED") return "OBSERVED";
  return null;
}

function parseScoringOutput(raw: string): ScoringResult[] {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `Falha ao interpretar resposta do Scoring Engine como JSON. Início da resposta: ${cleaned.slice(
        0,
        300
      )}`
    );
  }

  const results = Array.isArray(parsed.results) ? parsed.results : [];

  return results.map((r: any) => ({
    index: r.index,
    exclude: Boolean(r.exclude),
    needsReview: Boolean(r.needs_review),
    leadScore: Math.max(0, Math.min(100, Math.round(Number(r.lead_score) || 0))),
    confidenceScore: Math.max(
      0,
      Math.min(100, Math.round(Number(r.confidence_score) || 0))
    ),
    temperature: r.temperature || "frio",
    intentLevel: normalizeIntentLevel(r.intent_level),
    intentSource: normalizeIntentSource(r.intent_source),
    fitReasons: r.fit_reasons || [],
    intentReasons: r.intent_reasons || [],
    painReasons: r.pain_reasons || [],
    negativeSignals: r.negative_signals || [],
    recommendedAction: r.recommended_action || null,
    recommendedChannel: r.recommended_channel || null,
  }));
}

export async function scoreLeads(
  spec: {
    target: unknown;
    what: unknown;
    exclusions: unknown;
    intentSignals: unknown;
    location?: unknown;
    scoringRules: unknown;
    preferredChannels?: unknown;
    contactRequirements?: unknown;
  },
  leads: NormalizedLead[]
): Promise<ScoringResult[]> {
  if (leads.length === 0) return [];

    const leadPayload = leads.map((l) => {
    const rawLead =
      l.raw && typeof l.raw === "object"
        ? (l.raw as Record<string, unknown>)
        : {};

    const evidenceParts = [
      rawLead.description,
      rawLead.about,
      rawLead.snippet,
      rawLead.text,
      rawLead.reviews,
      rawLead.services,
    ]
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);

    return {
      index: l.index,
      company_name: l.companyName,
      industry: l.industry,
      address: l.address,
      neighborhood: l.neighborhood,
      city: l.city,
      phone: l.phone,
      website: l.website,
      rating: l.rating,
      reviews_count: l.reviewsCount,
      evidence_text: evidenceParts.join(" | "),
    };
  });

  const raw = await callClaude({
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `PROSPECTION_SPEC (campos relevantes):\n${JSON.stringify(
          {
            target: spec.target,
            location: spec.location,
            what: spec.what,
            exclusions: spec.exclusions,
            intent_signals: spec.intentSignals,
            scoring_rules: spec.scoringRules,
            preferred_channels: spec.preferredChannels,
            contact_requirements: spec.contactRequirements,
          },
          null,
          2
        )}\n\nLEADS_BRUTOS (${leadPayload.length} itens):\n${JSON.stringify(
          leadPayload,
          null,
          2
        )}`,
      },
    ],
    maxTokens: 4000,
  });

  return applyDeterministicLocationRules(parseScoringOutput(raw), leads, spec.location);
}


function applyDeterministicLocationRules(
  results: ScoringResult[],
  leads: NormalizedLead[],
  location: unknown
): ScoringResult[] {
  const locationText = JSON.stringify(location ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const exclusiveCityMatch = locationText.match(
    /(?:somente|apenas|exclusivamente)\s+(?:(?:em|na|no)\s+)?([a-z0-9][a-z0-9\s-]{2,50}?)(?:\.|,|$|")/
  );

  if (!exclusiveCityMatch) return results;

  const targetCity = exclusiveCityMatch[1]
    .trim()
    .replace(/\s+/g, " ");

  if (!targetCity) return results;

  return results.map((result) => {
    const lead = leads.find((item) => item.index === result.index);

    if (!lead?.city) return result;

    const leadCity = lead.city
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .replace(/\s+/g, " ");

    if (leadCity === targetCity) return result;

    return {
      ...result,
      exclude: true,
      negativeSignals: [
        ...result.negativeSignals,
        `Fora da cidade-alvo exclusiva: ${lead.city}.`,
      ],
    };
  });
}









