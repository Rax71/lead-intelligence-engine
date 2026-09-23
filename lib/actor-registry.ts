import { prisma } from "./prisma";

// Catálogo estático de Actors — MASTER_SPEC_V2 Seção 18. A fonte de
// verdade é este arquivo; a tabela actor_registry no banco é populada/
// atualizada automaticamente no primeiro uso (ensureActorRegistered), só
// para consulta e histórico.
//
// SOBRE OS CUSTOS ABAIXO: pesquisados em ago/2026. O Google Maps Scraper
// (compass/crawler-google-places) cobra por resultado, com preço decrescente
// por tier de plano Apify: ~US$5/1.000 no plano Free, ~US$4/1.000 no
// Starter, ~US$3/1.000 no Scale, ~US$2,10/1.000 no Business. O plano Free
// da Apify dá ~US$5 de crédito por mês — o suficiente para uma rodada de
// validação pequena, não para escala. Estes valores mudam com frequência;
// confirme na aba "Pricing" do Actor no console da Apify antes de rodar
// além do modo validação.

export type ActorDefinition = {
  actorId: string;
  name: string;
  provider: string;
  purpose: string;
  estimatedCostPerItem: number; // USD, baseado no tier Free
  defaultMaxItems: number;
  notes: string;
};

export const GOOGLE_MAPS_SCRAPER: ActorDefinition = {
  actorId: "compass/crawler-google-places",
  name: "Google Maps Scraper",
  provider: "Compass (Apify Store)",
  purpose:
    "Descoberta primária de leads via Google Maps: nome, endereço, telefone comercial, site, categoria, avaliação.",
  estimatedCostPerItem: 0.005,
  defaultMaxItems: 30,
  notes:
    "Não retorna WhatsApp pessoal nem nome do decisor de forma confiável — limitação já registrada na análise pré-Sprint 01 (Seção 1.5). Esses campos entram como best-effort no data_required da Prospection Spec.",
};

export async function ensureActorRegistered(actor: ActorDefinition) {
  return prisma.actorRegistryEntry.upsert({
    where: { actorId: actor.actorId },
    update: {
      name: actor.name,
      provider: actor.provider,
      purpose: actor.purpose,
      estimatedCost: actor.estimatedCostPerItem,
      maxItems: actor.defaultMaxItems,
      notes: actor.notes,
      lastVerified: new Date(),
    },
    create: {
      actorId: actor.actorId,
      name: actor.name,
      provider: actor.provider,
      purpose: actor.purpose,
      estimatedCost: actor.estimatedCostPerItem,
      maxItems: actor.defaultMaxItems,
      notes: actor.notes,
      lastVerified: new Date(),
    },
  });
}
