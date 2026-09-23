import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { normalizeRawItem, dedupeLeads } from "./lead-normalizer";
import { scoreLeads } from "./scoring-engine";

export type ProcessRunSummary = {
  totalRaw: number;
  totalDeduped: number;
  totalCreated: number;
  totalUpdated: number;
  totalDiscarded: number;
  totalNeedsReview: number;
};

export async function processRun(runId: string): Promise<ProcessRunSummary> {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: { prospectionSpec: true },
  });

  if (!run) throw new Error("Run nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o encontrada.");
  if (run.status !== "COMPLETED") {
    throw new Error(`Run ainda nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o estÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ COMPLETED (status atual: ${run.status}).`);
  }

  const rawItems = Array.isArray(run.rawItems) ? (run.rawItems as any[]) : [];
  const normalized = rawItems.map((item, i) => normalizeRawItem(item, i));
  const deduped = dedupeLeads(normalized);
  const reindexed = deduped.map((lead, i) => ({ ...lead, index: i }));

  // Estado já persistido para ESTA run — pode ser parcial, de uma tentativa
  // anterior que falhou no meio da persistência. Nunca tratamos "existe
  // pelo menos 1 Lead" como "está tudo pronto": comparamos item a item.
  const existingLeadsForRun = await prisma.lead.findMany({ where: { runId } });

  const persistedKeys = new Set(
    existingLeadsForRun
      .filter((l) => l.identityKey)
      .map((l) => l.identityKey as string)
  );
  const persistedNullKeyCount = existingLeadsForRun.filter(
    (l) => !l.identityKey
  ).length;

  // Itens sem identityKey (dados insuficientes para uma identidade estável)
  // não podem ser comparados por chave. `reindexed` é sempre a mesma lista,
  // na mesma ordem, em qualquer tentativa (deriva só de `run.rawItems`, que
  // nunca muda depois de criada a Run) — então usamos a posição dentro dela
  // como correspondência determinística: os N primeiros itens sem
  // identityKey já têm N Leads sem identityKey persistidos para esta run
  // (criados na mesma ordem em tentativas anteriores); só o restante é
  // pendente.
  let nullKeySeen = 0;
  const pendingItems = reindexed.filter((lead) => {
    if (lead.identityKey) {
      return !persistedKeys.has(lead.identityKey);
    }

    nullKeySeen += 1;
    return nullKeySeen > persistedNullKeyCount;
  });

  if (pendingItems.length === 0) {
    // Nada pendente: a run já foi totalmente processada (de uma vez só ou
    // ao longo de tentativas anteriores). Não chama o Scoring Engine de
    // novo — devolve o resumo com base no que já está persistido.
    return {
      totalRaw: rawItems.length,
      totalDeduped: reindexed.length,
      totalCreated: existingLeadsForRun.filter((l) => l.status !== "DISCARDED").length,
      totalUpdated: 0,
      totalDiscarded: existingLeadsForRun.filter((l) => l.status === "DISCARDED").length,
      totalNeedsReview: existingLeadsForRun.filter((l) => l.status === "REVIEWED").length,
    };
  }

  const spec = run.prospectionSpec;

  // Só envia ao Scoring Engine (Anthropic) o que ainda falta persistir —
  // itens já concluídos em uma tentativa anterior não são reenviados.
  const scored = await scoreLeads(
    {
      target: spec.target,
      what: spec.what,
      location: spec.location,
      exclusions: spec.exclusions,
      intentSignals: spec.intentSignals,
      scoringRules: spec.scoringRules,
    },
    pendingItems
  );

  const scoredByIndex = new Map(scored.map((s) => [s.index, s]));

  // Parte do total já persistida antes desta chamada, contada com a mesma
  // fórmula do retorno "nada pendente" acima — garante que o resumo final
  // reflita o total real da run, não só o que esta chamada processou.
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalDiscarded = 0;
  let totalNeedsReview = 0;

  for (const lead of pendingItems) {
    const score = scoredByIndex.get(lead.index);
    const isExcluded = score?.exclude ?? false;
    const isReview = score?.needsReview ?? false;

    const leadData = {
      clientId: run.clientId,
      runId: run.id,
      identityKey: lead.identityKey,
      placeId: lead.placeId,
      companyName: lead.companyName,
      phone: lead.phone,
      website: lead.website,
      address: lead.address,
      city: lead.city,
      neighborhood: lead.neighborhood,
      industry: lead.industry,
      leadScore: score?.leadScore ?? null,
      confidenceScore: score?.confidenceScore ?? null,
      temperature: score?.temperature ?? null,
      intentLevel: score?.intentLevel ?? null,
      intentSource: score?.intentSource ?? null,
      fitReasons: (score?.fitReasons ?? []) as any,
      intentReasons: (score?.intentReasons ?? []) as any,
      painReasons: (score?.painReasons ?? []) as any,
      negativeSignals: (score?.negativeSignals ?? []) as any,
      evidence: [
        {
          source: "Google Maps",
          url: lead.mapsUrl,
          type: "listing",
          summary: `Rating ${lead.rating ?? "N/A"} (${lead.raw && (lead.raw as any).reviewsCount ? (lead.raw as any).reviewsCount : "0"} reviews)`,
        },
      ] as any,
      sources: ["Google Maps Scraper"] as any,
      recommendedAction: score?.recommendedAction ?? null,
      recommendedChannel: score?.recommendedChannel ?? null,
    };

    const existingLead = lead.identityKey
      ? await prisma.lead.findFirst({
          where: {
            clientId: run.clientId,
            identityKey: lead.identityKey,
          },
        })
      : null;

    if (existingLead) {
      const nextStatus =
        existingLead.status === "CONTACTED"
          ? "CONTACTED"
          : existingLead.status === "NEW" ||
              existingLead.status === "REVIEWED" ||
              existingLead.status === "DISCARDED"
            ? isExcluded
              ? "DISCARDED"
              : isReview
                ? "REVIEWED"
                : "NEW"
            : existingLead.status;

      await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          ...leadData,
          status: nextStatus,
        },
      });

      totalUpdated += 1;
      if (nextStatus === "DISCARDED") totalDiscarded += 1;
      else if (nextStatus === "REVIEWED") totalNeedsReview += 1;
    } else {
  try {
    await prisma.lead.create({
      data: {
        ...leadData,
        status: isExcluded
          ? "DISCARDED"
          : isReview
            ? "REVIEWED"
            : "NEW",
      },
    });

    if (isExcluded) totalDiscarded += 1;
    else if (isReview) totalNeedsReview += 1;
    else totalCreated += 1;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      lead.identityKey
    ) {
      const concurrentLead = await prisma.lead.findFirst({
        where: {
          clientId: run.clientId,
          identityKey: lead.identityKey,
        },
      });

      if (!concurrentLead) {
        throw error;
      }

      await prisma.lead.update({
        where: { id: concurrentLead.id },
        data: {
          ...leadData,
          status:
            concurrentLead.status === "CONTACTED"
              ? "CONTACTED"
              : concurrentLead.status === "NEW" ||
                  concurrentLead.status === "REVIEWED" ||
                  concurrentLead.status === "DISCARDED"
                ? isExcluded
                  ? "DISCARDED"
                  : isReview
                    ? "REVIEWED"
                    : "NEW"
                : concurrentLead.status,
        },
      });

      totalUpdated += 1;
    } else {
      throw error;
    }
  }
  }
}

  return {
    totalRaw: rawItems.length,
    totalDeduped: reindexed.length,
    totalCreated,
    totalUpdated,
    totalDiscarded,
    totalNeedsReview,
  };
}





