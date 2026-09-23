// Lista única de campos do ClientProfile usada tanto para validar o PATCH
// na API quanto para renderizar o formulário de revisão na UI. Mantém a
// tela genérica e válida para qualquer setor (Seção 36 do Master Spec) —
// nada aqui é específico de contabilidade, arquitetura, etc.

export type ProfileFieldType = "text" | "json";

export type ProfileFieldDef = {
  key: string;
  label: string;
  type: ProfileFieldType;
};

export const PROFILE_FIELD_DEFINITIONS: ProfileFieldDef[] = [
  { key: "businessType", label: "Tipo de negócio", type: "text" },
  { key: "professionalType", label: "Tipo de profissional", type: "text" },
  { key: "industry", label: "Indústria", type: "text" },
  { key: "subindustry", label: "Subindústria", type: "text" },
  { key: "productsServices", label: "Produtos/Serviços", type: "json" },
  { key: "businessModel", label: "Modelo de negócio", type: "text" },
  { key: "idealCustomer", label: "Cliente ideal", type: "text" },
  { key: "icp", label: "ICP", type: "json" },
  { key: "targetSegments", label: "Segmentos-alvo", type: "json" },
  { key: "prioritySegments", label: "Segmentos prioritários", type: "json" },
  { key: "geography", label: "Geografia", type: "json" },
  { key: "preferredLocations", label: "Localidades preferidas", type: "json" },
  { key: "radiusKm", label: "Raio (km)", type: "text" },
  { key: "companySize", label: "Porte da empresa", type: "text" },
  { key: "employeeRange", label: "Faixa de funcionários", type: "json" },
  { key: "revenueRange", label: "Faixa de faturamento", type: "json" },
  { key: "ticketRange", label: "Faixa de ticket", type: "json" },
  { key: "decisionMaker", label: "Decisor", type: "json" },
  { key: "painPoints", label: "Dores", type: "json" },
  { key: "needs", label: "Necessidades", type: "json" },
  { key: "intentSignals", label: "Sinais de intenção", type: "json" },
  { key: "buyingSignals", label: "Sinais de compra", type: "json" },
  { key: "growthSignals", label: "Sinais de crescimento", type: "json" },
  { key: "urgencySignals", label: "Sinais de urgência", type: "json" },
  { key: "positiveCharacteristics", label: "Características positivas", type: "json" },
  { key: "negativeCharacteristics", label: "Características negativas (com ação)", type: "json" },
  { key: "exclusions", label: "Exclusões (com ação)", type: "json" },
  { key: "preferredSources", label: "Fontes preferidas", type: "json" },
  { key: "preferredChannels", label: "Canais preferidos", type: "json" },
  { key: "contactRequirements", label: "Requisitos de contato", type: "json" },
  { key: "recencyRequirements", label: "Requisitos de recência (dias por sinal)", type: "json" },
  { key: "scoringPreferences", label: "Preferências de score", type: "json" },
  { key: "outreachPreferences", label: "Preferências de abordagem", type: "json" },
  { key: "successDefinition", label: "Definição de sucesso", type: "text" },
  { key: "constraints", label: "Restrições", type: "json" },
];

export const PROFILE_FIELD_KEYS = new Set(PROFILE_FIELD_DEFINITIONS.map((f) => f.key));
