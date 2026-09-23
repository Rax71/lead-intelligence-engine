import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const OUTCOME_TYPES = [
  "CONTACTED",
  "RESPONDED",
  "INTERESTED",
  "MEETING",
  "PROPOSAL",
  "SALE",
  "NO_RESPONSE",
  "WRONG_DATA",
  "NO_FIT",
  "LOST",
] as const;

type OutcomeType = (typeof OUTCOME_TYPES)[number];

type Bucket = {
  totalLeads: number;
  leadsWithFeedback: number;
  contacted: number;
  responded: number;
  interested: number;
  meeting: number;
  proposal: number;
  sale: number;
  noResponse: number;
  wrongData: number;
  noFit: number;
  lost: number;
};

function percentage(value: number, total: number) {
  if (!total) return 0;
  return Number(((value / total) * 100).toFixed(2));
}

function scoreRange(score: number | null) {
  if (score === null) return "sem_score";
  if (score >= 80) return "80-100";
  if (score >= 70) return "70-79";
  if (score >= 40) return "40-69";
  return "0-39";
}

function confidenceRange(confidence: number | null) {
  if (confidence === null) return "sem_confianca";
  if (confidence >= 80) return "80-100";
  if (confidence >= 60) return "60-79";
  if (confidence >= 40) return "40-59";
  return "0-39";
}

function createBucket(): Bucket {
  return {
    totalLeads: 0,
    leadsWithFeedback: 0,
    contacted: 0,
    responded: 0,
    interested: 0,
    meeting: 0,
    proposal: 0,
    sale: 0,
    noResponse: 0,
    wrongData: 0,
    noFit: 0,
    lost: 0,
  };
}

function ensureBucket(
  collection: Record<string, Bucket>,
  key: string
) {
  if (!collection[key]) {
    collection[key] = createBucket();
  }

  return collection[key];
}

function addOutcome(bucket: Bucket, eventType: OutcomeType) {
  const property =
    eventType === "CONTACTED"
      ? "contacted"
      : eventType === "RESPONDED"
        ? "responded"
        : eventType === "INTERESTED"
          ? "interested"
          : eventType === "MEETING"
            ? "meeting"
            : eventType === "PROPOSAL"
              ? "proposal"
              : eventType === "SALE"
                ? "sale"
                : eventType === "NO_RESPONSE"
                  ? "noResponse"
                  : eventType === "WRONG_DATA"
                    ? "wrongData"
                    : eventType === "NO_FIT"
                      ? "noFit"
                      : "lost";

  bucket[property] += 1;
}

function evidenceLevel(leadsWithFeedback: number) {
  if (leadsWithFeedback < 5) return "insufficient_sample";
  if (leadsWithFeedback < 20) return "descriptive";
  return "learning_candidate";
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
      runId: true,
      companyName: true,
      leadScore: true,
      confidenceScore: true,
      temperature: true,
      intentLevel: true,
      intentSource: true,
      recommendedAction: true,
      recommendedChannel: true,
      industry: true,
      city: true,
      neighborhood: true,
      createdAt: true,
      feedbackEvents: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          eventType: true,
          notes: true,
          createdAt: true,
        },
      },
    },
  });

  const totalLeads = leads.length;

  const leadsWithFeedback = leads.filter(
    (lead) => lead.feedbackEvents.length > 0
  ).length;

  const totalFeedbackEvents = leads.reduce(
    (total, lead) => total + lead.feedbackEvents.length,
    0
  );

  const outcomes = Object.fromEntries(
    OUTCOME_TYPES.map((eventType) => [
      eventType.toLowerCase(),
      leads.reduce(
        (total, lead) =>
          total +
          (lead.feedbackEvents.some(
            (event) => event.eventType === eventType
          )
            ? 1
            : 0),
        0
      ),
    ])
  );

  const byTemperature: Record<string, Bucket> = {};
  const byIntent: Record<string, Bucket> = {};
  const byScoreRange: Record<string, Bucket> = {};
  const byConfidenceRange: Record<string, Bucket> = {};

  for (const lead of leads) {
    const temperature = lead.temperature || "sem_temperatura";
    const intent = lead.intentLevel || "sem_intencao";
    const score = scoreRange(lead.leadScore);
    const confidence = confidenceRange(lead.confidenceScore);

    const buckets = [
      ensureBucket(byTemperature, temperature),
      ensureBucket(byIntent, intent),
      ensureBucket(byScoreRange, score),
      ensureBucket(byConfidenceRange, confidence),
    ];

    for (const bucket of buckets) {
      bucket.totalLeads += 1;

      if (lead.feedbackEvents.length > 0) {
        bucket.leadsWithFeedback += 1;
      }

      const eventTypes = new Set(
        lead.feedbackEvents.map((event) => event.eventType)
      );

      for (const eventType of eventTypes) {
        if (OUTCOME_TYPES.includes(eventType as OutcomeType)) {
          addOutcome(bucket, eventType as OutcomeType);
        }
      }
    }
  }

  const feedbackHistory = leads
    .filter((lead) => lead.feedbackEvents.length > 0)
    .map((lead) => ({
      leadId: lead.id,
      companyName: lead.companyName,
      leadScore: lead.leadScore,
      confidenceScore: lead.confidenceScore,
      temperature: lead.temperature,
      intentLevel: lead.intentLevel,
      intentSource: lead.intentSource,
      recommendedAction: lead.recommendedAction,
      recommendedChannel: lead.recommendedChannel,
      createdAt: lead.createdAt,
      events: lead.feedbackEvents,
    }));

  const observations = [
    {
      type: "sample_size",
      level: evidenceLevel(leadsWithFeedback),
      message:
        leadsWithFeedback < 5
          ? "A amostra atual de leads com feedback ainda é insuficiente para inferir padrões de aprendizado."
          : leadsWithFeedback < 20
            ? "A amostra permite observações descritivas, mas ainda requer mais dados para sustentar ajustes de regras."
            : "A amostra já permite investigar padrões de aprendizado com maior profundidade.",
    },
  ];

  return NextResponse.json({
    sample: {
      totalLeads,
      totalFeedbackEvents,
      leadsWithFeedback,
      feedbackCoveragePct: percentage(
        leadsWithFeedback,
        totalLeads
      ),
      evidenceLevel: evidenceLevel(leadsWithFeedback),
    },
    outcomes,
    performance: {
      byTemperature,
      byIntent,
      byScoreRange,
      byConfidenceRange,
    },
    feedbackHistory,
    observations,
  });
}