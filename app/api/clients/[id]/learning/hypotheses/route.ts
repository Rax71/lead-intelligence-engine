import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const POSITIVE_OUTCOMES = [
  "INTERESTED",
  "MEETING",
  "PROPOSAL",
  "SALE",
] as const;

const NEGATIVE_OUTCOMES = [
  "WRONG_DATA",
  "NO_FIT",
  "LOST",
] as const;

type OutcomeType =
  | (typeof POSITIVE_OUTCOMES)[number]
  | (typeof NEGATIVE_OUTCOMES)[number]
  | "CONTACTED"
  | "RESPONDED"
  | "NO_RESPONSE";

function percentage(value: number, total: number) {
  if (!total) return 0;
  return Number(((value / total) * 100).toFixed(2));
}

function evidenceLevel(sample: number) {
  if (sample < 5) return "insufficient_sample";
  if (sample < 20) return "descriptive";
  return "learning_candidate";
}

function scoreRange(score: number | null) {
  if (score === null) return "sem_score";
  if (score >= 80) return "80-100";
  if (score >= 70) return "70-79";
  if (score >= 40) return "40-69";
  return "0-39";
}

function hasOutcome(
  events: { eventType: string }[],
  outcomes: readonly string[]
) {
  return events.some((event) => outcomes.includes(event.eventType));
}

function uniqueOutcomeTypes(events: { eventType: string }[]) {
  return new Set(events.map((event) => event.eventType as OutcomeType));
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const client = await prisma.client.findUnique({
    where: { id: params.id },
    select: { id: true },
  });

  if (!client) {
    return NextResponse.json(
      { error: "Cliente não encontrado." },
      { status: 404 }
    );
  }

  const leads = await prisma.lead.findMany({
    where: { clientId: client.id },
    select: {
      id: true,
      companyName: true,
      leadScore: true,
      confidenceScore: true,
      temperature: true,
      intentLevel: true,
      intentSource: true,
      industry: true,
      city: true,
      neighborhood: true,
      feedbackEvents: {
        orderBy: { createdAt: "asc" },
        select: {
          eventType: true,
          createdAt: true,
        },
      },
    },
  });

  const leadsWithFeedback = leads.filter(
    (lead) => lead.feedbackEvents.length > 0
  );

  const positiveLeads = leadsWithFeedback.filter((lead) =>
    hasOutcome(lead.feedbackEvents, POSITIVE_OUTCOMES)
  );

  const negativeLeads = leadsWithFeedback.filter((lead) =>
    hasOutcome(lead.feedbackEvents, NEGATIVE_OUTCOMES)
  );

  const scoreBuckets = new Map<
    string,
    { leads: number; positive: number; negative: number }
  >();

  for (const lead of leadsWithFeedback) {
    const range = scoreRange(lead.leadScore);

    if (!scoreBuckets.has(range)) {
      scoreBuckets.set(range, {
        leads: 0,
        positive: 0,
        negative: 0,
      });
    }

    const bucket = scoreBuckets.get(range)!;
    bucket.leads += 1;

    if (hasOutcome(lead.feedbackEvents, POSITIVE_OUTCOMES)) {
      bucket.positive += 1;
    }

    if (hasOutcome(lead.feedbackEvents, NEGATIVE_OUTCOMES)) {
      bucket.negative += 1;
    }
  }

  const scorePatterns = Array.from(scoreBuckets.entries()).map(
    ([range, bucket]) => ({
      scoreRange: range,
      leadsWithFeedback: bucket.leads,
      positiveLeads: bucket.positive,
      negativeLeads: bucket.negative,
      positiveRatePct: percentage(bucket.positive, bucket.leads),
      negativeRatePct: percentage(bucket.negative, bucket.leads),
      evidenceLevel: evidenceLevel(bucket.leads),
    })
  );

  const temperatureBuckets = new Map<
    string,
    { leads: number; positive: number; negative: number }
  >();

  for (const lead of leadsWithFeedback) {
    const temperature = lead.temperature || "sem_temperatura";

    if (!temperatureBuckets.has(temperature)) {
      temperatureBuckets.set(temperature, {
        leads: 0,
        positive: 0,
        negative: 0,
      });
    }

    const bucket = temperatureBuckets.get(temperature)!;
    bucket.leads += 1;

    if (hasOutcome(lead.feedbackEvents, POSITIVE_OUTCOMES)) {
      bucket.positive += 1;
    }

    if (hasOutcome(lead.feedbackEvents, NEGATIVE_OUTCOMES)) {
      bucket.negative += 1;
    }
  }

  const temperaturePatterns = Array.from(
    temperatureBuckets.entries()
  ).map(([temperature, bucket]) => ({
    temperature,
    leadsWithFeedback: bucket.leads,
    positiveLeads: bucket.positive,
    negativeLeads: bucket.negative,
    positiveRatePct: percentage(bucket.positive, bucket.leads),
    negativeRatePct: percentage(bucket.negative, bucket.leads),
    evidenceLevel: evidenceLevel(bucket.leads),
  }));

  const intentBuckets = new Map<
    string,
    { leads: number; positive: number; negative: number }
  >();

  for (const lead of leadsWithFeedback) {
    const intent = lead.intentLevel || "sem_intencao";

    if (!intentBuckets.has(intent)) {
      intentBuckets.set(intent, {
        leads: 0,
        positive: 0,
        negative: 0,
      });
    }

    const bucket = intentBuckets.get(intent)!;
    bucket.leads += 1;

    if (hasOutcome(lead.feedbackEvents, POSITIVE_OUTCOMES)) {
      bucket.positive += 1;
    }

    if (hasOutcome(lead.feedbackEvents, NEGATIVE_OUTCOMES)) {
      bucket.negative += 1;
    }
  }

  const intentPatterns = Array.from(intentBuckets.entries()).map(
    ([intent, bucket]) => ({
      intent,
      leadsWithFeedback: bucket.leads,
      positiveLeads: bucket.positive,
      negativeLeads: bucket.negative,
      positiveRatePct: percentage(bucket.positive, bucket.leads),
      negativeRatePct: percentage(bucket.negative, bucket.leads),
      evidenceLevel: evidenceLevel(bucket.leads),
    })
  );

  const observedOutcomes = {
    leadsWithFeedback: leadsWithFeedback.length,
    positiveLeads: positiveLeads.length,
    negativeLeads: negativeLeads.length,
    positiveRatePct: percentage(
      positiveLeads.length,
      leadsWithFeedback.length
    ),
    negativeRatePct: percentage(
      negativeLeads.length,
      leadsWithFeedback.length
    ),
  };

  const observedOutcomeTypes = new Set<string>();

  for (const lead of leadsWithFeedback) {
    for (const eventType of uniqueOutcomeTypes(lead.feedbackEvents)) {
      observedOutcomeTypes.add(eventType);
    }
  }

  return NextResponse.json({
    sample: {
      totalLeads: leads.length,
      leadsWithFeedback: leadsWithFeedback.length,
      evidenceLevel: evidenceLevel(leadsWithFeedback.length),
    },
    observedOutcomes: {
      ...observedOutcomes,
      types: Array.from(observedOutcomeTypes),
    },
    hypotheses: {
      scorePatterns,
      temperaturePatterns,
      intentPatterns,
    },
    guardrails: {
      readOnly: true,
      automaticScoringChange: false,
      minimumEvidenceForLearning: 20,
      note:
        "Os padrões são descritivos e não alteram automaticamente as regras de scoring.",
    },
  });
}