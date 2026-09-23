// Converte o objeto "profile" devolvido pelo Interview Engine (chaves em
// snake_case, espelhando MASTER_SPEC_V2 Seção 15) para os campos camelCase
// do model ClientProfile do Prisma.

const FIELD_MAP: Record<string, string> = {
  business_type: "businessType",
  professional_type: "professionalType",
  industry: "industry",
  subindustry: "subindustry",
  products_services: "productsServices",
  business_model: "businessModel",
  ideal_customer: "idealCustomer",
  icp: "icp",
  target_segments: "targetSegments",
  priority_segments: "prioritySegments",
  geography: "geography",
  preferred_locations: "preferredLocations",
  radius_km: "radiusKm",
  company_size: "companySize",
  employee_range: "employeeRange",
  revenue_range: "revenueRange",
  ticket_range: "ticketRange",
  decision_maker: "decisionMaker",
  pain_points: "painPoints",
  needs: "needs",
  intent_signals: "intentSignals",
  buying_signals: "buyingSignals",
  growth_signals: "growthSignals",
  urgency_signals: "urgencySignals",
  positive_characteristics: "positiveCharacteristics",
  negative_characteristics: "negativeCharacteristics",
  exclusions: "exclusions",
  preferred_sources: "preferredSources",
  preferred_channels: "preferredChannels",
  contact_requirements: "contactRequirements",
  recency_requirements: "recencyRequirements",
  scoring_preferences: "scoringPreferences",
  outreach_preferences: "outreachPreferences",
  success_definition: "successDefinition",
  constraints: "constraints",
};

export function mapProfileDraftToClientProfileData(
  draft: Record<string, unknown>,
  extra: { assumptions?: unknown; confidence?: unknown; profileReadiness: number }
) {
  const data: Record<string, unknown> = {
    profileReadiness: extra.profileReadiness,
  };

  for (const [snakeKey, camelKey] of Object.entries(FIELD_MAP)) {
    if (draft[snakeKey] !== undefined) {
      data[camelKey] = draft[snakeKey];
    }
  }

  if (extra.assumptions !== undefined) data.assumptions = extra.assumptions;
  if (extra.confidence !== undefined) data.confidence = extra.confidence;

  return data;
}
