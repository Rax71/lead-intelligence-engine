import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SPEC_FIELD_KEYS } from "@/lib/spec-fields";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const spec = await prisma.prospectionSpec.findUnique({
    where: { id: params.id },
    include: { client: true, clientProfile: true },
  });

  if (!spec) {
    return NextResponse.json({ error: "Prospection Spec não encontrada" }, { status: 404 });
  }

  return NextResponse.json({ prospectionSpec: spec });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const existing = await prisma.prospectionSpec.findUnique({ where: { id: params.id } });

  if (!existing) {
    return NextResponse.json({ error: "Prospection Spec não encontrada" }, { status: 404 });
  }

  if (existing.approved) {
    return NextResponse.json(
      { error: "Prospection Spec já aprovada — não pode mais ser editada." },
      { status: 409 }
    );
  }

  const data: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    if (!SPEC_FIELD_KEYS.has(key)) continue;

    if (typeof value === "string") {
      try {
        data[key] = JSON.parse(value);
      } catch {
        return NextResponse.json(
          { error: `Campo "${key}" não é um JSON válido.` },
          { status: 400 }
        );
      }
    } else {
      data[key] = value;
    }
  }

  const spec = await prisma.prospectionSpec.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json({ prospectionSpec: spec });
}
