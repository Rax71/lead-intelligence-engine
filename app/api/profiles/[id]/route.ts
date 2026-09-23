import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PROFILE_FIELD_KEYS } from "@/lib/profile-fields";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const profile = await prisma.clientProfile.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      prospectionSpecs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ profile });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const existing = await prisma.clientProfile.findUnique({ where: { id: params.id } });

  if (!existing) {
    return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });
  }

  if (existing.approved) {
    return NextResponse.json(
      { error: "Perfil já aprovado — não pode mais ser editado." },
      { status: 409 }
    );
  }

  const data: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    if (!PROFILE_FIELD_KEYS.has(key)) continue;

    if (key === "radiusKm") {
      data[key] = value === "" || value === null ? null : Number(value);
      continue;
    }

    // Campos de texto simples ficam como string; campos json chegam da UI
    // já como string (textarea) e precisam ser parseados.
    const looksLikeJson =
      typeof value === "string" &&
      (value.trim().startsWith("[") || value.trim().startsWith("{"));

    if (looksLikeJson) {
      try {
        data[key] = JSON.parse(value as string);
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

  const profile = await prisma.clientProfile.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json({ profile });
}
