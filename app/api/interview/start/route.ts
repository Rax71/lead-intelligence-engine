import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  runInterviewTurn,
  emptyStateMeta,
  EngineTurnResult,
} from "@/lib/interview-engine";
import { ClaudeMessage } from "@/lib/anthropic";

export async function POST(request: NextRequest) {
  const { clientId } = await request.json();

  if (!clientId) {
    return NextResponse.json(
      { error: "clientId é obrigatório" },
      { status: 400 }
    );
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
  });

  if (!client) {
    return NextResponse.json(
      { error: "Cliente não encontrado" },
      { status: 404 }
    );
  }

    // Primeiro, retoma uma entrevista em andamento.
  const existingInProgress = await prisma.interviewState.findFirst({
    where: { clientId, status: "IN_PROGRESS" },
    orderBy: { createdAt: "desc" },
  });

  if (existingInProgress) {
    const transcript =
      (existingInProgress.transcript as unknown as ClaudeMessage[]) || [];

    const lastAssistant = [...transcript]
      .reverse()
      .find((m) => m.role === "assistant");

    let question: string | null = null;
    let message: string | null = null;

    if (lastAssistant) {
      try {
        const parsed = JSON.parse(lastAssistant.content);
        question = parsed.nextQuestion ?? null;
        message = parsed.messageToClient ?? null;
      } catch {
        // transcript antigo/corrompido — segue sem reexibir a pergunta
      }
    }

    return NextResponse.json({
      interviewState: existingInProgress,
      question,
      message,
      clientProfileId: null,
    });
  }

  // Se não há entrevista em andamento, procura a última concluída.
  const existingReady = await prisma.interviewState.findFirst({
    where: { clientId, status: "READY" },
    orderBy: { createdAt: "desc" },
  });

  if (existingReady) {
    const latestProfile = await prisma.clientProfile.findFirst({
      where: { clientId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      interviewState: existingReady,
      question: null,
      message: "Esta entrevista já foi concluída.",
      clientProfileId: latestProfile?.id ?? null,
    });
  }

  let result: EngineTurnResult;

  try {
    result = await runInterviewTurn({
      businessName: client.businessName,
      profileDraft: {},
      stateMeta: emptyStateMeta(),
      transcript: [],
      lastClientMessage: null,
    });
  } catch (err) {
    console.error("INTERVIEW_START_CLAUDE_ERROR:", err);

    return NextResponse.json(
      {
        error: String(err),
        cause: err instanceof Error ? err.cause : null,
      },
      { status: 502 }
    );
  }

  const transcript: ClaudeMessage[] = [
    {
      role: "user",
      content: `CONTEXTO_ATUAL: início da entrevista para "${client.businessName}"`,
    },
    {
      role: "assistant",
      content: JSON.stringify(result),
    },
  ];

  const interviewState = await prisma.interviewState.create({
    data: {
      clientId,
      answeredFields: result.profile as any,
      unknownFields: result.interviewState.unknownFields as any,
      inferredFields: result.interviewState.inferredFields as any,
      conflictingFields: result.interviewState.conflictingFields as any,
      confidence: result.interviewState.confidence as any,
      activeBranch: result.interviewState.activeBranch,
      completedBranches: result.interviewState.completedBranches as any,
      pendingBranches: result.interviewState.pendingBranches as any,
      profileReadiness: result.profileReadiness,
      status: result.done ? "READY" : "IN_PROGRESS",
      transcript: transcript as any,
    },
  });

  return NextResponse.json({
    interviewState,
    question: result.nextQuestion,
    message: result.messageToClient,
  });
}