import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const EVENT_TYPES = [
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
      leadScore: true,
      temperature: true,
      intentLevel: true,
    },
  });

  const events = await prisma.feedbackEvent.findMany({
    where: {
      lead: {
        clientId: client.id,
      },
    },
    select: {
      leadId: true,
      eventType: true,
    },
  });

  const leadIdsByEvent = new Map<string, Set<string>>();

  for (const eventType of EVENT_TYPES) {
    leadIdsByEvent.set(eventType, new Set());
  }

  for (const event of events) {
    const eventLeadIds = leadIdsByEvent.get(event.eventType);

    if (eventLeadIds) {
      eventLeadIds.add(event.leadId);
    }
  }

  const stageCounts = Object.fromEntries(
    EVENT_TYPES.map((eventType) => [
      eventType.toLowerCase(),
      leadIdsByEvent.get(eventType)?.size ?? 0,
    ])
  );

  const totalLeads = leads.length;

  const conversionRates = Object.fromEntries(
    EVENT_TYPES.map((eventType) => {
      const count = leadIdsByEvent.get(eventType)?.size ?? 0;

      return [
        eventType.toLowerCase(),
        percentage(count, totalLeads),
      ];
    })
  );

  const funnelTransitions = [
    ["CONTACTED", "RESPONDED"],
    ["RESPONDED", "INTERESTED"],
    ["INTERESTED", "MEETING"],
    ["MEETING", "PROPOSAL"],
    ["PROPOSAL", "SALE"],
  ] as const;

  const stageConversionRates = Object.fromEntries(
    funnelTransitions.map(([from, to]) => {
      const fromCount = leadIdsByEvent.get(from)?.size ?? 0;
      const toCount = leadIdsByEvent.get(to)?.size ?? 0;

      return [
        `${from.toLowerCase()}_to_${to.toLowerCase()}`,
        {
          from: from.toLowerCase(),
          to: to.toLowerCase(),
          fromCount,
          toCount,
          rate: fromCount > 0 ? percentage(toCount, fromCount) : null,
          available: fromCount > 0,
        },
      ];
    })
  );

  type Bucket = {
    totalLeads: number;
    contacted: number;
    responded: number;
    interested: number;
    meetings: number;
    proposals: number;
    sales: number;
  };

  const byTemperature: Record<string, Bucket> = {};
  const byIntent: Record<string, Bucket> = {};
  const byScoreRange: Record<string, Bucket> = {};

  const stages = [
    "CONTACTED",
    "RESPONDED",
    "INTERESTED",
    "MEETING",
    "PROPOSAL",
    "SALE",
  ] as const;

  function ensureBucket(
    collection: Record<string, Bucket>,
    key: string
  ): Bucket {
    if (!collection[key]) {
      collection[key] = {
        totalLeads: 0,
        contacted: 0,
        responded: 0,
        interested: 0,
        meetings: 0,
        proposals: 0,
        sales: 0,
      };
    }

    return collection[key];
  }

  for (const lead of leads) {
    const temperature = lead.temperature || "sem_temperatura";
    const intent = lead.intentLevel || "sem_intencao";
    const range = scoreRange(lead.leadScore);

    const temperatureBucket = ensureBucket(
      byTemperature,
      temperature
    );

    const intentBucket = ensureBucket(
      byIntent,
      intent
    );

    const scoreBucket = ensureBucket(
      byScoreRange,
      range
    );

    temperatureBucket.totalLeads += 1;
    intentBucket.totalLeads += 1;
    scoreBucket.totalLeads += 1;

    for (const stage of stages) {
      const stageLeads = leadIdsByEvent.get(stage);

      if (!stageLeads?.has(lead.id)) continue;

      const property =
        stage === "CONTACTED"
          ? "contacted"
          : stage === "RESPONDED"
            ? "responded"
            : stage === "INTERESTED"
              ? "interested"
              : stage === "MEETING"
                ? "meetings"
                : stage === "PROPOSAL"
                  ? "proposals"
                  : "sales";

      temperatureBucket[property] += 1;
      intentBucket[property] += 1;
      scoreBucket[property] += 1;
    }
  }

  return NextResponse.json({
    totalLeads,
    totalFeedbackEvents: events.length,
    stages: stageCounts,
    conversionRates,
    stageConversionRates,
    byTemperature,
    byIntent,
    byScoreRange,
  });
}
