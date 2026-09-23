import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runInterviewTurn, EngineTurnResult } from "@/lib/interview-engine";
import { ClaudeMessage } from "@/lib/anthropic";
import { mapProfileDraftToClientProfileData } from "@/lib/profile-mapper";

export async function POST(request: NextRequest) {
  const { interviewStateId, answer } = await request.json();


  if (!interviewStateId || !answer) {
    return NextResponse.json(
      { error: "interviewStateId e answer sÃ£o obrigatÃ³rios" },
      { status: 400 }
    );
  }

  const interviewState = await prisma.interviewState.findUnique({
    where: { id: interviewStateId },
    include: { client: true },
  });

  if (!interviewState) {
    return NextResponse.json({ error: "Entrevista nÃ£o encontrada" }, { status: 404 });
  }

  if (interviewState.status !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "Esta entrevista jÃ¡ foi concluÃ­da." },
      { status: 409 }
    );
  }

  const transcript = (interviewState.transcript as unknown as ClaudeMessage[]) || [];
  function getPreviousCommercialField(
    messages: ClaudeMessage[]
  ): string | null {
    for (const message of [...messages].reverse()) {
      if (message.role !== "assistant") continue;

      try {
        const parsed = JSON.parse(message.content);

        if (
          parsed &&
          typeof parsed.nextCommercialField === "string" &&
          parsed.nextCommercialField.trim()
        ) {
          return parsed.nextCommercialField.trim();
        }
      } catch {
        // Ignora mensagens antigas que não estejam em JSON válido.
      }
    }

    return null;
  }

  const previousCommercialField = getPreviousCommercialField(transcript);

  const normalizedAnswer = String(answer).trim();

  const lastUserMessage = [...transcript]
    .reverse()
    .find((message) => message.role === "user");

  if (lastUserMessage) {
    const marker = "RESPOSTA_DO_CLIENTE:";
    const markerIndex = lastUserMessage.content.lastIndexOf(marker);

    if (markerIndex !== -1) {
      const previousAnswer = lastUserMessage.content
        .slice(markerIndex + marker.length)
        .trim();

      if (
        previousAnswer &&
        previousAnswer === normalizedAnswer
      ) {
        return NextResponse.json(
          {
            error: "Esta resposta jÃ¡ foi processada.",
            duplicate: true,
          },
          { status: 409 }
        );
      }
    }
  }

  let result: EngineTurnResult;
  try {
    result = await runInterviewTurn({
      businessName: interviewState.client.businessName,
      profileDraft: (interviewState.answeredFields as Record<string, unknown>) || {},
      stateMeta: {
        unknownFields: (interviewState.unknownFields as string[]) || [],
        inferredFields: (interviewState.inferredFields as Record<string, unknown>) || {},
        conflictingFields: (interviewState.conflictingFields as string[]) || [],
        confidence: (interviewState.confidence as Record<string, number>) || {},
        activeBranch: interviewState.activeBranch,
        completedBranches: (interviewState.completedBranches as string[]) || [],
        pendingBranches: (interviewState.pendingBranches as string[]) || [],
      },
      transcript,
      lastClientMessage: answer,
      previousCommercialField,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }


  const updatedTranscript: ClaudeMessage[] = [
    ...transcript,
    { role: "user", content: `RESPOSTA_DO_CLIENTE: ${answer}` },
    { role: "assistant", content: JSON.stringify(result) },
  ];

  console.log("=== DEBUG BEFORE PRISMA ===", JSON.stringify(result.profile));
  const updated = await prisma.interviewState.update({
    where: { id: interviewStateId },
    data: {
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
      transcript: updatedTranscript as any,
    },
  });

  let clientProfileId: string | null = null;

  if (result.done) {
    const profileData = mapProfileDraftToClientProfileData(result.profile, {
      assumptions: result.assumptions,
      confidence: result.interviewState.confidence,
      profileReadiness: result.profileReadiness,
    });

    const clientProfile = await prisma.clientProfile.create({
      data: {
        clientId: interviewState.clientId,
        ...(profileData as any),
      },
    });
    clientProfileId = clientProfile.id;
  }

  return NextResponse.json({
    interviewState: updated,
    question: result.nextQuestion,
    message: result.messageToClient,
    profileReadiness: result.profileReadiness,
    done: result.done,
    clientProfileId,
  });
}





