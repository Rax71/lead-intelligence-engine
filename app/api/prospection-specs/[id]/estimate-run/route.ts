import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { estimateRun, resolveMaxItems } from "@/lib/apify-adapter";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json().catch(() => ({}));
  const maxItems = resolveMaxItems(body.maxItems);

  const spec = await prisma.prospectionSpec.findUnique({ where: { id: params.id } });
  if (!spec) {
    return NextResponse.json({ error: "Prospection Spec não encontrada" }, { status: 404 });
  }
  if (!spec.approved) {
    return NextResponse.json(
      { error: "Prospection Spec ainda não foi aprovada." },
      { status: 409 }
    );
  }

  return NextResponse.json({ estimate: estimateRun(maxItems) });
}
