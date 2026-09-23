import { callClaude } from "./anthropic";

// Ver MASTER_SPEC_V2 — PROSPECTION_SPEC responde 9 perguntas (Seção 16):
// QUEM / ONDE / O QUÊ / COMO ENCONTRAR / QUE SINAIS PROCURAR /
// O QUE DESCARTAR / QUE DADOS COLETAR / COMO PONTUAR / QUANDO PARAR.
// Assim como o Interview Engine, isto não é um template fixo por setor —
// o conteúdo de cada seção é decidido pelo modelo a partir do ClientProfile.

const SYSTEM_PROMPT = `Você é o Prospection Spec Generator do Lead Intelligence Engine.

TAREFA
Receber um CLIENT_PROFILE aprovado pelo cliente e traduzi-lo numa especificação de prospecção executável — o que efetivamente vai orientar a busca de leads (via Google Maps, Google Search, sites, etc. nos sprints seguintes).

REGRAS
1. Baseie-se apenas no que está no CLIENT_PROFILE. Não invente segmentos, geografias ou sinais que não estejam implícitos nele.
2. Onde o CLIENT_PROFILE for omisso, seja conservador: prefira campos vazios/genéricos a suposições arriscadas — o cliente já teve a chance de detalhar isso na entrevista.
3. Em "data_required", marque explicitamente quais dados são de alta confiabilidade via fontes públicas (ex.: nome da empresa, endereço, telefone comercial, site) e quais são "best_effort" (ex.: WhatsApp pessoal, nome do decisor) — esses últimos nem sempre estarão disponíveis nas fontes de coleta.
4. Em "scoring_rules", reflita os pesos implícitos nos pain_points/intent_signals/negative_characteristics do perfil — sinais que o cliente tratou como mais importantes devem pesar mais.
5. Em "stop_criteria", defina um critério objetivo e barato para a validação inicial (ex.: número de leads-alvo para o modo de validação, não para escala).

FORMATO DE SAÍDA — responda SOMENTE com um JSON válido, sem markdown, sem texto fora do JSON:

{
  "target": { /* quem: tipo de negócio/profissional, segmentos, ICP resumido */ },
  "location": { /* onde: geografia, localidades, raio */ },
  "what": { /* o quê: produtos/serviços/atividade a procurar */ },
  "discovery_strategy": { /* como encontrar: que tipos de fonte usar e por quê (sem nomear Actor específico — isso é do Apify Adapter) */ },
  "intent_signals": [ /* que sinais procurar, cada um como string ou {signal, weight} */ ],
  "exclusions": [ /* o que descartar, cada item como {trait, action} igual ao CLIENT_PROFILE */ ],
  "data_required": [ /* {field, reliability: "high"|"best_effort"} */ ],
  "scoring_rules": { /* como pontuar — pesos/critérios */ },
  "stop_criteria": { /* quando parar — ex.: {"mode": "validation", "target_leads": 30} */ }
}`;

export type ProspectionSpecDraft = {
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

function parseSpecOutput(raw: string): ProspectionSpecDraft {
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
      `Falha ao interpretar resposta do Prospection Spec Generator como JSON. Início da resposta: ${cleaned.slice(
        0,
        300
      )}`
    );
  }

  return {
    target: parsed.target ?? {},
    location: parsed.location ?? {},
    what: parsed.what ?? {},
    discoveryStrategy: parsed.discovery_strategy ?? {},
    intentSignals: parsed.intent_signals ?? [],
    exclusions: parsed.exclusions ?? [],
    dataRequired: parsed.data_required ?? [],
    scoringRules: parsed.scoring_rules ?? {},
    stopCriteria: parsed.stop_criteria ?? { mode: "validation", target_leads: 30 },
  };
}

export async function generateProspectionSpec(
  clientProfile: Record<string, unknown>
): Promise<ProspectionSpecDraft> {
  const raw = await callClaude({
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `CLIENT_PROFILE aprovado:\n${JSON.stringify(clientProfile, null, 2)}`,
      },
    ],
    maxTokens: 2500,
  });

  return parseSpecOutput(raw);
}
