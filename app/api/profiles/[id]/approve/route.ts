import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateProspectionSpec } from "@/lib/prospection-engine";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const profile = await prisma.clientProfile.findUnique({
    where: { id: params.id },
    include: {
      prospectionSpecs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });
  }

  // Idempotente: se já foi aprovado e já tem spec, não gera de novo (evita
  // gasto duplicado com a API do Claude).
  if (profile.approved && profile.prospectionSpecs.length > 0) {
    return NextResponse.json({
      profile,
      prospectionSpec: profile.prospectionSpecs[0],
    });
  }

  let draft;
  try {
    draft = await generateProspectionSpec(profile as unknown as Record<string, unknown>);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  const [updatedProfile, prospectionSpec] = await prisma.$transaction([
    prisma.clientProfile.update({
      where: { id: profile.id },
      data: { approved: true, approvedAt: new Date() },
    }),
    prisma.prospectionSpec.create({
      data: {
        clientId: profile.clientId,
        clientProfileId: profile.id,
        target: draft.target as any,
        location: draft.location as any,
        what: draft.what as any,
        discoveryStrategy: draft.discoveryStrategy as any,
        intentSignals: draft.intentSignals as any,
        exclusions: draft.exclusions as any,
        dataRequired: draft.dataRequired as any,
        scoringRules: draft.scoringRules as any,
        stopCriteria: draft.stopCriteria as any,
      },
    }),
  ]);

  return NextResponse.json({ profile: updatedProfile, prospectionSpec });
}
