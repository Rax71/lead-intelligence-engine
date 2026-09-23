import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { leads: true, interviewStates: true },
      },
      clientProfiles: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, approved: true },
      },
    },
  });
  return NextResponse.json({ clients });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const businessName = String(body.businessName ?? "").trim();

  if (!businessName) {
    return NextResponse.json(
      { error: "businessName é obrigatório" },
      { status: 400 }
    );
  }

  const client = await prisma.client.create({
    data: {
      businessName,
      contactName: body.contactName || null,
      contactEmail: body.contactEmail || null,
      contactPhone: body.contactPhone || null,
    },
  });

  // Sprint 01 só cria o registro do cliente. A criação do InterviewState
  // (início efetivo da entrevista) entra no Sprint 02.

  return NextResponse.json({ client }, { status: 201 });
}
