import { prisma } from "./prisma";
import { scoreLeads } from "./scoring-engine";
import { NormalizedLead } from "./lead-normalizer";

export type RescoreRunSummary = {
  runId: string;
  totalLeads: number;
  totalUpdated: number;
};

export async function rescoreRun(runId: string): Promise<RescoreRunSummary> {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: {
      prospectionSpec: true,
    },
  });

  if (!run) {
    throw new Error("Run nÃ£o encontrada.");
  }

  const leads = await prisma.lead.findMany({
    where: { runId },
    orderBy: { createdAt: "asc" },
  });

  if (leads.length === 0) {
    return {
      runId,
      totalLeads: 0,
      totalUpdated: 0,
    };
  }

  const normalizedLeads: NormalizedLead[] = leads.map((lead, index) => ({
    index,
    companyName: lead.companyName,
    phone: lead.phone,
    website: lead.website,
    address: lead.address,
    city: lead.city,
    neighborhood: lead.neighborhood,
    industry: lead.industry,
    rating: null,
    reviewsCount: null,
        placeId: lead.placeId,
    mapsUrl: null,
    identityKey: lead.identityKey,
    raw: {},
  }));

  const spec = run.prospectionSpec;

  const scores = await scoreLeads(
    {
      target: spec.target,
      what: spec.what,
      exclusions: spec.exclusions,
      intentSignals: spec.intentSignals,
      scoringRules: spec.scoringRules,
    },
    normalizedLeads
  );

  let totalUpdated = 0;

  for (const lead of leads) {
    const score = scores.find(
      (result) =>
        result.index === leads.findIndex((item) => item.id === lead.id)
    );

    if (!score) {
      continue;
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        leadScore: score.leadScore,
        confidenceScore: score.confidenceScore,
        temperature: score.temperature,
        intentLevel: score.intentLevel,
        fitReasons: score.fitReasons as any,
        intentReasons: score.intentReasons as any,
        painReasons: score.painReasons as any,
        negativeSignals: score.negativeSignals as any,
        recommendedAction: score.recommendedAction,
        recommendedChannel: score.recommendedChannel,
      },
    });

    totalUpdated += 1;
  }

  return {
    runId,
    totalLeads: leads.length,
    totalUpdated,
  };
}

