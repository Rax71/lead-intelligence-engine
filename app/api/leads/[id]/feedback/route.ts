import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_EVENT_TYPES = [
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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const clientId = request.nextUrl.searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json(
      { error: "clientId é obrigatório." },
      { status: 400 }
    );
  }

  const lead = await prisma.lead.findFirst({
    where: {
      id: params.id,
      clientId,
    },
    select: { id: true },
  });

  if (!lead) {
    return NextResponse.json(
      { error: "Lead não encontrado para este cliente." },
      { status: 404 }
    );
  }

  const feedbackEvents = await prisma.feedbackEvent.findMany({
    where: { leadId: lead.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ feedbackEvents });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const { clientId, eventType, notes } = body;

  if (!clientId) {
    return NextResponse.json(
      { error: "clientId é obrigatório." },
      { status: 400 }
    );
  }

  if (!eventType) {
    return NextResponse.json(
      { error: "eventType é obrigatório." },
      { status: 400 }
    );
  }

  if (!VALID_EVENT_TYPES.includes(eventType)) {
    return NextResponse.json(
      { error: "eventType inválido." },
      { status: 400 }
    );
  }

  const lead = await prisma.lead.findFirst({
    where: {
      id: params.id,
      clientId,
    },
  });

  if (!lead) {
    return NextResponse.json(
      { error: "Lead não encontrado para este cliente." },
      { status: 404 }
    );
  }

  const feedbackEvent = await prisma.feedbackEvent.create({
    data: {
      leadId: lead.id,
      eventType,
      notes: notes || null,
    },
  });

  return NextResponse.json(
    { feedbackEvent },
    { status: 201 }
  );
}
