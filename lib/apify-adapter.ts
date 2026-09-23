import { prisma } from "./prisma";
import { runApifyActorSync } from "./apify";
import {
  GOOGLE_MAPS_SCRAPER,
  ensureActorRegistered,
} from "./actor-registry";

export const DEFAULT_MAX_ITEMS = 30;
export const DEFAULT_MAX_RUN_COST_USD = 5;

// Tetos absolutos definidos pelo servidor — o chamador da API não pode
// ultrapassá-los enviando um valor maior no corpo da requisição.
export const MAX_ITEMS_LIMIT = 500;
export const MAX_RUN_COST_LIMIT_USD = 50;

// Validação server-side de maxItems: inteiro finito >= 0, limitado ao teto
// absoluto. Entrada ausente ou inválida cai no default — nunca no valor cru
// enviado pelo chamador. Não usa `Number(value) || default` de propósito:
// esse padrão trata 0 como "ausente" e deixa passar negativos.
export function resolveMaxItems(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_MAX_ITEMS;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    return DEFAULT_MAX_ITEMS;
  }

  return Math.min(parsed, MAX_ITEMS_LIMIT);
}

// Validação server-side de maxRunCost: número finito >= 0, limitado ao teto
// absoluto. Mesma lógica de resolveMaxItems, sem exigir inteiro (custo pode
// ser fracionário).
export function resolveMaxRunCost(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_MAX_RUN_COST_USD;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_MAX_RUN_COST_USD;
  }

  return Math.min(parsed, MAX_RUN_COST_LIMIT_USD);
}

// Estados de Run que representam uma reserva/execução ainda em curso para a
// mesma ProspectionSpec. Enquanto existir uma Run nesses estados, uma nova
// chamada a executeProspectionRun não deve criar outra Run nem chamar a
// Apify de novo — deve reaproveitar a Run existente.
// COMPLETED, FAILED e BLOCKED_COST_LIMIT são estados terminais: depois
// deles, a spec pode ser executada de novo normalmente (regra de negócio
// atual, preservada aqui).
const ACTIVE_RUN_STATUSES = ["ESTIMATED", "PENDING_APPROVAL", "RUNNING"] as const;

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function buildGoogleMapsInput(spec: any, maxItems: number) {
  const what = spec.what || {};
  const target = spec.target || {};
  const location = spec.location || {};

  const rawSegments = Array.isArray(target.segments)
    ? target.segments
        .filter(
          (segment: unknown) =>
            typeof segment === "string" && segment.trim()
        )
        .map((segment: string) => segment.trim())
    : [];

  const searchStrings = rawSegments
    .filter(
      (segment: string) =>
        !segment.toLowerCase().includes("pequenas e médias empresas")
    )
    .map((segment: string) => {
      const normalized = segment.toLowerCase();

      if (normalized === "comércio" || normalized === "comercio") {
        return "empresas de comércio";
      }

      if (normalized === "empresas de serviços") {
        return "empresas de serviços";
      }

      return segment;
    });

  if (searchStrings.length === 0) {
    searchStrings.push(
      firstNonEmpty(
        what.search_term,
        what.query,
        what.description,
        target.description,
        target.business_type,
        "empresas"
      )
    );
  }

  const rawLocation = firstNonEmpty(
    location.city,
    location.preferred_locations?.[0],
    location.description,
    location.area,
    location.region,
    location.geography
  );

  const locationQuery = /fortaleza/i.test(rawLocation)
    ? "Fortaleza, Ceará"
    : rawLocation;

  return {
    searchStringsArray: searchStrings,
    locationQuery,
    maxCrawledPlacesPerSearch: maxItems,
    language: "pt-BR",
  };
}

export function estimateRun(maxItems: number) {
  const actor = GOOGLE_MAPS_SCRAPER;

  const estimatedCost = Number(
    (actor.estimatedCostPerItem * maxItems).toFixed(4)
  );

  return {
    actorId: actor.actorId,
    actorName: actor.name,
    maxItems,
    estimatedCost,
    notes: actor.notes,
  };
}

export async function executeProspectionRun(params: {
  prospectionSpecId: string;
  maxItems?: number;
  maxRunCost?: number;
}) {
  const spec = await prisma.prospectionSpec.findUnique({
    where: {
      id: params.prospectionSpecId,
    },
  });

  if (!spec) {
    throw new Error("Prospection Spec não encontrada.");
  }

  if (!spec.approved) {
    throw new Error("Prospection Spec ainda não foi aprovada.");
  }

  // Revalida aqui também (defesa em profundidade): garante o teto mesmo se
  // esta função for chamada diretamente, sem passar pela rota /run.
  const maxItems = resolveMaxItems(params.maxItems);
  const maxRunCost = resolveMaxRunCost(params.maxRunCost);

  const actor = GOOGLE_MAPS_SCRAPER;

  await ensureActorRegistered(actor);

  const actorEntry = await prisma.actorRegistryEntry.findUnique({
    where: {
      actorId: actor.actorId,
    },
  });

  const estimatedCost = Number(
    (actor.estimatedCostPerItem * maxItems).toFixed(4)
  );

  // Seção crítica de concorrência: um advisory lock do Postgres, escopado à
  // transaction (funciona sob o pooling em modo "transaction" do PgBouncer/
  // Supabase — diferente de um lock de sessão, que não sobreviveria à troca
  // de conexão física do pool), serializa "checar se já existe Run ativa" +
  // "criar Run" para a mesma ProspectionSpec. Isso fecha a janela de corrida
  // entre findFirst e create: duas requisições concorrentes nunca passam
  // dessa checagem ao mesmo tempo — a segunda espera a primeira liberar o
  // lock (ao fim da transaction) e então enxerga a Run recém-criada. A
  // transaction é curta (só leitura/escrita no banco); a chamada à Apify
  // continua acontecendo depois, fora dela.
  const claim = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${spec.id})::bigint)`;

    const activeRun = await tx.run.findFirst({
      where: {
        prospectionSpecId: spec.id,
        status: { in: [...ACTIVE_RUN_STATUSES] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (activeRun) {
      return { kind: "already_running" as const, run: activeRun };
    }

    if (estimatedCost > maxRunCost) {
      const run = await tx.run.create({
        data: {
          clientId: spec.clientId,
          prospectionSpecId: spec.id,
          actorRegistryId: actorEntry?.id,
          status: "BLOCKED_COST_LIMIT",
          maxItems,
          maxRunCost,
          estimatedCost,
        },
      });

      return { kind: "blocked" as const, run };
    }

    const run = await tx.run.create({
      data: {
        clientId: spec.clientId,
        prospectionSpecId: spec.id,
        actorRegistryId: actorEntry?.id,
        status: "RUNNING",
        maxItems,
        maxRunCost,
        estimatedCost,
        startedAt: new Date(),
      },
    });

    return { kind: "started" as const, run };
  });

  if (claim.kind === "already_running") {
    return {
      run: claim.run,
      blocked: false as const,
      alreadyRunning: true as const,
    };
  }

  if (claim.kind === "blocked") {
    return {
      run: claim.run,
      blocked: true as const,
    };
  }

  const run = claim.run;

  const input = buildGoogleMapsInput(spec, maxItems);

  console.log("[APIFY ADAPTER] Actor:", actor.actorId);
  console.log("[APIFY ADAPTER] Input:", JSON.stringify(input, null, 2));

  try {
    const items = await runApifyActorSync({
      actorId: actor.actorId,
      input,
    });

    const actualCost = Number(
      (actor.estimatedCostPerItem * items.length).toFixed(4)
    );

    const updated = await prisma.run.update({
      where: {
        id: run.id,
      },
      data: {
        status: "COMPLETED",
        itemsCollected: items.length,
        actualCost,
        rawItems: items as any,
        finishedAt: new Date(),
      },
    });

    return {
      run: updated,
      blocked: false as const,
    };
  } catch (err) {
    const failed = await prisma.run.update({
      where: {
        id: run.id,
      },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        rawItems: {
          error: String(err),
        } as any,
      },
    });

    throw Object.assign(new Error(String(err)), {
      run: failed,
    });
  }
}

