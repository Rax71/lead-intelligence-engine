import { NextRequest, NextResponse } from "next/server";
import { processRun } from "@/lib/lead-processor";

export const maxDuration = 60;

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const summary = await processRun(params.id);
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
