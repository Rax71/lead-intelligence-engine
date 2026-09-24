import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildLeadPackage } from "@/lib/lead-package";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
  });

  if (!lead) {
    return NextResponse.json(
      { error: "Lead não encontrado." },
      { status: 404 }
    );
  }

  // Lead → Run → ProspectionSpec. Um lead sem runId é um estado válido (o
  // bloco de contexto do Lead Package simplesmente fica indisponível) — não
  // é erro. Já um runId presente que não resolve para uma Run real, ou uma
  // Run sem ProspectionSpec, é inconsistência de dados: não fabricamos
  // nada nesses casos, retornamos erro.
  const run = lead.runId
    ? await prisma.run.findUnique({
        where: { id: lead.runId },
        include: { prospectionSpec: true },
      })
    : null;

  if (lead.runId && !run) {
    return NextResponse.json(
      { error: "Run relacionada ao lead não foi encontrada (inconsistência de dados)." },
      { status: 409 }
    );
  }

  if (run && !run.prospectionSpec) {
    return NextResponse.json(
      {
        error:
          "ProspectionSpec relacionada à run não foi encontrada (inconsistência de dados).",
      },
      { status: 409 }
    );
  }

  const prospectionSpec = run?.prospectionSpec ?? null;

  const feedbackEvents = await prisma.feedbackEvent.findMany({
    where: { leadId: lead.id },
    orderBy: { createdAt: "asc" },
  });

  try {
    const leadPackage = buildLeadPackage(
      {
        id: lead.id,
        companyName: lead.companyName,
        personName: lead.personName,
        role: lead.role,
        industry: lead.industry,
        subindustry: lead.subindustry,
        address: lead.address,
        city: lead.city,
        neighborhood: lead.neighborhood,
        phone: lead.phone,
        whatsapp: lead.whatsapp,
        email: lead.email,
        website: lead.website,
        leadScore: lead.leadScore,
        confidenceScore: lead.confidenceScore,
        temperature: lead.temperature,
        intentLevel: lead.intentLevel,
        intentSource: lead.intentSource,
        fitReasons: lead.fitReasons,
        intentReasons: lead.intentReasons,
        painReasons: lead.painReasons,
        negativeSignals: lead.negativeSignals,
        evidence: lead.evidence,
        sources: lead.sources,
        recommendedAction: lead.recommendedAction,
        recommendedChannel: lead.recommendedChannel,
        status: lead.status,
        identityKey: lead.identityKey,
        placeId: lead.placeId,
      },
      run
        ? {
            id: run.id,
            status: run.status,
            createdAt: run.createdAt,
          }
        : null,
      prospectionSpec
        ? {
            target: prospectionSpec.target,
            location: prospectionSpec.location,
            what: prospectionSpec.what,
            discoveryStrategy: prospectionSpec.discoveryStrategy,
            intentSignals: prospectionSpec.intentSignals,
            exclusions: prospectionSpec.exclusions,
            dataRequired: prospectionSpec.dataRequired,
            scoringRules: prospectionSpec.scoringRules,
            stopCriteria: prospectionSpec.stopCriteria,
          }
        : null,
      feedbackEvents.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        notes: event.notes,
        createdAt: event.createdAt,
      }))
    );

    return NextResponse.json(leadPackage);
  } catch (error) {
    return NextResponse.json(
      { error: "Falha ao montar o Lead Package." },
      { status: 500 }
    );
  }
}
