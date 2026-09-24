// Lead Package V1 — camada pura de interpretação comercial sobre o Lead Record.
//
// Este módulo NÃO acessa banco, filesystem, rede, Prisma, Next.js ou LLM.
// Todas as funções recebem dados já carregados pelo chamador e devolvem
// estruturas em memória. Nada aqui recalcula scoring, FIT ou INTENT —
// esses valores continuam sendo produzidos exclusivamente por
// lib/scoring-engine.ts e persistidos por lib/lead-processor.ts.
//
// Convenção usada nos blocos abaixo (para não confundir tipos de afirmação):
// - DATA           = informação objetiva já persistida (ex.: companyName, phone).
// - EVIDENCE        = informação usada para sustentar uma conclusão (ex.: rating do
//                      listing, ou o texto que embasou um "reason" do scoring).
// - INTERPRETATION  = conclusão já derivada por outra camada (fitReasons, intentLevel,
//                      recommendedAction — produzidos pelo Scoring Engine).
// - HYPOTHESIS      = conclusão derivada por ESTE módulo, ainda sujeita a revisão
//                      (ex.: prioridade operacional) — nunca deve ser lida como fato.

// ---------------------------------------------------------------------------
// TIPOS DE ENTRADA (DTOs estruturais, sem dependência de @prisma/client)
// ---------------------------------------------------------------------------

/** Espelha os campos relevantes do model Lead, sem importar o Prisma Client. */
export type LeadPackageLeadInput = {
  id: string;
  companyName: string;
  personName: string | null;
  role: string | null;
  industry: string | null;
  subindustry: string | null;
  address: string | null;
  city: string | null;
  neighborhood: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;

  leadScore: number | null;
  confidenceScore: number | null;
  temperature: string | null;

  intentLevel: string | null;
  intentSource: string | null;

  // Campos Json? no Prisma — não há garantia de shape, por isso `unknown`.
  fitReasons: unknown;
  intentReasons: unknown;
  painReasons: unknown;
  negativeSignals: unknown;
  evidence: unknown;
  sources: unknown;

  recommendedAction: string | null;
  recommendedChannel: string | null;

  status: string; // LeadStatus: "NEW" | "REVIEWED" | "CONTACTED" | "DISCARDED"
  identityKey: string | null;
  placeId: string | null;
};

/** Espelha os campos relevantes do model Run, sem importar o Prisma Client. */
export type LeadPackageRunInput = {
  id: string;
  status: string;
  createdAt?: Date | string;
};

/**
 * Espelha os campos Json relevantes do model ProspectionSpec.
 * Cada campo é `unknown` porque o conteúdo real é texto/estrutura livre
 * definida pela entrevista com o cliente — este módulo apenas repassa,
 * nunca reinterpreta ou recria critério novo a partir daqui.
 */
export type LeadPackageProspectionSpecInput = {
  target?: unknown;
  location?: unknown;
  what?: unknown;
  discoveryStrategy?: unknown;
  intentSignals?: unknown;
  exclusions?: unknown;
  dataRequired?: unknown;
  scoringRules?: unknown;
  stopCriteria?: unknown;
};

/** Espelha os campos relevantes do model FeedbackEvent. */
export type LeadPackageFeedbackEventInput = {
  id: string;
  eventType: string;
  notes: string | null;
  createdAt: Date | string;
};

// ---------------------------------------------------------------------------
// TIPOS DE SAÍDA — blocos do Lead Package V1
// ---------------------------------------------------------------------------

export type IdentificationBlock = {
  leadId: string;
  companyName: string;
  personName: string | null;
  role: string | null;
  industry: string | null;
  subindustry: string | null;
  address: string | null;
  city: string | null;
  neighborhood: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
};

export type ContextBlock = {
  /** false quando o lead não tem Run/ProspectionSpec carregado pelo chamador. */
  available: boolean;
  runId: string | null;
  runStatus: string | null;
  target: unknown;
  location: unknown;
  what: unknown;
  discoveryStrategy: unknown;
  intentSignals: unknown;
  exclusions: unknown;
  dataRequired: unknown;
  scoringRules: unknown;
  stopCriteria: unknown;
};

export type FitBlock = {
  leadScore: number | null;
  fitReasons: string[];
  negativeSignals: string[];
};

export type IntentBlock = {
  intentLevel: string | null;
  intentSource: string | null;
  intentReasons: string[];
  /**
   * true quando intentLevel === "indeterminada" ou quando não há nenhum
   * reason registrado. Significa evidência insuficiente — NUNCA deve ser
   * lido como "baixa intenção" (regra explícita do V1).
   */
  isEvidenceInsufficient: boolean;
};

export type EvidenceItem = {
  source?: string;
  url?: string | null;
  type?: string;
  summary?: string;
};

export type EvidenceBlock = {
  /**
   * Evidência de listagem/fonte bruta (hoje: sempre o mesmo formato fixo
   * produzido em lib/lead-processor.ts — rating/reviews do Google Maps).
   * Isto é EVIDENCE no sentido literal (dado de fonte), mas não prova,
   * por si só, nenhum fitReason/intentReason específico.
   */
  listingEvidence: {
    evidence: EvidenceItem[];
    sources: string[];
    caveat: string;
  };
  /**
   * Conclusões (INTERPRETATION) já persistidas pelo Scoring Engine.
   * Ficam aqui separadas da evidência de listagem para não sugerir que uma
   * sustenta a outra — hoje elas não são rastreáveis entre si.
   */
  scoringInterpretation: {
    fitReasons: string[];
    intentReasons: string[];
    painReasons: string[];
    negativeSignals: string[];
    caveat: string;
  };
};

export type InformationGapCode =
  | "decision_maker_missing"
  | "role_missing"
  | "phone_missing"
  | "whatsapp_missing"
  | "email_missing"
  | "website_missing"
  | "industry_missing"
  | "subindustry_missing"
  | "address_missing"
  | "city_missing"
  | "neighborhood_missing"
  | "intent_evidence_missing";

export type InformationGap = {
  code: InformationGapCode;
  label: string;
};

export type InformationGapsBlock = {
  gaps: InformationGap[];
};

export type OperationalPriority = "ALTA" | "MEDIA" | "REVISAO_MANUAL";

export type OperationalPriorityBlock = {
  priority: OperationalPriority;
  /** Explica, em texto curto, qual regra determinou o valor acima. */
  rationale: string;
};

export type RecommendedActionBlock = {
  recommendedAction: string | null;
  recommendedChannel: string | null;
};

export type HistoryBlock = {
  events: LeadPackageFeedbackEventInput[];
  hasHistory: boolean;
};

export type CommercialStageBlock = {
  leadStatus: string;
  lastFeedbackEvent: LeadPackageFeedbackEventInput | null;
  hasHistory: boolean;
  /** Rótulo legível combinando status operacional + último evento, ou ausência explícita. */
  derivedStageLabel: string;
};

export type LeadPackage = {
  identification: IdentificationBlock;
  context: ContextBlock;
  fit: FitBlock;
  intent: IntentBlock;
  evidence: EvidenceBlock;
  informationGaps: InformationGapsBlock;
  operationalPriority: OperationalPriorityBlock;
  recommendedAction: RecommendedActionBlock;
  history: HistoryBlock;
  commercialStage: CommercialStageBlock;
};

// ---------------------------------------------------------------------------
// HELPERS INTERNOS (coerção segura de campos Json? sem assumir shape)
// ---------------------------------------------------------------------------

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function toEvidenceItems(value: unknown): EvidenceItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is EvidenceItem => typeof item === "object" && item !== null
  );
}

// ---------------------------------------------------------------------------
// DERIVAÇÃO — lacunas de informação
// ---------------------------------------------------------------------------

/**
 * Identifica campos relevantes ausentes no Lead, de forma conservadora.
 * Cada gap é apenas um FATO ("este campo está vazio"), não um julgamento de
 * qualidade — ausência de dado nunca deve virar "lead ruim" (regra do V1).
 */
export function deriveInformationGaps(
  lead: LeadPackageLeadInput
): InformationGapsBlock {
  const gaps: InformationGap[] = [];

  const check = (
    value: string | null,
    code: InformationGapCode,
    label: string
  ) => {
    if (!value || !value.trim()) gaps.push({ code, label });
  };

  check(lead.personName, "decision_maker_missing", "Nome do decisor não coletado.");
  check(lead.role, "role_missing", "Cargo do decisor não coletado.");
  check(lead.phone, "phone_missing", "Telefone não coletado.");
  check(lead.whatsapp, "whatsapp_missing", "WhatsApp não coletado.");
  check(lead.email, "email_missing", "E-mail não coletado.");
  check(lead.website, "website_missing", "Website não coletado.");
  check(lead.industry, "industry_missing", "Setor/indústria não identificado.");
  check(lead.subindustry, "subindustry_missing", "Subsetor não identificado.");
  check(lead.address, "address_missing", "Endereço não coletado.");
  check(lead.city, "city_missing", "Cidade não coletada.");
  check(lead.neighborhood, "neighborhood_missing", "Bairro não coletado.");

  const intentReasons = toStringArray(lead.intentReasons);
  const intentEvidenceMissing =
    lead.intentLevel === "indeterminada" || intentReasons.length === 0;

  if (intentEvidenceMissing) {
    gaps.push({
      code: "intent_evidence_missing",
      label:
        "Evidência de intenção insuficiente — não indica baixa intenção, apenas ausência de sinal identificado.",
    });
  }

  return { gaps };
}

// ---------------------------------------------------------------------------
// DERIVAÇÃO — prioridade operacional
// ---------------------------------------------------------------------------

const KNOWN_TEMPERATURES = new Set(["quente", "morno", "frio"]);

/**
 * Deriva uma prioridade OPERACIONAL (rótulo de apresentação), nunca um novo
 * score. Usa somente leadScore/temperature/confidenceScore/intentLevel/
 * status/negativeSignals já existentes.
 *
 * Regra determinística, em ordem (a primeira que bater decide o resultado):
 *  1. status === "DISCARDED"                          -> REVISAO_MANUAL (exclusão já identificada)
 *  2. leadScore/confidenceScore ausentes ou temperature
 *     fora do vocabulário conhecido                     -> REVISAO_MANUAL (dados de scoring incompletos)
 *  3. confidenceScore < 50                              -> REVISAO_MANUAL (confiança de dado insuficiente)
 *  4. intentLevel === "alta" && temperature === "frio"  -> REVISAO_MANUAL (conflito INTENT alta x FIT fraco;
 *                                                          a tensão não deve ser escondida atrás de um rótulo)
 *  5. temperature === "quente" && confidenceScore >= 70
 *     && negativeSignals vazio                          -> ALTA
 *  6. temperature === "morno" && confidenceScore >= 50   -> MEDIA
 *  7. qualquer outro caso (inclui "frio" sem conflito
 *     explícito, por não existir categoria "BAIXA" no V1) -> REVISAO_MANUAL
 */
export function deriveOperationalPriority(
  lead: LeadPackageLeadInput
): OperationalPriorityBlock {
  const negativeSignals = toStringArray(lead.negativeSignals);

  if (lead.status === "DISCARDED") {
    return {
      priority: "REVISAO_MANUAL",
      rationale: "Lead já marcado como descartado (exclusão identificada pelo scoring).",
    };
  }

  if (
    lead.leadScore === null ||
    lead.confidenceScore === null ||
    !lead.temperature ||
    !KNOWN_TEMPERATURES.has(lead.temperature)
  ) {
    return {
      priority: "REVISAO_MANUAL",
      rationale: "Dados de scoring incompletos ou temperatura fora do vocabulário conhecido.",
    };
  }

  if (lead.confidenceScore < 50) {
    return {
      priority: "REVISAO_MANUAL",
      rationale: "Confiança de dado insuficiente (confidenceScore < 50) para confiar no score.",
    };
  }

  if (lead.intentLevel === "alta" && lead.temperature === "frio") {
    return {
      priority: "REVISAO_MANUAL",
      rationale:
        "Conflito entre INTENT alta e FIT fraco (temperature frio) — tensão não deve ser escondida.",
    };
  }

  if (
    lead.temperature === "quente" &&
    lead.confidenceScore >= 70 &&
    negativeSignals.length === 0
  ) {
    return {
      priority: "ALTA",
      rationale: "Temperature quente, confiança >= 70 e sem sinais negativos registrados.",
    };
  }

  if (lead.temperature === "morno" && lead.confidenceScore >= 50) {
    return {
      priority: "MEDIA",
      rationale: "Temperature morno com confiança >= 50, sem conflito de sinais detectado.",
    };
  }

  return {
    priority: "REVISAO_MANUAL",
    rationale:
      "Nenhuma regra de ALTA/MEDIA aplicável com segurança; V1 não possui categoria de baixa prioridade dedicada.",
  };
}

// ---------------------------------------------------------------------------
// DERIVAÇÃO — estado comercial
// ---------------------------------------------------------------------------

const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "Novo",
  REVIEWED: "Revisado",
  CONTACTED: "Contatado",
  DISCARDED: "Descartado",
};

const FEEDBACK_EVENT_LABELS: Record<string, string> = {
  CONTACTED: "Contatado",
  RESPONDED: "Respondeu",
  INTERESTED: "Interessado",
  MEETING: "Reunião",
  PROPOSAL: "Proposta",
  SALE: "Venda",
  NO_RESPONSE: "Sem resposta",
  WRONG_DATA: "Dados errados",
  NO_FIT: "Sem fit",
  LOST: "Perdido",
};

function statusLabel(status: string): string {
  return LEAD_STATUS_LABELS[status] ?? status;
}

function eventLabel(eventType: string): string {
  return FEEDBACK_EVENT_LABELS[eventType] ?? eventType;
}

function toTimestamp(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * Deriva o estado comercial SOMENTE a partir de Lead.status e do
 * FeedbackEvent mais recente — não persiste nada novo, não altera
 * Lead.status, não inventa evento.
 */
export function deriveCommercialStage(
  leadStatus: string,
  feedbackEvents: LeadPackageFeedbackEventInput[]
): CommercialStageBlock {
  const hasHistory = feedbackEvents.length > 0;

  const lastFeedbackEvent = hasHistory
    ? feedbackEvents.reduce((latest, current) =>
        toTimestamp(current.createdAt) > toTimestamp(latest.createdAt)
          ? current
          : latest
      )
    : null;

  const derivedStageLabel = lastFeedbackEvent
    ? `${eventLabel(lastFeedbackEvent.eventType)} (status operacional: ${statusLabel(leadStatus)})`
    : `${statusLabel(leadStatus)} — sem histórico de contato registrado`;

  return {
    leadStatus,
    lastFeedbackEvent,
    hasHistory,
    derivedStageLabel,
  };
}

// ---------------------------------------------------------------------------
// FUNÇÃO PRINCIPAL
// ---------------------------------------------------------------------------

/**
 * Monta o Lead Package V1 em memória a partir de dados já carregados pelo
 * chamador. Não consulta banco, API, filesystem ou LLM — puramente
 * recombinação e derivação sobre o que já foi passado como argumento.
 *
 * `run`/`prospectionSpec` são opcionais porque um Lead pode, em tese, ser
 * inspecionado sem que o chamador tenha carregado o contexto de campanha —
 * nesse caso o bloco `context` vem com `available: false`, nunca inventado.
 */
export function buildLeadPackage(
  lead: LeadPackageLeadInput,
  run: LeadPackageRunInput | null,
  prospectionSpec: LeadPackageProspectionSpecInput | null,
  feedbackEvents: LeadPackageFeedbackEventInput[]
): LeadPackage {
  const identification: IdentificationBlock = {
    leadId: lead.id,
    companyName: lead.companyName,
    personName: lead.personName,
    role: lead.role,
    industry: lead.industry,
    subindustry: lead.subindustry,
    address: lead.address,
    city: lead.city,
    neighborhood: lead.neighborhood,
    phone: lead.phone,
    whatsapp: lead.whatsapp,
    email: lead.email,
    website: lead.website,
  };

  const context: ContextBlock = {
    available: Boolean(prospectionSpec),
    runId: run?.id ?? null,
    runStatus: run?.status ?? null,
    target: prospectionSpec?.target ?? null,
    location: prospectionSpec?.location ?? null,
    what: prospectionSpec?.what ?? null,
    discoveryStrategy: prospectionSpec?.discoveryStrategy ?? null,
    intentSignals: prospectionSpec?.intentSignals ?? null,
    exclusions: prospectionSpec?.exclusions ?? null,
    dataRequired: prospectionSpec?.dataRequired ?? null,
    scoringRules: prospectionSpec?.scoringRules ?? null,
    stopCriteria: prospectionSpec?.stopCriteria ?? null,
  };

  const fit: FitBlock = {
    leadScore: lead.leadScore,
    fitReasons: toStringArray(lead.fitReasons),
    negativeSignals: toStringArray(lead.negativeSignals),
  };

  const intentReasons = toStringArray(lead.intentReasons);
  const intent: IntentBlock = {
    intentLevel: lead.intentLevel,
    intentSource: lead.intentSource,
    intentReasons,
    isEvidenceInsufficient:
      lead.intentLevel === "indeterminada" || intentReasons.length === 0,
  };

  const evidence: EvidenceBlock = {
    listingEvidence: {
      evidence: toEvidenceItems(lead.evidence),
      sources: toStringArray(lead.sources),
      caveat:
        "Evidência de listagem/fonte bruta. Hoje é produzida com estrutura fixa " +
        "em lib/lead-processor.ts e não está ligada individualmente a nenhum " +
        "fitReason/intentReason específico — não deve ser lida como prova direta deles.",
    },
    scoringInterpretation: {
      fitReasons: toStringArray(lead.fitReasons),
      intentReasons,
      painReasons: toStringArray(lead.painReasons),
      negativeSignals: toStringArray(lead.negativeSignals),
      caveat:
        "Conclusões (INTERPRETATION) já produzidas pelo Scoring Engine e persistidas " +
        "no Lead. Este módulo não recalcula nem reinterpreta esses valores.",
    },
  };

  const informationGaps = deriveInformationGaps(lead);
  const operationalPriority = deriveOperationalPriority(lead);

  const recommendedAction: RecommendedActionBlock = {
    recommendedAction: lead.recommendedAction,
    recommendedChannel: lead.recommendedChannel,
  };

  const history: HistoryBlock = {
    events: feedbackEvents,
    hasHistory: feedbackEvents.length > 0,
  };

  const commercialStage = deriveCommercialStage(lead.status, feedbackEvents);

  return {
    identification,
    context,
    fit,
    intent,
    evidence,
    informationGaps,
    operationalPriority,
    recommendedAction,
    history,
    commercialStage,
  };
}
