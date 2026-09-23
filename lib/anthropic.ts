const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const ANTHROPIC_MODE = process.env.ANTHROPIC_MODE || "real";

export type ClaudeMessage = {
  role: "user" | "assistant";
  content: string;
};

/**
 * MOCK da entrevista.
 */
function mockInterviewResponse(params: {
  messages: ClaudeMessage[];
}): string {
  const transcript = params.messages;

  const contextMessage = [...transcript]
    .reverse()
    .find(
      (message) =>
        message.role === "user" &&
        message.content.includes("CONTEXTO_ATUAL:")
    );

  let context: {
    current_profile_draft?: Record<string, unknown>;
    current_interview_state?: {
      unknownFields?: string[];
      inferredFields?: Record<string, unknown>;
      conflictingFields?: string[];
      confidence?: Record<string, number>;
      activeBranch?: string | null;
      completedBranches?: string[];
      pendingBranches?: string[];
    };
    instruction?: string;
  } = {};

  if (contextMessage) {
    const marker = "CONTEXTO_ATUAL:";
    const markerIndex = contextMessage.content.indexOf(marker);

    if (markerIndex >= 0) {
      const rawContext = contextMessage.content
        .slice(markerIndex + marker.length)
        .split("\n\nRESPOSTA_DO_CLIENTE:")[0]
        .trim();

      try {
        context = JSON.parse(rawContext);
      } catch {
        context = {};
      }
    }
  }

  const profile: Record<string, unknown> = {
    ...(context.current_profile_draft || {}),
  };

  const previousState = context.current_interview_state || {};
  const currentMessage = contextMessage?.content.match(
    /RESPOSTA_DO_CLIENTE:\s*([\s\S]+)$/
  )?.[1]?.trim() || "";

  const normalized = currentMessage
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const has = (...terms: string[]) =>
    terms.some((term) => normalized.includes(term));

  const setIfMissing = (field: string, value: unknown) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      profile[field] === undefined
    ) {
      profile[field] = value;
    }
  };

  const appendUnique = (field: string, value: string) => {
    if (!value) return;

    const current = Array.isArray(profile[field])
      ? (profile[field] as unknown[]).filter(
          (item): item is string => typeof item === "string"
        )
      : [];

    if (!current.includes(value)) {
      profile[field] = [...current, value];
    }
  };

  /*
   * MOCK conservador:
   * - preserva integralmente o profile acumulado;
   * - tenta identificar informações explícitas na resposta atual;
   * - não inventa indústria, cidade, segmento ou números;
   * - usa o ramo/pergunta anterior como contexto quando possível.
   */

  const previousQuestion = [...transcript]
  .reverse()
  .find(
    (message) =>
      message.role === "assistant" &&
      (
        message.content.includes("next_question") ||
        message.content.includes("nextQuestion")
      )
  );

let previousQuestionText = "";
if (previousQuestion) {
  try {
    const parsedPrevious = JSON.parse(previousQuestion.content);

    previousQuestionText =
      typeof parsedPrevious.next_question === "string"
        ? parsedPrevious.next_question
        : typeof parsedPrevious.nextQuestion === "string"
          ? parsedPrevious.nextQuestion
          : "";
  } catch {
    previousQuestionText = "";
  }
}

  const questionNormalized = previousQuestionText
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (
    !profile.business_type &&
    (has("sou ", "tenho uma", "minha empresa", "meu negocio") ||
      questionNormalized.includes("tipo de negocio"))
  ) {
    if (
      !has("empresa", "escritorio", "loja", "clinica", "agencia") &&
      has(
        "autonomo",
        "autonoma",
        "profissional liberal",
        "freelancer",
        "consultor autonomo"
      )
    ) {
      setIfMissing("business_type", "profissional autônomo");
      setIfMissing("professional_type", "autônomo");
    } else if (has("empresa", "escritorio", "loja", "clinica", "agencia")) {
      setIfMissing("business_type", "empresa");
    }
  }

  if (
    !profile.professional_type &&
    (questionNormalized.includes("profissional") ||
      questionNormalized.includes("tipo de negocio"))
  ) {
    if (
      has(
        "autonomo",
        "autonoma",
        "profissional liberal",
        "freelancer",
        "consultor autonomo"
      )
    ) {
      setIfMissing("professional_type", "autônomo");
    } else if (has("empresa", "sociedade", "escritorio", "clinica", "loja")) {
      setIfMissing("professional_type", "empresa");
    }
  }

  /*
   * Extração explícita independente da pergunta:
   * se o cliente fornecer espontaneamente uma informação relevante,
   * preservamos essa informação mesmo que ela pertença a outro ramo
   * da entrevista. A pergunta anterior continua servindo apenas
   * como contexto para interpretar a resposta.
   */

  /*
   * Extração explícita do decisor.
   * Só preenche quando a resposta identifica claramente
   * quem toma ou influencia a decisão de compra.
   */
  if (!profile.decision_maker) {
    const decisionMakerSignals = [
      "proprietario",
      "proprietária",
      "proprietario da empresa",
      "proprietária da empresa",
      "dono",
      "dona",
      "socio",
      "sócio",
      "socia",
      "sócia",
      "responsavel financeiro",
      "responsável financeiro",
      "responsavel pela decisao",
      "responsável pela decisão",
      "diretor",
      "diretora",
      "gestor",
      "gestora",
      "administrador",
      "administradora",
      "quem decide",
      "toma a decisao",
      "toma a decisão",
    ];

    if (decisionMakerSignals.some((signal) =>
      normalized.includes(
        signal.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      )
    )) {
      setIfMissing("decision_maker", currentMessage);
    }
  }
  if (!profile.products_services) {
    const serviceTerms = [
      "presto servicos",
      "prestamos servicos",
      "ofereco",
      "oferecemos",
      "trabalho com",
      "atuo com",
      "atuamos com",
      "vendo",
      "vendemos",
      "produto",
      "servico",
      "servicos",
    ];

    if (
      serviceTerms.some((term) => normalized.includes(term)) ||
      questionNormalized.includes("produto") ||
      questionNormalized.includes("servico") ||
      questionNormalized.includes("oferece")
    ) {
      setIfMissing("products_services", currentMessage);
    }
  }


  /*
   * Extração explícita do cliente ideal/ICP.
   * O MOCK só deve preencher estes campos quando a pergunta atual
   * estiver tratando diretamente de cliente ideal ou público-alvo.
   */
  if (!profile.ideal_customer) {
    const idealCustomerQuestion =
      questionNormalized.includes("cliente ideal") ||
      questionNormalized.includes("tipo de empresa") ||
      questionNormalized.includes("quem voce quer") ||
      questionNormalized.includes("quem e o cliente") ||
      questionNormalized.includes("cliente que voce mais gostaria") ||
      questionNormalized.includes("gostaria de conquistar") ||
      questionNormalized.includes("quer conquistar") ||
      questionNormalized.includes("publico alvo") ||
      questionNormalized.includes("clientes que") ||
      questionNormalized.includes("clientes para");

    if (idealCustomerQuestion) {
      setIfMissing("ideal_customer", currentMessage);
      setIfMissing("icp", currentMessage);
    }
  }

  /*
   * Extração explícita do porte da empresa.
   * Só preenche company_size quando a pergunta atual
   * estiver tratando diretamente do tamanho/porte do cliente.
   */
  if (!profile.company_size) {
    const companySizeSignals = [
      "microempresa",
      "microempresas",
      "micro empresa",
      "micro empresas",
      "pequena empresa",
      "pequenas empresas",
      "pequeno porte",
      "pequeno porte empresarial",
      "media empresa",
      "medias empresas",
      "média empresa",
      "médias empresas",
      "grande empresa",
      "grandes empresas",
      "mei",
      "meis",
    ];

    if (
      questionNormalized.includes("tamanho de empresa") ||
      questionNormalized.includes("porte da empresa") ||
      questionNormalized.includes("tamanho da empresa")
    ) {
      const matchedCompanySize = companySizeSignals.find((signal) =>
        normalized.includes(
          signal.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
        )
      );

      if (matchedCompanySize) {
        setIfMissing("company_size", currentMessage);
      }
    }
  }
  /*
   * Extração explícita da faixa de funcionários.
   * Captura quantidades informadas pelo cliente sem inferir
   * automaticamente o porte da empresa.
   */
  if (!profile.employee_range) {
    const employeeRangeQuestion =
      questionNormalized.includes("funcionario") ||
      questionNormalized.includes("funcionarios") ||
      questionNormalized.includes("numero de funcionarios") ||
      questionNormalized.includes("quantidade de funcionarios") ||
      questionNormalized.includes("faixa de funcionarios");

    const employeeRangeAnswer =
      /\b(?:ate|até|mais de|menos de|entre|de)\s+\d+(?:\s*(?:e|a|-)\s*\d+)?\s*(?:funcionario|funcionarios)\b/i.test(normalized) ||
      /\b\d+\s*(?:ou menos|ou mais)\s*(?:funcionario|funcionarios)\b/i.test(normalized) ||
      /\b\d+\s*(?:funcionario|funcionarios)\b/i.test(normalized);

    if (employeeRangeQuestion || employeeRangeAnswer) {
      if (employeeRangeAnswer) {
        setIfMissing("employee_range", currentMessage);
      }
    }
  }

  /*
   * Extração explícita de geografia.
   * A localização só deve ser capturada quando a pergunta atual
   * estiver solicitando diretamente cidade, região ou localidade
   * para a prospecção.
   */
  if (!profile.geography) {
    const geographyQuestion =
      questionNormalized.includes("cidade") ||
      questionNormalized.includes("regiao") ||
      questionNormalized.includes("geografia") ||
      questionNormalized.includes("onde") ||
      questionNormalized.includes("localizacao") ||
      questionNormalized.includes("localidade");

    if (geographyQuestion) {
      const geographyValue = currentMessage;

      setIfMissing("geography", geographyValue);
      setIfMissing("preferred_locations", [geographyValue]);
    }
  }

  if (
    !profile.pain_points &&
    (questionNormalized.includes("problema") ||
      questionNormalized.includes("dor") ||
      questionNormalized.includes("necessidade"))
  ) {
    appendUnique("pain_points", currentMessage);
    appendUnique("needs", currentMessage);
  }

  if (
    !profile.intent_signals &&
    (questionNormalized.includes("interessada") ||
      questionNormalized.includes("interesse") ||
      questionNormalized.includes("pronta") ||
      questionNormalized.includes("sinais"))
  ) {
    appendUnique("intent_signals", currentMessage);
    appendUnique("buying_signals", currentMessage);
  }

  if (
    !profile.exclusions &&
    (questionNormalized.includes("exclu") ||
      questionNormalized.includes("nao quer") ||
      questionNormalized.includes("não quer"))
  ) {
    profile.exclusions = [
      {
        trait: currentMessage,
        action: "EXCLUDE",
      },
    ];
  }

  /*
   * Algumas inferências de baixo risco, somente quando a resposta é explícita.
   */
  if (
    !profile.business_type &&
    has("sou uma empresa", "somos uma empresa", "tenho uma empresa")
  ) {
    profile.business_type = "empresa";
  }

  if (
    !profile.business_type &&
    has("sou autonomo", "sou autonoma", "trabalho como autonomo")
  ) {
    profile.business_type = "profissional autônomo";
    profile.professional_type = "autônomo";
  }

  /*
   * Identificação simples de alguns setores apenas quando o próprio cliente
   * os menciona explicitamente.
   */
  const explicitIndustries: Array<[string, string[]]> = [
    ["contabilidade", ["contabilidade", "contador", "contadora", "contabil"]],
    ["odontologia", ["dentista", "odontologia", "clinica odontologica"]],
    ["arquitetura", ["arquiteto", "arquiteta", "arquitetura"]],
    ["advocacia", ["advogado", "advogada", "advocacia"]],
    ["marketing", ["agencia de marketing", "marketing digital"]],
    ["tecnologia", ["software", "tecnologia", "sistema", "saas"]],
  ];

  if (!profile.industry) {
    for (const [industry, terms] of explicitIndustries) {
      if (has(...terms)) {
        profile.industry = industry;
        break;
      }
    }
  }

  /*
   * Se a resposta for claramente uma lista de segmentos, preservamos como
   * segmentos. Não tentamos decompor semanticamente sem evidência.
   */
  if (
    !profile.target_segments &&
    (questionNormalized.includes("segmento") ||
      questionNormalized.includes("cliente ideal"))
  ) {
    profile.target_segments = [currentMessage];
  }
 
  /*
   * Extração explícita de faixa de valor/ticket.
   * Só preenche ticket_range quando:
   * 1) a pergunta atual trata diretamente de ticket/preço/valor; ou
   * 2) a resposta informa um valor monetário objetivo.
   *
   * Evita falso positivo em respostas que apenas mencionam
   * palavras como "preço" ou "valor" dentro de outros contextos.
   */
  if (!profile.ticket_range) {
    const asksForTicket =
      questionNormalized.includes("ticket") ||

      questionNormalized.includes("preco") ||
      questionNormalized.includes("mensalidade");

    const hasObjectiveMoneyValue =
      /r\$\s*\d[\d.]*(?:,\d{1,2})?/i.test(currentMessage) ||
      /\b\d[\d.]*\s*(?:reais|real)\b/i.test(normalized);

    if (asksForTicket || hasObjectiveMoneyValue) {
      setIfMissing("ticket_range", currentMessage);
    }
  }

  /*
   * Estado cumulativo.
   */
  const knownFields = Object.keys(profile).filter(
    (field) =>
      profile[field] !== undefined &&
      profile[field] !== null &&
      profile[field] !== ""
  );

  const coreFields = [
    "business_type",
    "professional_type",
    "products_services",
    "ideal_customer",
    "icp",
    "geography",
    "pain_points",
    "needs",
    "intent_signals",
    "buying_signals",
  ];

  const knownCore = coreFields.filter((field) => {
    const value = profile[field];
    return (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      (!Array.isArray(value) || value.length > 0)
    );
  });

  const unknownFields = coreFields.filter(
    (field) => !knownCore.includes(field)
  );

  let readiness = Math.round((knownCore.length / coreFields.length) * 80);

  if (profile.industry) readiness += 5;
  if (profile.target_segments) readiness += 5;
  if (profile.preferred_locations) readiness += 5;
  if (profile.exclusions) readiness += 5;

  readiness = Math.min(100, readiness);

  /*
   * Não encerra prematuramente: o MOCK precisa ter informação suficiente
   * para gerar uma especificação de prospecção útil.
   */
  const done =
    readiness >= 80 &&
    !!profile.products_services &&
    !!profile.ideal_customer &&
    !!profile.geography &&
    (!!profile.pain_points || !!profile.needs);

  let nextQuestion: string | null = null;
  let activeBranch = previousState.activeBranch || "identidade do negócio";


  const completedBranches = Array.isArray(previousState.completedBranches)
    ? [...previousState.completedBranches]
    : [];

  const branchByField: Array<[string, string]> = [
    ["business_type", "identidade do negócio"],
    ["products_services", "produto/serviço"],
    ["ideal_customer", "cliente ideal"],
    ["geography", "geografia"],
    ["pain_points", "dores e necessidades"],
    ["intent_signals", "intenção e sinais de compra"],
  ];

  for (const [field, branch] of branchByField) {
    const value = profile[field];
    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      !completedBranches.includes(branch)
    ) {
      completedBranches.push(branch);
    }
  }

  const pendingBranches = [
    "identidade do negócio",
    "produto/serviço",
    "cliente ideal",
    "geografia",
    "dores e necessidades",
    "intenção e sinais de compra",
  ].filter((branch) => !completedBranches.includes(branch));

  const inferredFields: Record<string, unknown> = {
    ...(previousState.inferredFields || {}),
  };

  if (
    profile.business_type === "profissional autônomo" &&
    !inferredFields.business_type
  ) {
    inferredFields.business_type = "profissional autônomo";
  }

  const confidence: Record<string, number> = {
    ...(previousState.confidence || {}),
  };

  for (const field of knownFields) {
    if (confidence[field] === undefined) {
      confidence[field] = inferredFields[field] !== undefined ? 0.75 : 0.95;
    }
  }

  return JSON.stringify({
    profile,
    interview_state: {
      unknown_fields: unknownFields,
      inferred_fields: inferredFields,
      conflicting_fields: previousState.conflictingFields || [],
      confidence,
      active_branch: activeBranch,
      completed_branches: completedBranches,
      pending_branches: pendingBranches,
    },
    profile_readiness: readiness,
    next_question: done ? null : nextQuestion,
    done,
    assumptions: [],
    message_to_client: null,
  });
}
function mockProspectionResponse(params: {
  messages: ClaudeMessage[];
}): string {
  const userMessage =
    params.messages.find((message) => message.role === "user")?.content || "";

  const marker = "CLIENT_PROFILE aprovado:";

  let profile: any = {};

  if (userMessage.includes(marker)) {
    const jsonText = userMessage
      .split(marker)
      .slice(1)
      .join(marker)
      .trim();

    try {
      profile = JSON.parse(jsonText);
    } catch {
      profile = {};
    }
  }

  const industry =
    typeof profile.industry === "string" && profile.industry.trim()
      ? profile.industry.trim()
      : "empresas";

  const professionalType =
    typeof profile.professionalType === "string" &&
    profile.professionalType.trim()
      ? profile.professionalType.trim()
      : "empresa";

  const productsServices =
    typeof profile.productsServices === "string" &&
    profile.productsServices.trim()
      ? profile.productsServices.trim()
      : "";

  const idealCustomer =
    typeof profile.idealCustomer === "string" &&
    profile.idealCustomer.trim()
      ? profile.idealCustomer.trim()
      : "";

  const targetSegments = Array.isArray(profile.targetSegments)
    ? profile.targetSegments
    : [];

  const geography =
    typeof profile.geography === "string" && profile.geography.trim()
      ? profile.geography.trim()
      : "";

  const preferredLocations = Array.isArray(profile.preferredLocations)
    ? profile.preferredLocations
    : [];

  const targetDescription =
    idealCustomer || `Potenciais clientes de ${industry}`;

  const structuredSegments =
    targetSegments.length > 0
      ? targetSegments.flatMap((segment: unknown) => {
          if (typeof segment !== "string") return [];

          const text = segment.trim();

          if (!text) return [];

          const normalizedText = text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

          const isSmallMediumBusiness =
            normalizedText.includes("pequenas e medias empresas") ||
            (
              normalizedText.includes("pequenas") &&
              normalizedText.includes("empresas") &&
              normalizedText.includes("medias")
            ) ||
            (
              text.toLowerCase().includes("pequenas") &&
              text.toLowerCase().includes("empresas") &&
              text.toLowerCase().includes("m") &&
              text.toLowerCase().includes("dias")
            );

          const isServices =
            normalizedText.includes("empresas de servicos") ||
            (
              normalizedText.includes("empresas") &&
              normalizedText.includes("servic")
            ) ||
            (
              text.toLowerCase().includes("empresas") &&
              text.toLowerCase().includes("servi")
            );

          const isCommerce =
            normalizedText.includes("comercio") ||
            (
              normalizedText.includes("empresas") &&
              normalizedText.includes("comerc")
            ) ||
            (
              text.toLowerCase().includes("com") &&
              text.toLowerCase().includes("rcio")
            );

          if (
            isSmallMediumBusiness &&
            isServices &&
            isCommerce
          ) {
            return [
              "pequenas e médias empresas",
              "empresas de serviços",
              "comércio",
            ];
          }

          return [text];
        })
      : [];

  const locationDescription =
    preferredLocations.length > 0
      ? preferredLocations.join("; ")
      : geography || "Geografia não especificada";

  return JSON.stringify({
    target: {
  business_type: professionalType,
  ideal_customer: idealCustomer,
  segments: structuredSegments,
  description: targetDescription
},

    location: {
      description: locationDescription,
      geography,
      preferred_locations: preferredLocations
    },

    what: {
      industry,
      products_services: productsServices,
      search_term: industry,
      description: productsServices || `Empresas relacionadas a ${industry}`
    },

    discovery_strategy: {
      primary_sources: [
        "Google Maps",
        "Google Search",
        "sites públicos das empresas"
      ],
      rationale:
        "Priorizar fontes públicas com dados estruturais de empresas, endereço, telefone e website."
    },

    intent_signals: Array.from(
      new Set([
        ...(Array.isArray(profile.intentSignals) ? profile.intentSignals : []),
        ...(Array.isArray(profile.buyingSignals) ? profile.buyingSignals : [])
      ])
    ),
    pain_points: Array.isArray(profile.painPoints)
      ? profile.painPoints
      : [],
    needs: Array.isArray(profile.needs)
      ? profile.needs
      : [],

    buying_signals: Array.isArray(profile.buyingSignals)
      ? profile.buyingSignals
      : [],

    exclusions: Array.isArray(profile.exclusions)
      ? profile.exclusions
      : [],


    data_required: [
      {
        field: "company_name",
        reliability: "high"
      },
      {
        field: "address",
        reliability: "high"
      },
      {
        field: "phone",
        reliability: "high"
      },
      {
        field: "website",
        reliability: "high"
      },
      {
        field: "industry",
        reliability: "high"
      },
      {
        field: "decision_maker",
        reliability: "best_effort"
      },
      {
        field: "whatsapp",
        reliability: "best_effort"
      }
    ],

    scoring_rules: {
      scale: "0-100",
      fit: {
        weight: 70,
        description: "Aderência ao ICP, segmento e setor definidos no ClientProfile."
      },
      data_confidence: {
        weight: 30,
        description:
          "Confiabilidade dos dados públicos encontrados para o lead."
      },
      temperature: {
        hot: ">=70",
        warm: "40-69",
        cold: "<40"
      }
    },

    stop_criteria: {
      mode: "validation",
      target_leads: 30,
      reason:
        "Executar uma primeira coleta pequena para validar qualidade e aderência antes de escalar."
    }
  });
}

/**
 * MOCK do Scoring Engine.
 *
 * Mantido simples nesta etapa. A finalidade é permitir a continuidade
 * dos testes sem consumir créditos da Anthropic.
 */
/**
 * MOCK do Scoring Engine.
 *
 * Scoring determinístico para validação do pipeline sem consumir
 * créditos da Anthropic.
 *
 * A lógica usa somente dados estruturais disponíveis no lead.
 * Não inventa intenção ou dor.
 */
function mockScoringResponse(params: {
  messages: ClaudeMessage[];
}): string {
  const userMessage =
    params.messages.find((message) => message.role === "user")?.content || "";

  const specMatch = userMessage.match(
    /PROSPECTION_SPEC \(campos relevantes\):\s*([\s\S]*?)\s*LEADS_BRUTOS/
  );

  const leadsMatch = userMessage.match(
    /LEADS_BRUTOS \((\d+) itens\):\s*([\s\S]*)$/
  );

  let spec: any = {};

  if (specMatch) {
    try {
      spec = JSON.parse(specMatch[1].trim());
    } catch {
      spec = {};
    }
  }

  let leads: any[] = [];

  if (leadsMatch) {
    try {
      const parsed = JSON.parse(leadsMatch[2].trim());
      leads = Array.isArray(parsed) ? parsed : [];
    } catch {
      leads = [];
    }
  }

  const target = spec.target || {};
  const what = spec.what || {};
  const exclusions = Array.isArray(spec.exclusions)
    ? spec.exclusions
    : [];

  const targetIndustry =
    typeof what.industry === "string"
      ? what.industry.toLowerCase().trim()
      : "";

  const targetBusinessType =
    typeof target.business_type === "string"
      ? target.business_type.toLowerCase().trim()
      : "";

  const targetSegments = Array.isArray(target.segments)
    ? target.segments
        .filter((value: unknown) => typeof value === "string")
        .map((value: string) => value.toLowerCase().trim())
    : [];

  function textIncludes(text: unknown, term: string): boolean {
    if (!term) return false;

    return (
      typeof text === "string" &&
      text.toLowerCase().includes(term)
    );
  }

  function normalizeForMatch(value: unknown): string {
    if (typeof value !== "string") return "";

    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function isRelatedIndustry(
    leadIndustry: string,
    targetIndustry: string
  ): boolean {
    const lead = normalizeForMatch(leadIndustry);
    const target = normalizeForMatch(targetIndustry);

    if (!lead || !target) return false;

    if (target === "contabilidade") {
      const accountingTerms = [
        "contabilidade",
        "contabil",
        "contabeis",
        "escrituracao",
        "assessoria contabil",
        "consultoria contabil",
        "servico contabil",
        "servicos contabeis",
        "escritorio de contabilidade"
      ];

      return accountingTerms.some((term) => lead.includes(term));
    }

    return (
      lead.includes(target) ||
      target.includes(lead)
    );
  }

  function matchesExclusion(lead: any, exclusion: any): boolean {
    const trait =
      typeof exclusion?.trait === "string"
        ? exclusion.trait.toLowerCase().trim()
        : "";

    if (!trait) return false;

    const searchableText = [
      lead.company_name,
      lead.industry,
      lead.address,
      lead.city
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(trait);
  }

  const results = leads.map((lead: any, index: number) => {
    const industry = String(lead.industry || "").toLowerCase().trim();
    const companyName = String(lead.company_name || "").toLowerCase().trim();
    const address = String(lead.address || "").trim();
    const city = String(lead.city || "").trim();
    const phone = String(lead.phone || "").trim();
    const website = String(lead.website || "").trim();

    let fitPoints = 0;

    const fitReasons: string[] = [];
    const negativeSignals: string[] = [];

    // FIT = 70 pontos
    // ICP / segmento = 40
    // Geografia = 20
    // Perfil / tipo = 10

    const normalizedIndustry = normalizeForMatch(industry);
    const normalizedTargetIndustry = normalizeForMatch(targetIndustry);

    // ICP / SEGMENTO - maximo 40 pontos
    let icpPoints = 0;

    const segmentMatch = targetSegments.some(
      (segment: string) => {
        const normalizedSegment = normalizeForMatch(segment);

        if (!normalizedSegment || !normalizedIndustry) {
          return false;
        }

        // Segmentos curtos podem ser comparados diretamente ao setor.
        // Descrições longas do ICP não devem gerar correspondência
        // apenas porque contêm uma palavra do setor.
        const isExactIndustryMatch =
          normalizedIndustry === normalizedSegment;

        const isIndustryContainedInShortSegment =
          normalizedSegment.length <= 40 &&
          (
            normalizedIndustry.includes(normalizedSegment) ||
            normalizedSegment.includes(normalizedIndustry)
          );

        return (
          isExactIndustryMatch ||
          isIndustryContainedInShortSegment
        );
      }
    );

    if (targetSegments.length > 0 && segmentMatch) {
      icpPoints = 40;
      fitReasons.push("Segmento compativel com o ICP definido.");
    } else if (
      normalizedTargetIndustry &&
      normalizedIndustry === normalizedTargetIndustry
    ) {
      icpPoints = 40;
      fitReasons.push(
        `Industria compativel com o alvo: ${lead.industry}.`
      );
    } else if (
      targetIndustry &&
      isRelatedIndustry(industry, targetIndustry)
    ) {
      icpPoints = 30;
      fitReasons.push(
        `Industria relacionada ao alvo: ${lead.industry}.`
      );
    } else if (
      targetIndustry &&
      (
        normalizedIndustry.includes(normalizedTargetIndustry) ||
        normalizedTargetIndustry.includes(normalizedIndustry)
      )
    ) {
      icpPoints = 20;
      fitReasons.push(
        `Industria parcialmente compativel com o alvo: ${lead.industry}.`
      );
    }

    fitPoints += Math.min(40, icpPoints);

    // GEOGRAFIA - maximo 20 pontos
    const location = spec.location || {};

    const targetGeography = normalizeForMatch(
      typeof location.geography === "string"
        ? location.geography
        : typeof location.description === "string"
          ? location.description
          : ""
    );

    const preferredLocations = Array.isArray(location.preferred_locations)
      ? location.preferred_locations
          .filter((value: unknown) => typeof value === "string")
          .map((value: string) => normalizeForMatch(value))
          .filter(Boolean)
      : [];

    const normalizedCity = normalizeForMatch(city);
    const normalizedAddress = normalizeForMatch(address);
    const normalizedNeighborhood = normalizeForMatch(
      String(lead.neighborhood || "")
    );

    const geographyCityMatch =
      !!targetGeography &&
      !!normalizedCity &&
      (
        targetGeography.includes(normalizedCity) ||
        normalizedCity.includes(targetGeography.split(",")[0].trim())
      );

    const preferredLocationMatch = preferredLocations.some(
      (preferred: string) =>
        preferred === normalizedNeighborhood ||
        normalizedNeighborhood.includes(preferred) ||
        preferred.includes(normalizedNeighborhood) ||
        normalizedAddress.includes(preferred)
    );

    if (geographyCityMatch && preferredLocationMatch) {
      fitPoints += 20;
      fitReasons.push("Localizacao dentro da area prioritaria.");
    } else if (geographyCityMatch) {
      fitPoints += 15;
      fitReasons.push("Localizacao dentro da geografia-alvo.");
    }

    // PERFIL / TIPO - maximo 10 pontos
    if (
      targetBusinessType &&
      (
        textIncludes(industry, targetBusinessType) ||
        textIncludes(companyName, targetBusinessType)
      )
    ) {
      fitPoints += 10;
      fitReasons.push("Tipo de negocio compativel com o alvo.");
    }
    // CONFIDENCE — qualidade dos dados estruturais
    let confidencePoints = 0;

    if (phone) confidencePoints += 25;
    else negativeSignals.push("Telefone não disponível.");

    if (website) confidencePoints += 25;
    else negativeSignals.push("Website não disponível.");

    if (address) confidencePoints += 25;
    else negativeSignals.push("Endereço não disponível.");

    if (industry) confidencePoints += 25;
    else negativeSignals.push("Indústria/categoria não disponível.");
    // FIT limitado a 70 pontos e confiança limitada a 30 pontos.
    const normalizedFit = Math.min(70, fitPoints);
    const normalizedConfidence = Math.round((confidencePoints * 30) / 100);

    let leadScore = normalizedFit + normalizedConfidence;

    // Exclusions
    let exclude = false;
    let needsReview = false;

    for (const exclusion of exclusions) {
      if (!matchesExclusion(lead, exclusion)) continue;

      const action =
        typeof exclusion?.action === "string"
          ? exclusion.action.toUpperCase()
          : "";

      if (action === "EXCLUDE") {
        exclude = true;
        negativeSignals.push(
          `Correspondência com exclusão: ${exclusion.trait}.`
        );
      } else if (action === "LOWER_SCORE") {
        leadScore = Math.max(0, leadScore - 20);
        negativeSignals.push(
          `Score reduzido por sinal de exclusão: ${exclusion.trait}.`
        );
      } else if (action === "REVIEW") {
        needsReview = true;
        negativeSignals.push(
          `Lead requer revisão: ${exclusion.trait}.`
        );
      }
    }

    leadScore = Math.max(0, Math.min(100, Math.round(leadScore)));

        let intentLevel: "alta" | "média" | "baixa" | "indeterminada";
    const intentReasons: string[] = [];
    const painReasons: string[] = [];

    const evidenceText =
      typeof lead.evidence_text === "string"
        ? lead.evidence_text.trim().toLowerCase()
        : "";

    const intentSignals = Array.isArray(spec.intent_signals)
      ? spec.intent_signals
      : [];

    const normalizedIntentSignals = intentSignals
      .filter((signal: unknown): signal is string => typeof signal === "string")
      .map((signal: string) =>
        signal
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
      );

    const normalizedEvidence = evidenceText
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const strongIntentTerms = [
      "procurando",
      "procura por",
      "precisa de",
      "precisando de",
      "quer trocar",
      "trocar de contador",
      "novo contador",
      "orcamento",
      "orçamento",
      "contratar",
      "contratacao",
      "contratação",
      "urgente",
      "urgencia",
      "urgência",
      "regularizar",
      "regularizacao",
      "regularização",
    ];

    const mediumIntentTerms = [
      "avaliando",
      "considerando",
      "interesse",
      "interessado",
      "interessada",
      "buscando",
      "cotacao",
      "cotação",
      "proposta",
      "comparando",
      "consultando",
    ];

    const painTerms = [
      "problema",
      "problemas",
      "insatisfeito",
      "insatisfeita",
      "reclamacao",
      "reclamação",
      "erro fiscal",
      "pendencia",
      "pendência",
      "multa",
      "atraso",
      "regularizar",
      "regularizacao",
      "regularização",
    ];

    const matchedStrongIntent = strongIntentTerms.filter((term) =>
      normalizedEvidence.includes(
        term.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      )
    );

    const matchedMediumIntent = mediumIntentTerms.filter((term) =>
      normalizedEvidence.includes(
        term.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      )
    );

    const matchedPain = painTerms.filter((term) =>
      normalizedEvidence.includes(
        term.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      )
    );

    if (!normalizedEvidence) {
      intentLevel = "indeterminada";
    } else if (matchedStrongIntent.length > 0) {
      intentLevel = "alta";
      intentReasons.push(
        `Evidência textual de intenção comercial: ${matchedStrongIntent.join(", ")}.`
      );
    } else if (matchedMediumIntent.length > 0) {
      intentLevel = "média";
      intentReasons.push(
        `Evidência textual de interesse comercial: ${matchedMediumIntent.join(", ")}.`
      );
    } else {
      intentLevel = "baixa";
    }

    if (matchedPain.length > 0) {
      painReasons.push(
        `Evidência textual de dor/necessidade: ${matchedPain.join(", ")}.`
      );
    }

    if (
      normalizedEvidence &&
      normalizedIntentSignals.length > 0 &&
      intentReasons.length > 0
    ) {
      intentReasons.push(
        "A evidência textual foi comparada com os sinais de intenção definidos na Prospection Spec."
      );
    }

    let temperature: "frio" | "morno" | "quente";

    if (leadScore >= 70) {
      temperature = "quente";
    } else if (leadScore >= 40) {
      temperature = "morno";
    } else {
      temperature = "frio";
    }
    const recommendedChannel = phone
      ? "telefone"
      : website
        ? "site"
        : "revisão manual";

   const recommendedAction = exclude
  ? "Descartar por incompatibilidade com os critérios da prospecção."
  : needsReview
    ? "Revisar antes do contato devido a sinal de exclusão."
    : intentLevel === "indeterminada"
      ? "Enriquecer dados antes de priorizar contato comercial."
      : temperature === "quente"
        ? "Priorizar contato comercial."
        : temperature === "morno"
          ? "Revisar e validar antes do contato."
          : "Manter baixa prioridade até novo enriquecimento.";
    return {
      index:
        typeof lead.index === "number"
          ? lead.index
          : index,
      exclude,
      needs_review: needsReview,
      lead_score: leadScore,
      confidence_score: Math.min(100, Math.round(confidencePoints)),
      temperature,
      intent_level: intentLevel,
      intent_source: "MOCK",
      fit_reasons: fitReasons,
      intent_reasons: intentReasons,
      pain_reasons: painReasons,
      negative_signals: negativeSignals,
      recommended_action: recommendedAction,
      recommended_channel: recommendedChannel
    };
  });

  console.log(
    `[CLAUDE] MOCK Scoring determinístico → ${results.length} leads processados.`
  );

  return JSON.stringify({ results });
}
export async function callClaude(params: {
  system: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
}): Promise<string> {
  if (ANTHROPIC_MODE === "mock") {
    console.log(
      "[CLAUDE] Modo MOCK ativo → nenhuma chamada à Anthropic foi realizada."
    );

    const system = params.system.toLowerCase();

    if (system.includes("prospection spec generator")) {
      console.log("[CLAUDE] MOCK → Prospection Spec Generator");
      return mockProspectionResponse({
        messages: params.messages
      });
    }

    if (system.includes("scoring engine")) {
      console.log("[CLAUDE] MOCK → Scoring Engine");
      return mockScoringResponse({
        messages: params.messages
      });
    }

    console.log("[CLAUDE] MOCK → Interview Engine");

    return mockInterviewResponse({
      messages: params.messages
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY não configurada. Adicione a chave no arquivo .env."
    );
  }

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: params.maxTokens ?? 2000,
      system: params.system,
      messages: params.messages
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  const data = await res.json();

  const textBlock = (data.content || []).find(
    (block: any) => block.type === "text"
  );

  if (!textBlock) {
    throw new Error(
      "Resposta da Anthropic API não trouxe bloco de texto."
    );
  }

  return textBlock.text as string;
}



































