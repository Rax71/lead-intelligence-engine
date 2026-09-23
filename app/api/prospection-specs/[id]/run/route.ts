import { NextRequest, NextResponse } from "next/server";
import {
  executeProspectionRun,
  resolveMaxItems,
  resolveMaxRunCost,
} from "@/lib/apify-adapter";

// Estende o tempo máximo da função serverless (Vercel Hobby permite até
// 60s). Runs maiores que isso devem ficar para uma versão assíncrona
// (webhook do Apify) pós-MVP — fora de escopo deste sprint.
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json().catch(() => ({}));
  const maxItems = resolveMaxItems(body.maxItems);
  const maxRunCost = resolveMaxRunCost(body.maxRunCost);

  try {
    const result = await executeProspectionRun({
      prospectionSpecId: params.id,
      maxItems,
      maxRunCost,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || String(err), run: err?.run ?? null },
      { status: 502 }
    );
  }
}
