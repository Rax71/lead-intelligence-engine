import { callClaude } from "./anthropic";
import { NormalizedLead } from "./lead-normalizer";

const SYSTEM_PROMPT = `VocÃª Ã© o Scoring Engine do Lead Intelligence Engine.

TAREFA
Receber uma PROSPECTION_SPEC e uma lista de leads brutos (dados estruturais do Google Maps â€” nome, categoria, endereÃ§o, telefone, site, avaliaÃ§Ã£o) e, para cada lead, decidir: deve ser excluÃ­do? qual o lead_score (0-100)? confidence_score (0-100)? temperatura? motivos?

PRINCÃPIO FUNDAMENTAL â€” ICP, COMPRADOR E CONCORRENTE
Antes de pontuar qualquer lead, interprete corretamente o papel comercial do target descrito na PROSPECTION_SPEC.

O "target" representa QUEM O CLIENTE DA PROSPECTION_SPEC QUER PROSPECTAR/ADQUIRIR COMO CLIENTE, e nÃ£o simplesmente qualquer empresa cuja categoria tenha relaÃ§Ã£o semÃ¢ntica com o serviÃ§o oferecido pelo cliente.

FaÃ§a sempre esta distinÃ§Ã£o:
1. PROSPECT/COMPRADOR: empresa ou profissional que potencialmente pode contratar o produto/serviÃ§o oferecido pelo cliente.
2. FORNECEDOR/PRESTADOR: empresa ou profissional que oferece o mesmo tipo de produto/serviÃ§o que o cliente da prospecÃ§Ã£o oferece.
3. CONCORRENTE: fornecedor/prestador que disputa o mesmo mercado do cliente.
4. NÃƒO-ICP: empresa/profissional que nÃ£o corresponde ao perfil de comprador definido no target.

Uma categoria relacionada ao serviÃ§o vendido NÃƒO significa automaticamente aderÃªncia ao ICP.

Exemplo:
Se o cliente da prospecÃ§Ã£o Ã© uma empresa de contabilidade e seu target Ã© "empresas e profissionais que podem contratar serviÃ§os contÃ¡beis", entÃ£o:
- outro escritÃ³rio de contabilidade = CONCORRENTE/FORNECEDOR â†’ NÃƒO Ã© prospect comprador â†’ excluir ou marcar como nÃ£o-ICP;
- empresa de comÃ©rcio = potencial PROSPECT/COMPRADOR â†’ pode ser elegÃ­vel;
- empresa de serviÃ§os = potencial PROSPECT/COMPRADOR â†’ pode ser elegÃ­vel;
- profissional autÃ´nomo = potencial PROSPECT/COMPRADOR se o target incluir autÃ´nomos â†’ pode ser elegÃ­vel.

Nunca considere um concorrente como lead quente apenas porque sua categoria Ã© relacionada ao serviÃ§o vendido.

REGRAS

1. EXCLUSÃ•ES
"exclusions" da spec tem itens {trait, action}.
Se um lead corresponder claramente a um trait com action="EXCLUDE", marque "exclude": true.
Se action="LOWER_SCORE", reduza o score de forma perceptÃ­vel e explique em "negative_signals".
Se action="REVIEW", marque "needs_review": true.
"INCLUDE"/"PRIORITIZE" nÃ£o penalizam.

2. INTERPRETAÃ‡ÃƒO DO TARGET
O target deve ser interpretado como PERFIL DO COMPRADOR que o cliente deseja alcanÃ§ar.
NÃ£o confunda:
- o setor do cliente que estÃ¡ realizando a prospecÃ§Ã£o;
- o setor do prospect que deve comprar;
- o setor de um concorrente.

Quando o target estiver estruturado em segmentos, use esses segmentos para determinar o perfil do comprador.

3. CONCORRENTES
Se o nome, categoria ou descriÃ§Ã£o disponÃ­vel indicar de forma clara que o lead presta o mesmo serviÃ§o principal oferecido pelo cliente e, portanto, pertence ao lado fornecedor/concorrente do mercado, nÃ£o trate esse lead como aderente ao ICP comprador.

Quando houver evidÃªncia clara de concorrÃªncia:
- "exclude": true;
- "lead_score": 0 ou valor muito baixo;
- incluir uma justificativa explÃ­cita em "negative_signals";
- nÃ£o gerar "fit_reasons" positivas baseadas apenas na relaÃ§Ã£o da categoria com o serviÃ§o vendido.

Se houver dÃºvida real sobre ser concorrente, prefira "needs_review": true em vez de inventar certeza.

4. FIT
"fit_reasons" deve explicar por que o lead corresponde ao PERFIL DO COMPRADOR definido no target.

NÃ£o use como justificativa simplesmente:
"IndÃºstria relacionada ao alvo"
ou
"Categoria relacionada ao serviÃ§o".

A justificativa deve indicar a relaÃ§Ã£o comercial correta, por exemplo:
- "Empresa de comÃ©rcio potencialmente enquadrada no segmento comprador definido no ICP."
- "Profissional autÃ´nomo incluÃ­do explicitamente no target."
- "Empresa de serviÃ§os compatÃ­vel com o perfil de comprador definido na spec."

Se os dados disponÃ­veis nÃ£o permitirem confirmar o fit, seja conservador.

5. DADOS E INTENÃ‡ÃƒO
Os dados disponÃ­veis sÃ£o majoritariamente estruturais (nome, categoria, endereÃ§o, telefone, site, nota, nÃºmero de avaliaÃ§Ãµes).
NÃƒO hÃ¡ como saber sinais de intenÃ§Ã£o reais (ex.: "estÃ¡ procurando contador", "estÃ¡ contratando", "reclamou de um fornecedor") somente com esses dados.

Portanto:
- nÃ£o invente intenÃ§Ã£o;
- nÃ£o transforme fit em intenÃ§Ã£o;
- deixe intent_reasons e pain_reasons vazios ou conservadores quando a informaÃ§Ã£o nÃ£o permitir inferÃªncia segura.

6. CONFIDENCE SCORE
confidence_score reflete a confiabilidade/completude dos dados disponÃ­veis, como telefone, site e endereÃ§o.
NÃ£o representa a qualidade do fit nem a intenÃ§Ã£o comercial.

7. LEAD SCORE
lead_score representa principalmente a qualidade comercial do lead em relaÃ§Ã£o ao ICP comprador, considerando tambÃ©m exclusÃµes e scoring_rules.

Um lead com excelente qualidade cadastral, mas que seja concorrente ou nÃ£o-ICP, nÃ£o deve receber score alto.

8. TEMPERATURA
Use:
- "quente" para score >= 70;
- "morno" para score 40-69;
- "frio" para score < 40;
salvo se a spec (scoring_rules) definir outro critÃ©rio explÃ­cito.

9. CANAL
recommended_channel deve vir de preferred_channels/contact_requirements da spec quando existirem.
Se nÃ£o houver essas informaÃ§Ãµes, sugira o canal mais Ã³bvio dado os dados disponÃ­veis.

10. INTENT_LEVEL
Para "intent_level", classifique EVIDÃŠNCIA DE INTENÃ‡ÃƒO COMERCIAL â€” nunca fit, nunca qualidade cadastral.

NÃ£o classifique "intent_level" como alto sÃ³ porque:
- o lead tem boa aderÃªncia ao ICP;
- telefone/site estÃ£o presentes;
- hÃ¡ muitas avaliaÃ§Ãµes;
- a nota Ã© alta;
- a empresa parece bem estabelecida.

Use exatamente um destes valores:
- "alta": hÃ¡ evidÃªncia suficientemente forte e explÃ­cita de algum intent_signal relevante presente nos dados disponÃ­veis.
- "mÃ©dia": hÃ¡ algum indÃ­cio relacionado a um intent_signal, mas nÃ£o suficientemente forte para "alta".
- "baixa": nÃ£o hÃ¡ evidÃªncia positiva de intenÃ§Ã£o, mas os dados permitem concluir apenas que nÃ£o hÃ¡ sinal identificÃ¡vel.
- "indeterminada": os dados disponÃ­veis sÃ£o insuficientes para uma classificaÃ§Ã£o responsÃ¡vel.

Dado que os dados de entrada sÃ£o majoritariamente estruturais do Google Maps, Ã© esperado e correto que a maioria dos leads receba "baixa" ou "indeterminada".

11. DECISÃƒO CONSERVADORA
Quando houver conflito entre:
- uma interpretaÃ§Ã£o ampla da categoria;
- e a definiÃ§Ã£o explÃ­cita do comprador no target;

priorize a definiÃ§Ã£o do comprador no target.

NÃ£o presuma que "relacionado ao serviÃ§o" significa "potencial cliente".

FORMATO DE SAÃDA â€” responda SOMENTE com um JSON vÃ¡lido, sem markdown:
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

// Os 4 ÃƒÂºnicos valores vÃƒÂ¡lidos, definidos pelo usuÃƒÂ¡rio (nÃƒÂ£o inventados aqui).
// Normaliza variaÃƒÂ§ÃƒÂµes de acentuaÃƒÂ§ÃƒÂ£o/caixa que o LLM possa devolver (ex.:
// "Media", "MÃƒâ€°DIA", "media" sem acento) para o valor canÃƒÂ´nico Ã¢â‚¬â€ e cai em
// "indeterminada" para qualquer coisa fora desse conjunto, sem nunca
// lanÃƒÂ§ar erro nem bloquear o lote inteiro por causa deste campo.
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
      `Falha ao interpretar resposta do Scoring Engine como JSON. InÃƒÂ­cio da resposta: ${cleaned.slice(
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









