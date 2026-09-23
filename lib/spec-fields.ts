export type SpecFieldDef = { key: string; label: string };

export const SPEC_FIELD_DEFINITIONS: SpecFieldDef[] = [
  { key: "target", label: "QUEM (target)" },
  { key: "location", label: "ONDE (location)" },
  { key: "what", label: "O QUÊ (what)" },
  { key: "discoveryStrategy", label: "COMO ENCONTRAR (discovery strategy)" },
  { key: "intentSignals", label: "QUE SINAIS PROCURAR (intent signals)" },
  { key: "exclusions", label: "O QUE DESCARTAR (exclusions)" },
  { key: "dataRequired", label: "QUE DADOS COLETAR (data required)" },
  { key: "scoringRules", label: "COMO PONTUAR (scoring rules)" },
  { key: "stopCriteria", label: "QUANDO PARAR (stop criteria)" },
];

export const SPEC_FIELD_KEYS = new Set(SPEC_FIELD_DEFINITIONS.map((f) => f.key));
