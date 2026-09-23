import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const spec = await prisma.prospectionSpec.findUnique({ where: { id: params.id } });

  if (!spec) {
    return NextResponse.json({ error: "Prospection Spec não encontrada" }, { status: 404 });
  }

  const updated = await prisma.prospectionSpec.update({
    where: { id: params.id },
    data: { approved: true, approvedAt: new Date() },
  });

  // A partir daqui, esta spec fica pronta para o Apify Adapter (Sprint 04)
  // executar a coleta — nenhuma chamada ao Apify é feita neste sprint.

  return NextResponse.json({ prospectionSpec: updated });
}
