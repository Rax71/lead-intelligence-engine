import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const client = await prisma.client.findUnique({
    where: { id: params.id },
  });

  if (!client) {
    return NextResponse.json(
      { error: "Cliente não encontrado" },
      { status: 404 }
    );
  }

  const runId = request.nextUrl.searchParams.get("runId");

  const leads = await prisma.lead.findMany({
    where: {
      clientId: params.id,
      ...(runId ? { runId } : {}),
    },
    orderBy: [{ leadScore: "desc" }, { createdAt: "desc" }],
  });

  return new NextResponse(
    JSON.stringify({ client, leads }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    }
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const { leadId, status } = body;

  if (!leadId || !status) {
    return NextResponse.json(
      { error: "leadId e status são obrigatórios." },
      { status: 400 }
    );
  }

  const validStatuses = ["NEW", "REVIEWED", "CONTACTED", "DISCARDED"];

  if (!validStatuses.includes(status)) {
    return NextResponse.json(
      { error: "Status inválido." },
      { status: 400 }
    );
  }

  const lead = await prisma.lead.findFirst({
    where: {
      id: leadId,
      clientId: params.id,
    },
  });

  if (!lead) {
    return NextResponse.json(
      { error: "Lead não encontrado para este cliente." },
      { status: 404 }
    );
  }

  const updatedLead = await prisma.lead.update({
    where: { id: lead.id },
    data: { status },
  });

  return NextResponse.json({
    lead: updatedLead,
  });
}