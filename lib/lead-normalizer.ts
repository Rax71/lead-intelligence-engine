// Normalização dos itens brutos do compass/crawler-google-places.
// Campos confirmados via documentação pública do Actor.

export type NormalizedLead = {
  index: number;
  companyName: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  neighborhood: string | null;
  industry: string | null;
  rating: number | null;
  reviewsCount: number | null;
  placeId: string | null;
  mapsUrl: string | null;
  identityKey: string | null;
  raw: unknown;
};

function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function normalizeText(value: string | null): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value: string | null): string {
  return (value || "").replace(/\D/g, "");
}

function normalizeDomain(value: string | null): string {
  if (!value) return "";

  try {
    const url = value.match(/^https?:\/\//i)
      ? new URL(value)
      : new URL(`https://${value}`);

    return url.hostname
      .toLowerCase()
      .replace(/^www\./, "")
      .trim();
  } catch {
    return value
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .trim();
  }
}

export function buildLeadIdentityKey(
  lead: Pick<
    NormalizedLead,
    "companyName" | "phone" | "website" | "address" | "city" | "neighborhood" | "placeId"
  >
): string | null {
  // 1. Identificador estável do Google Maps.
  if (lead.placeId?.trim()) {
    return `place:${normalizeText(lead.placeId)}`;
  }

  // 2. Telefone.
  const phone = normalizePhone(lead.phone);
  if (phone) {
    return `phone:${phone}`;
  }

  // 3. Domínio do website.
  const domain = normalizeDomain(lead.website);
  if (domain) {
    return `domain:${domain}`;
  }

  // 4. Nome + endereço.
  const name = normalizeText(lead.companyName);
  const address = normalizeText(lead.address);

  if (name && address) {
    return `name_address:${name}|${address}`;
  }

  // 5. Nome + cidade + bairro.
  const city = normalizeText(lead.city);
  const neighborhood = normalizeText(lead.neighborhood);

  if (name && city && neighborhood) {
    return `name_location:${name}|${city}|${neighborhood}`;
  }

  // Não cria uma identidade artificial para dados insuficientes.
  return null;
}

export function normalizeRawItem(raw: any, index: number): NormalizedLead {
  const lead: NormalizedLead = {
    index,
    companyName:
      firstString(raw.title, raw.name, raw.companyName) || "Sem nome",
    phone: firstString(raw.phone, raw.phoneUnformatted),
    website: firstString(raw.website),
    address: firstString(raw.address),
    city: firstString(raw.city),
    neighborhood: firstString(raw.neighborhood),
    industry: firstString(
      raw.categoryName,
      Array.isArray(raw.categories) ? raw.categories[0] : undefined
    ),
    rating: typeof raw.totalScore === "number" ? raw.totalScore : null,
    reviewsCount:
      typeof raw.reviewsCount === "number" ? raw.reviewsCount : null,
    placeId: firstString(raw.placeId),
    mapsUrl: firstString(raw.url),
    identityKey: null,
    raw,
  };

  lead.identityKey = buildLeadIdentityKey(lead);

  return lead;
}

// Deduplicação dentro da execução atual.
// A deduplicação entre runs será feita pelo lead-processor
// utilizando a identityKey persistida no banco.
export function dedupeLeads(leads: NormalizedLead[]): NormalizedLead[] {
  const seen = new Set<string>();
  const result: NormalizedLead[] = [];

  for (const lead of leads) {
    const key = lead.identityKey;

    // Dados insuficientes para uma identidade confiável:
    // não eliminamos automaticamente o lead.
    if (!key) {
      result.push(lead);
      continue;
    }

    if (seen.has(key)) continue;

    seen.add(key);
    result.push(lead);
  }

  return result;
}