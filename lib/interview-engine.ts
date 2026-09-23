import { callClaude, ClaudeMessage } from "./anthropic";

// Ver MASTER_SPEC_V2 Seção 6: a entrevista termina quando o perfil atinge
// este nível mínimo, não após um número fixo de perguntas.
export const READINESS_THRESHOLD = 80;

// FRAMEWORK UNIVERSAL → MASTER_SPEC_V2 Seção 07. Isto é o que o sistema
// pode investigar, não um roteiro de perguntas fixas.
const FRAMEWORK_UNIVERSAL = [
  "identidade do negócio", "tipo de profissional", "produto/serviço",
  "modelo de negócio", "cliente ideal", "ICP", "segmentos", "subsegmentos",
  "geografia", "tamanho do cliente", "capacidade financeira", "decisor",
  "dores", "necessidades", "intenção", "sinais de compra",
  "sinais de crescimento", "sinais de problema", "sinais de urgência",
  "características positivas", "características negativas", "exclusões",
  "recência", "fontes", "canais de contato", "critérios de score",
  "temperatura", "abordagem", "critério de sucesso", "restrições",
].join(", ");

// Campos do CLIENT_PROFILE → MASTER_SPEC_V2 Seção 15. O motor devolve, a
// cada turno, seu melhor entendimento cumulativo do perfil nesse formato.
const PROFILE_FIELDS = [
  "business_type", "professional_type", "industry", "subindustry",
  "products_services", "business_model", "ideal_customer", "icp",
  "target_segments", "priority_segments", "geography", "preferred_locations",
  "radius_km", "company_size", "employee_range", "revenue_range",
  "ticket_range", "decision_maker", "pain_points", "needs", "intent_signals",
  "buying_signals", "growth_signals", "urgency_signals",
  "positive_characteristics", "negative_characteristics", "exclusions",
  "preferred_sources", "preferred_channels", "contact_requirements",
  "recency_requirements", "scoring_preferences", "outreach_preferences",
  "success_definition", "constraints",
].join(", ");

type InterviewBranch = "b2b" | "b2c" | "autonomo" | "universal";

type CommercialFieldConfig = {
  field: string;
  priority: "P0" | "P1" | "P2";
  branches: InterviewBranch[];
  dependsOn?: string[];
  informationGain: number;
  branchInformationGain?: Partial<Record<InterviewBranch, number>>;
  branchPriority?: Partial<Record<InterviewBranch, CommercialFieldConfig["priority"]>>;
  conversationOrder?: number;
  inferable: boolean;
  readinessRequired?: {
    universal?: boolean;
    b2b?: boolean;
    b2c?: boolean;
    autonomo?: boolean;
  };
};

const COMMERCIAL_FIELD_CONFIG: CommercialFieldConfig[] = [
  { field: "business_type", priority: "P0", branches: ["universal"], informationGain: 100, conversationOrder: 10, inferable: true },
  { field: "professional_type", priority: "P0", branches: ["universal"], informationGain: 100, conversationOrder: 20, inferable: true },
  { field: "industry", priority: "P0", branches: ["universal"], informationGain: 95, conversationOrder: 40, inferable: true },
  { field: "subindustry", priority: "P1", branches: ["b2b", "b2c", "autonomo"], dependsOn: ["industry"], informationGain: 55, inferable: false },
  { field: "products_services", priority: "P0", branches: ["universal"], informationGain: 95, conversationOrder: 30, inferable: true },
  { field: "business_model", priority: "P1", branches: ["b2b", "b2c", "autonomo"], informationGain: 45, inferable: false },
  { field: "ideal_customer", priority: "P0", branches: ["universal"], informationGain: 100, conversationOrder: 50, inferable: false },
  { field: "icp", priority: "P0", branches: ["universal"], dependsOn: ["ideal_customer"], informationGain: 90, inferable: true },
  { field: "target_segments", priority: "P1", branches: ["b2b", "b2c", "autonomo"], dependsOn: ["ideal_customer"], informationGain: 75, inferable: false },
  { field: "priority_segments", priority: "P1", branches: ["b2b", "b2c", "autonomo"], dependsOn: ["target_segments"], informationGain: 70, inferable: false },
  { field: "geography", priority: "P0", branches: ["universal"], informationGain: 95, conversationOrder: 60, inferable: false },
  { field: "preferred_locations", priority: "P1", branches: ["universal"], dependsOn: ["geography"], informationGain: 65, inferable: false },
  { field: "radius_km", priority: "P2", branches: ["universal"], dependsOn: ["geography"], informationGain: 35, inferable: false },

  { field: "company_size", priority: "P1", branches: ["b2b", "autonomo"], dependsOn: ["ideal_customer"], informationGain: 75, branchInformationGain: { b2b: 95, autonomo: 90 }, branchPriority: { autonomo: "P0" }, conversationOrder: 35, inferable: false },
  { field: "employee_range", priority: "P1", branches: ["b2b", "autonomo"], dependsOn: ["company_size"], informationGain: 65, inferable: false },
  { field: "revenue_range", priority: "P1", branches: ["b2b", "autonomo"], dependsOn: ["company_size"], informationGain: 60, inferable: false },
  { field: "ticket_range", priority: "P1", branches: ["b2b", "b2c", "autonomo"], informationGain: 65, branchInformationGain: { b2c: 90, b2b: 65, autonomo: 70 }, branchPriority: { b2c: "P0" }, conversationOrder: 35, inferable: false },
  { field: "decision_maker", priority: "P1", branches: ["b2b", "b2c", "autonomo"], dependsOn: ["ideal_customer"], informationGain: 65, branchInformationGain: { b2b: 85, b2c: 55, autonomo: 80 }, inferable: false },

  { field: "pain_points", priority: "P0", branches: ["universal"], informationGain: 90, conversationOrder: 70, inferable: false },
  { field: "needs", priority: "P0", branches: ["universal"], dependsOn: ["pain_points"], informationGain: 85, conversationOrder: 80, inferable: true },
  { field: "intent_signals", priority: "P0", branches: ["universal"], informationGain: 90, conversationOrder: 90, inferable: false },
  { field: "buying_signals", priority: "P0", branches: ["universal"], dependsOn: ["intent_signals"], informationGain: 90, conversationOrder: 100, inferable: false },
  { field: "growth_signals", priority: "P1", branches: ["b2b", "autonomo"], informationGain: 55, inferable: false },
  { field: "urgency_signals", priority: "P1", branches: ["universal"], informationGain: 70, inferable: false },
  { field: "positive_characteristics", priority: "P1", branches: ["b2b", "b2c", "autonomo"], informationGain: 65, inferable: false },
  { field: "negative_characteristics", priority: "P1", branches: ["b2b", "b2c", "autonomo"], informationGain: 65, inferable: false },
  { field: "exclusions", priority: "P0", branches: ["universal"], informationGain: 85, inferable: false },

  { field: "preferred_sources", priority: "P2", branches: ["b2b", "b2c", "autonomo"], informationGain: 30, inferable: false },
  { field: "preferred_channels", priority: "P1", branches: ["universal"], informationGain: 55, inferable: false },
  { field: "contact_requirements", priority: "P1", branches: ["universal"], informationGain: 60, inferable: false },
  { field: "recency_requirements", priority: "P2", branches: ["universal"], informationGain: 30, inferable: false },
  { field: "scoring_preferences", priority: "P1", branches: ["universal"], informationGain: 65, inferable: false },
  { field: "outreach_preferences", priority: "P1", branches: ["universal"], informationGain: 55, inferable: false },
  { field: "success_definition", priority: "P1", branches: ["universal"], informationGain: 50, inferable: false },
  { field: "constraints", priority: "P1", branches: ["universal"], informationGain: 40, inferable: false },
];
const COMMERCIAL_QUESTION_MAP: Record<string, string> = {
  business_type: "Para começarmos, que tipo de negócio ou atividade profissional você exerce?",
  professional_type: "Como você define sua atividade profissional ou seu tipo de operação?",
  products_services: "Qual é o principal produto ou serviço que você oferece?",
  industry: "Em qual setor ou segmento sua empresa atua?",
  ideal_customer: "Quem é o cliente que você mais gostaria de conquistar?",
  icp: "Como você descreveria o perfil ideal desse cliente?",
  target_segments: "Quais segmentos específicos desse público são mais prioritários?",
  priority_segments: "Entre esses segmentos, quais devem receber maior prioridade?",
  geography: "Em quais cidades, regiões ou áreas você deseja encontrar esses potenciais clientes?",
  preferred_locations: "Quais bairros, regiões ou localidades devem ter preferência?",
  radius_km: "Qual raio geográfico máximo você deseja considerar?",
  company_size: "Que tamanho de empresa você deseja priorizar?",
  employee_range: "Qual faixa de número de funcionários é mais adequada ao seu cliente ideal?",
  revenue_range: "Qual faixa de faturamento melhor representa o cliente que você procura?",
  ticket_range: "Qual faixa de valor ou ticket é mais adequada para essa prospecção?",
  decision_maker: "Quem normalmente toma ou influencia a decisão de compra?",
  pain_points: "Quais problemas ou necessidades normalmente fazem esse cliente procurar uma solução como a sua?",
  needs: "O que esse cliente precisa resolver com maior prioridade?",
  intent_signals: "Que sinais indicariam que esse potencial cliente está realmente interessado ou pronto para contratar?",
  buying_signals: "Quais comportamentos indicam que esse cliente está próximo de tomar uma decisão de compra?",
  growth_signals: "Que sinais mostram que esse cliente está crescendo ou entrando em uma fase de maior necessidade?",
  urgency_signals: "Que situações indicariam urgência para esse cliente buscar uma solução?",
  positive_characteristics: "Quais características tornam um potencial cliente especialmente atraente para você?",
  negative_characteristics: "Quais características tornam um potencial cliente pouco interessante para você?",
  exclusions: "Quais perfis, situações ou tipos de empresa devem ser excluídos da prospecção?",
  preferred_sources: "Quais fontes ou canais você considera mais confiáveis para encontrar esses leads?",
  preferred_channels: "Por quais canais você prefere receber ou abordar esses potenciais clientes?",
  contact_requirements: "Quais dados de contato são indispensáveis em um lead qualificado?",
  recency_requirements: "Quão recentes precisam ser os dados ou sinais encontrados?",
  scoring_preferences: "O que deve pesar mais na pontuação e qualificação de um lead?",
  outreach_preferences: "Como você prefere abordar esses potenciais clientes?",
  success_definition: "Como você define uma prospecção bem-sucedida para esse negócio?",
  constraints: "Existe alguma restrição importante que devemos respeitar na prospecção?",
};

function getCommercialQuestion(field: string | null): string | null {
  if (!field) return null;
  return COMMERCIAL_QUESTION_MAP[field] || null;
}
const SYSTEM_PROMPT = `Você é o Interview Engine do Lead Intelligence Engine, uma ferramenta de captação e qualificação de leads.

SEU PAPEL
Conduzir uma entrevista adaptativa com o cliente para descobrir quem ele quer captar como lead. Você decide, a cada turno, qual é a MELHOR PRÓXIMA PERGUNTA → não existe questionário fixo.

FRAMEWORK UNIVERSAL (o que pode ser investigado, quando relevante → não é obrigatório cobrir tudo):
${FRAMEWORK_UNIVERSAL}

REGRAS
1. Nível 1 → identifique o tipo de negócio/profissional cedo, e adapte o resto da entrevista a isso. Uma arquiteta autônoma e uma contabilidade exigem perguntas completamente diferentes a partir daí.
2. Nível 2 → cada resposta deve mudar o que você pergunta a seguir. Nunca pergunte algo que já foi respondido, que pode ser inferido com segurança do que já foi dito, ou que pode ser descoberto depois por fontes públicas.
3. Escolha a próxima pergunta pelo critério de INFORMATION GAIN: o que mais aumenta a qualidade da futura prospecção (impacto no ICP, no score, nas exclusões, na estratégia de busca, no custo).
4. Respostas ambíguas ("qualquer empresa"): não assuma o sentido literal. Só aprofunde se isso afetar a prospecção de forma relevante.
5. Se o cliente disser "não sei" ou "decide você": tome a decisão mais coerente com o contexto, registre em "assumptions" com o motivo, e deixe claro para o cliente que foi uma decisão automática que pode ser mudada depois. NUNCA invente fatos verificáveis (nomes, números, dados que deveriam vir do cliente).
6. Nunca pergunte mais do que o necessário. A entrevista deve buscar informações suficientes para gerar uma especificação de prospecção confiável. O "profile_readiness" é apenas um indicador de completude de 0 a 100 e não determina sozinho o encerramento. Não marque "done": true apenas por atingir ${READINESS_THRESHOLD}; a decisão final de encerramento é feita pelo servidor com base nos requisitos comerciais obrigatórios. Enquanto houver informação obrigatória faltante, continue a entrevista e forneça a próxima pergunta adequada.
7. No primeiro turno (perfil ainda vazio), faça uma pergunta de abertura simples para identificar o tipo de negócio → não presuma nada.

FORMATO DE SAÍDA → responda SOMENTE com um JSON válido, sem markdown, sem texto fora do JSON, seguindo exatamente este formato:

{
  "profile": {
    // objeto cumulativo com o MELHOR entendimento atual do perfil.
    // use apenas os campos que já tem informação (mesmo que parcial/inferida): ${PROFILE_FIELDS}
    // listas viram arrays de strings; "negative_characteristics" e "exclusions" são arrays de
    // objetos { "trait": string, "action": "INCLUDE"|"PRIORITIZE"|"LOWER_SCORE"|"REVIEW"|"EXCLUDE" }
    // "recency_requirements" é um objeto { "<tipo_de_sinal>": <dias_maximos_numero> }
  },
  "interview_state": {
    "unknown_fields": [],       // campos ainda não descobertos e relevantes
    "inferred_fields": {},      // campos que você inferiu (não foram ditos literalmente), com o valor inferido
    "conflicting_fields": [],   // campos onde houve contradição entre respostas
    "confidence": {},           // confiança 0-1 por campo do profile que você preencheu
    "active_branch": "",        // ramo atual da investigação (ex.: "empresas", "autonomos", "geografia")
    "completed_branches": [],
    "pending_branches": []
  },
  "profile_readiness": 0,
  "next_question": "string ou null se done=true",
  "done": false,
  "assumptions": [
    // decisões que você tomou no lugar do cliente: { "field": "...", "decision": "...", "reasoning": "..." }
  ],
  "message_to_client": "opcional → só preencha se precisar explicar uma suposição feita antes de perguntar de novo"
}`;

function hasUsableValue(profile: Record<string, unknown>, field: string): boolean {
  const value = profile[field];

  if (value === undefined || value === null || value === "") return false;

  if (Array.isArray(value)) return value.length > 0;

  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }

  return true;
}

function getReadinessRequirements(
  profile: Record<string, unknown>
): {
  required: string[];
  missing: string[];
} {
  const branch = detectInterviewBranch(profile);

  const required = [
    "business_type",
    "industry",
    "products_services",
    "ideal_customer",
    "geography",
    "intent_signals",
    "exclusions",
  ];

  const hasPainOrNeed =
    hasUsableValue(profile, "pain_points") ||
    hasUsableValue(profile, "needs");

  if (!hasPainOrNeed) {
    required.push("pain_points");
  }

  if (branch === "autonomo") {
    required.push("professional_type");

    const idealCustomer = String(profile.ideal_customer || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    const autonomousCustomerIsB2B =
      idealCustomer.includes("empresa") ||
      idealCustomer.includes("empresas") ||
      idealCustomer.includes("pj") ||
      idealCustomer.includes("negocio") ||
      idealCustomer.includes("negocios");

    const autonomousCustomerIsB2C =
      idealCustomer.includes("pessoa fisica") ||
      idealCustomer.includes("pessoas fisicas") ||
      idealCustomer.includes("consumidor") ||
      idealCustomer.includes("cliente final");

    if (autonomousCustomerIsB2B) {
      required.push(
        "icp",
        "company_size",
        "decision_maker",
        "buying_signals"
      );
    } else if (autonomousCustomerIsB2C) {
      required.push("icp", "ticket_range");
    }
  } else if (branch === "b2b") {
    required.push(
      "icp",
      "company_size",
      "decision_maker",
      "buying_signals"
    );
  } else if (branch === "b2c") {
    required.push("icp", "ticket_range");
  }

  const uniqueRequired = [...new Set(required)];

  const missing = uniqueRequired.filter((field) => {
    if (field === "pain_points") {
      return !hasPainOrNeed;
    }

    return !hasUsableValue(profile, field);
  });

  return {
    required: uniqueRequired,
    missing,
  };
}
function detectInterviewBranch(
  profile: Record<string, unknown>
): InterviewBranch {
  const businessType = String(profile.business_type || "").toLowerCase();
  const professionalType = String(profile.professional_type || "").toLowerCase();
  const idealCustomer = String(profile.ideal_customer || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  if (
    businessType.includes("autônomo") ||
    businessType.includes("autonomo") ||
    businessType.includes("profissional liberal") ||
    professionalType.includes("autônomo") ||
    professionalType.includes("autonomo")
  ) {
    return "autonomo";
  }

  if (
    idealCustomer.includes("empresa") ||
    idealCustomer.includes("empresas") ||
    idealCustomer.includes("pj") ||
    idealCustomer.includes("negocio")
  ) {
    return "b2b";
  }

  if (
    idealCustomer.includes("pessoa fisica") ||
    idealCustomer.includes("pessoas fisicas") ||
    idealCustomer.includes("consumidor") ||
    idealCustomer.includes("cliente final")
  ) {
    return "b2c";
  }

  return "universal";
}

function isFieldEligible(
  config: CommercialFieldConfig,
  profile: Record<string, unknown>,
  branch: InterviewBranch
): boolean {
  const branchAllowed =
    config.branches.includes("universal") ||
    config.branches.includes(branch);

  if (!branchAllowed) return false;

  const dependenciesMet =
    !config.dependsOn ||
    config.dependsOn.every((dependency) =>
      hasUsableValue(profile, dependency)
    );

  return dependenciesMet;
}

function selectNextCommercialField(params: {
  profile: Record<string, unknown>;
  stateMeta: InterviewStateMeta;
}): string | null {
  const branch = detectInterviewBranch(params.profile);
  const completedBranches = new Set(params.stateMeta.completedBranches || []);


  if (
    hasUsableValue(params.profile, "products_services") &&
    !hasUsableValue(params.profile, "ideal_customer")
  ) {
    return "ideal_customer";
  }
  const readiness = getReadinessRequirements(params.profile);

  const missingRequiredField = COMMERCIAL_FIELD_CONFIG
    .filter((config) => readiness.missing.includes(config.field))
    .filter((config) => isFieldEligible(config, params.profile, branch))
    .filter((config) => config.field !== "icp")
    .sort((a, b) => {
      const priorityRank: Record<CommercialFieldConfig["priority"], number> = {
        P0: 3,
        P1: 2,
        P2: 1,
      };

      const priorityDifference =
        priorityRank[b.priority] - priorityRank[a.priority];

      if (priorityDifference !== 0) return priorityDifference;

      return (a.conversationOrder ?? 999) - (b.conversationOrder ?? 999);
    })[0];

  if (missingRequiredField) {
    return missingRequiredField.field;
  }
  const candidates = COMMERCIAL_FIELD_CONFIG
    .filter((config) => !hasUsableValue(params.profile, config.field))
    .filter((config) => config.field !== "icp")
    .filter((config) => isFieldEligible(config, params.profile, branch))
    .filter((config) => {
      const branchName =
        config.field === "business_type"
          ? "identidade do negócio"
          : config.field === "products_services"
            ? "produto/serviço"
            : config.field === "ideal_customer"
              ? "cliente ideal"
              : config.field === "geography"
                ? "geografia"
                : null;

      return !branchName || !completedBranches.has(branchName);
    })
    .sort((a, b) => {
      const priorityRank: Record<CommercialFieldConfig["priority"], number> = {
        P0: 3,
        P1: 2,
        P2: 1,
      };

      const effectivePriority = (config: CommercialFieldConfig) => {
        const idealCustomer = String(params.profile.ideal_customer || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();

        if (branch === "autonomo") {
          const autonomousCustomerIsB2B =
            idealCustomer.includes("empresa") ||
            idealCustomer.includes("empresas") ||
            idealCustomer.includes("pj") ||
            idealCustomer.includes("negocio") ||
            idealCustomer.includes("negocios");

          if (config.field === "company_size") {
            return autonomousCustomerIsB2B ? "P0" : config.priority;
          }

          if (config.field === "ticket_range") {
            return autonomousCustomerIsB2B ? config.priority : "P0";
          }
        }

        return config.branchPriority?.[branch] ?? config.priority;
      };

      const priorityDifference =
        priorityRank[effectivePriority(b)] - priorityRank[effectivePriority(a)];

      if (priorityDifference !== 0) return priorityDifference;

      const orderDifference = (a.conversationOrder ?? 999) - (b.conversationOrder ?? 999);

      if (orderDifference !== 0) return orderDifference;

      const gainForBranch = (config: CommercialFieldConfig) => config.branchInformationGain?.[branch] ?? config.informationGain;

      return gainForBranch(b) - gainForBranch(a);
    });

  return candidates[0]?.field || null;
}
export type InterviewStateMeta = {
  unknownFields: string[];
  inferredFields: Record<string, unknown>;
  conflictingFields: string[];
  confidence: Record<string, number>;
  activeBranch: string | null;
  commercialBranch?: InterviewBranch;
  completedBranches: string[];
  pendingBranches: string[];
};

export type EngineTurnResult = {
  profile: Record<string, unknown>;
  interviewState: InterviewStateMeta;
  profileReadiness: number;
  nextQuestion: string | null;
  nextCommercialField: string | null;
  done: boolean;
  assumptions: Array<{ field: string; decision: string; reasoning: string }>;
  messageToClient: string | null;
};

export function emptyStateMeta(): InterviewStateMeta {
  return {
    unknownFields: [],
    inferredFields: {},
    conflictingFields: [],
    confidence: {},
    activeBranch: null,
    completedBranches: [],
    pendingBranches: [],
  };
}

function parseEngineOutput(raw: string, profileDraft: Record<string, unknown> = {}): EngineTurnResult {
  // O modelo pode, ocasionalmente, envolver o JSON em ```json ... ``` mesmo
  // com instrução em contrário → removemos isso defensivamente.
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
      `Falha ao interpretar resposta do Interview Engine como JSON. Início da resposta: ${cleaned.slice(
        0,
        300
      )}`
    );
  }

  if (typeof parsed.profile_readiness !== "number") {
    throw new Error("Resposta do Interview Engine sem profile_readiness numérico.");
  }

  const readiness = Math.max(0, Math.min(100, Math.round(parsed.profile_readiness)));

  const mergedProfile = {
    ...profileDraft,
    ...Object.fromEntries(
      Object.entries(parsed.profile || {}).filter(
        ([, value]) => value !== null && value !== undefined && value !== ""
      )
    ),
  };

  const state = parsed.interview_state || {};
  const commercialBranch = detectInterviewBranch(mergedProfile);
  const readinessRequirements = getReadinessRequirements(mergedProfile);

  // READY é uma decisão comercial determinística do servidor.
  // profile_readiness continua sendo apenas um indicador de completude.
  const done = readinessRequirements.missing.length === 0;

  const nextCommercialField = done
    ? null
    : selectNextCommercialField({
        profile: mergedProfile,
        stateMeta: {
          unknownFields: state.unknown_fields || [],
          inferredFields: state.inferred_fields || {},
          conflictingFields: state.conflicting_fields || [],
          confidence: state.confidence || {},
          activeBranch: state.active_branch || null,
          completedBranches: state.completed_branches || [],
          pendingBranches: state.pending_branches || [],
        },
      });

  const commercialQuestion = getCommercialQuestion(nextCommercialField);

  return {
    profile: parsed.profile || {},
    interviewState: {
      unknownFields: state.unknown_fields || [],
      inferredFields: state.inferred_fields || {},
      conflictingFields: state.conflicting_fields || [],
      confidence: state.confidence || {},
      activeBranch: state.active_branch || null,
      commercialBranch,
      completedBranches: state.completed_branches || [],
      pendingBranches: state.pending_branches || [],
    },
    profileReadiness: readiness,
    nextQuestion: done ? null : commercialQuestion || parsed.next_question || null,
    nextCommercialField,
    done,
    assumptions: parsed.assumptions || [],
    messageToClient: parsed.message_to_client || null,
  };
}

export async function runInterviewTurn(params: {
  businessName: string;
  profileDraft: Record<string, unknown>;
  stateMeta: InterviewStateMeta;
  transcript: ClaudeMessage[];
  lastClientMessage: string | null;
  previousCommercialField?: string | null;
}): Promise<EngineTurnResult> {
  const contextPayload = {
    business_name: params.businessName,
    current_profile_draft: params.profileDraft,
    current_interview_state: params.stateMeta,
    previous_commercial_field: params.previousCommercialField || null,
    commercial_instruction:
      params.previousCommercialField
        ? "Interprete a resposta atual prioritariamente como resposta ao campo comercial anterior indicado em previous_commercial_field. Preserve todos os campos já preenchidos e não repita a pergunta desse campo se a resposta fornecer um valor utilizável."
        : null,
    instruction: params.lastClientMessage
      ? "O cliente respondeu à última pergunta. Interprete a resposta, atualize o perfil e decida a próxima pergunta (ou conclua, se profile_readiness já for suficiente)."
      : "Esta é a primeira interação. Gere apenas a pergunta de abertura, com o perfil ainda vazio.",
  };

  const messages: ClaudeMessage[] = [
    ...params.transcript,
    {
      role: "user",
      content: params.lastClientMessage
        ? `CONTEXTO_ATUAL: ${JSON.stringify(contextPayload)}\n\nRESPOSTA_DO_CLIENTE: ${params.lastClientMessage}`
        : `CONTEXTO_ATUAL: ${JSON.stringify(contextPayload)}`,
    },
  ];

  const raw = await callClaude({ system: SYSTEM_PROMPT, messages });
  console.log("=== DEBUG RAW INTERVIEW ===");
  console.log("raw:", raw);
  console.log("rawCodePoints:", [...raw].filter((c) => /[^\x00-\x7F]/.test(c)).map((c) => `${c}=U+${c.codePointAt(0)?.toString(16).toUpperCase()}`));
  console.log("===========================");
  return parseEngineOutput(raw, params.profileDraft);
}



export { detectInterviewBranch, selectNextCommercialField };

























































