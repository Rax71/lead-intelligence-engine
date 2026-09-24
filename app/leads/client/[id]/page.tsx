"use client";

import { useEffect, useState, Fragment } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import type { LeadPackage } from "@/lib/lead-package";

type LeadRow = {
  id: string;
  companyName: string;
  phone: string | null;
  website: string | null;
  city: string | null;
  industry: string | null;
  leadScore: number | null;
  confidenceScore: number | null;
  temperature: string | null;
  status: string;
  fitReasons: string[] | null;
  intentLevel: string | null;
  intentSource: string | null;
  intentReasons: string[] | null;
  negativeSignals: string[] | null;
  recommendedAction: string | null;
  recommendedChannel: string | null;
};

type FeedbackEvent = {
  id: string;
  leadId: string;
  eventType: string;
  notes: string | null;
  createdAt: string;
};

const FEEDBACK_OPTIONS = [
  ["CONTACTED", "Contatado"],
  ["RESPONDED", "Respondeu"],
  ["INTERESTED", "Interessado"],
  ["MEETING", "Reunião"],
  ["PROPOSAL", "Proposta"],
  ["SALE", "Venda"],
  ["NO_RESPONSE", "Sem resposta"],
  ["WRONG_DATA", "Dados errados"],
  ["NO_FIT", "Sem fit"],
  ["LOST", "Perdido"],
] as const;

function tempClass(temp: string | null) {
  if (!temp) return "temp-frio";
  const t = temp.toLowerCase();
  if (t.includes("quente") || t.includes("hot")) return "temp-quente";
  if (t.includes("morno") || t.includes("warm")) return "temp-morno";
  return "temp-frio";
}

function feedbackLabel(eventType: string) {
  return (
    FEEDBACK_OPTIONS.find(([value]) => value === eventType)?.[1] || eventType
  );
}

function formatFeedbackDate(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

// Renderiza valores Json?/unknown do contexto da campanha (ProspectionSpec)
// de forma legível, sem nunca despejar o objeto bruto na tela.
function describeUnknown(value: unknown): string {
  if (value === null || value === undefined) return "Não informado";

  if (typeof value === "string") {
    return value.trim() || "Não informado";
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => (typeof item === "string" ? item : describeUnknown(item)))
      .filter((item) => item && item !== "Não informado");
    return parts.length > 0 ? parts.join("; ") : "Não informado";
  }

  if (typeof value === "object") {
    const parts = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${k}: ${typeof v === "string" ? v : describeUnknown(v)}`);
    return parts.length > 0 ? parts.join(" · ") : "Não informado";
  }

  return String(value);
}

const PRIORITY_STYLES: Record<string, { background: string; color: string }> = {
  ALTA: { background: "rgba(79, 209, 165, 0.15)", color: "var(--signal)" },
  MEDIA: { background: "rgba(232, 163, 61, 0.15)", color: "#e8a33d" },
  REVISAO_MANUAL: { background: "rgba(139, 151, 166, 0.15)", color: "var(--text-muted)" },
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--text-muted)",
  marginBottom: 6,
};

export default function ClientLeadsPage({
  params,
}: {
  params: { id: string };
}) {
  const [clientName, setClientName] = useState<string>("");
  const [leads, setLeads] = useState<LeadRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<Record<string, string>>({});
  const [feedbackNotes, setFeedbackNotes] = useState<Record<string, string>>(
    {}
  );
  const [feedbackSaving, setFeedbackSaving] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<
    Record<string, string>
  >({});
  const [feedbackHistory, setFeedbackHistory] = useState<
    Record<string, FeedbackEvent[]>
  >({});
  const [feedbackLoading, setFeedbackLoading] = useState<string | null>(null);
  const [feedbackHistoryError, setFeedbackHistoryError] = useState<
    Record<string, string>
  >({});
  const [leadPackages, setLeadPackages] = useState<
    Record<string, LeadPackage>
  >({});
  const [leadPackageLoading, setLeadPackageLoading] = useState<string | null>(
    null
  );
  const [leadPackageError, setLeadPackageError] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setError(null);
    try {
      const res = await fetch(`/api/clients/${params.id}/leads`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao carregar leads");
      setClientName(data.client.businessName);
      setLeads(data.leads);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    }
  }

  async function loadFeedbackHistory(leadId: string) {
    setFeedbackLoading(leadId);
    setFeedbackHistoryError((current) => ({
      ...current,
      [leadId]: "",
    }));

    try {
      const res = await fetch(`/api/leads/${leadId}/feedback?clientId=${params.id}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Falha ao carregar histórico");
      }

      setFeedbackHistory((current) => ({
        ...current,
        [leadId]: data.feedbackEvents || [],
      }));
    } catch (err) {
      setFeedbackHistoryError((current) => ({
        ...current,
        [leadId]:
          err instanceof Error
            ? err.message
            : "Erro ao carregar histórico.",
      }));
    } finally {
      setFeedbackLoading(null);
    }
  }

  async function loadLeadPackage(leadId: string) {
    setLeadPackageLoading(leadId);
    setLeadPackageError((current) => ({ ...current, [leadId]: "" }));

    try {
      const res = await fetch(`/api/leads/${leadId}/package`);

      if (!res.ok) {
        throw new Error("Falha ao carregar Lead Package");
      }

      const data = (await res.json()) as LeadPackage;

      setLeadPackages((current) => ({
        ...current,
        [leadId]: data,
      }));
    } catch {
      setLeadPackageError((current) => ({
        ...current,
        [leadId]: "Não foi possível carregar o Lead Package.",
      }));
    } finally {
      setLeadPackageLoading(null);
    }
  }

  function toggleExpanded(leadId: string) {
    const next = expanded === leadId ? null : leadId;
    setExpanded(next);

    if (next && feedbackHistory[next] === undefined) {
      loadFeedbackHistory(next);
    }

    if (next && leadPackages[next] === undefined) {
      loadLeadPackage(next);
    }
  }

  async function updateStatus(leadId: string, status: string) {
    setError(null);
    try {
      const res = await fetch(`/api/clients/${params.id}/leads`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao atualizar status");

      setLeads((current) =>
        current
          ? current.map((lead) =>
              lead.id === leadId ? { ...lead, status: data.lead.status } : lead
            )
          : current
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    }
  }

  async function registerFeedback(leadId: string) {
    const eventType = feedbackType[leadId];

    if (!eventType) {
      setFeedbackMessage((current) => ({
        ...current,
        [leadId]: "Selecione um resultado.",
      }));
      return;
    }

    setFeedbackSaving(leadId);
    setFeedbackMessage((current) => ({ ...current, [leadId]: "" }));

    try {
      const res = await fetch(`/api/leads/${leadId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: params.id,
          eventType,
          notes: feedbackNotes[leadId] || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Falha ao registrar resultado");
      }

      const label =
        FEEDBACK_OPTIONS.find(([value]) => value === eventType)?.[1] ||
        eventType;

      setFeedbackMessage((current) => ({
        ...current,
        [leadId]: `Resultado "${label}" registrado com sucesso.`,
      }));

      setFeedbackNotes((current) => ({
        ...current,
        [leadId]: "",
      }));

      setFeedbackHistory((current) => ({
        ...current,
        [leadId]: [
          data.feedbackEvent,
          ...(current[leadId] || []),
        ],
      }));
    } catch (err) {
      setFeedbackMessage((current) => ({
        ...current,
        [leadId]:
          err instanceof Error ? err.message : "Erro ao registrar resultado.",
      }));
    } finally {
      setFeedbackSaving(null);
    }
  }

  const active = leads?.filter((l) => l.status !== "DISCARDED") ?? [];
  const discarded = leads?.filter((l) => l.status === "DISCARDED") ?? [];

  return (
    <main className="shell">
      <p className="eyebrow">Lead Intelligence Engine</p>
      <h1>Leads — {clientName}</h1>

      <div style={{ margin: 0, marginBottom: 20 }}>
        <Link className="link" href={"/clients/" + params.id + "/intelligence"}>
          Ver Inteligência Comercial
        </Link>
      </div>

      <div className="panel">
        {leads === null && !error && <p className="empty">Carregando...</p>}
        {error && <p className="error">{error}</p>}

        {leads !== null && leads.length === 0 && (
          <p className="empty">
            Nenhum lead processado ainda. Rode uma coleta e processe-a na
            tela da Prospection Spec.
          </p>
        )}

        {active.length > 0 && (
          <div className="leads-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Indústria</th>
                  <th>Cidade</th>
                  <th>Contato</th>
                  <th>Score</th>
                  <th>Confiança</th>
                  <th>Temp.</th>
                  <th>Intenção</th>
                  <th>Recomendação</th>
                </tr>
              </thead>
              <tbody>
                {active.map((lead) => (
                  <Fragment key={lead.id}>
                    <tr
                      style={{ cursor: "pointer" }}
                      onClick={() => toggleExpanded(lead.id)}
                    >
                      <td>{lead.companyName}</td>
                      <td>{lead.industry || "—"}</td>
                      <td>{lead.city || "—"}</td>
                      <td>
                        <div>{lead.phone || "—"}</div>
                        {lead.website && (
                          <div className="status-badge">{lead.website}</div>
                        )}
                      </td>
                      <td className="mono">{lead.leadScore ?? "—"}</td>
                      <td className="mono">
                        {lead.confidenceScore !== null
                          ? `${lead.confidenceScore}%`
                          : "—"}
                      </td>
                      <td>
                        <span
                          className={`temp-badge ${tempClass(lead.temperature)}`}
                        >
                          {lead.temperature || "?"}
                        </span>
                      </td>
                      <td className="mono">{lead.intentLevel || "—"}</td>
                      <td style={{ fontSize: 13 }}>
                        {lead.recommendedAction || "—"}
                        {lead.recommendedChannel && (
                          <div className="status-badge channel-hint">
                            {lead.recommendedChannel}
                          </div>
                        )}
                      </td>
                    </tr>

                    {expanded === lead.id && (
                      <tr>
                        <td
                          colSpan={9}
                          style={{ background: "var(--panel-raised)" }}
                        >
                          <div style={{ marginBottom: 16 }}>
                            <label
                              style={{ fontSize: 12, fontWeight: 600 }}
                            >
                              Status operacional
                            </label>
                            <select
                              value={lead.status}
                              onChange={(e) =>
                                updateStatus(lead.id, e.target.value)
                              }
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                marginLeft: 8,
                                padding: "4px 8px",
                              }}
                            >
                              <option value="NEW">Novo</option>
                              <option value="REVIEWED">Revisado</option>
                              <option value="CONTACTED">Contatado</option>
                              <option value="DISCARDED">Descartado</option>
                            </select>
                          </div>

                          <div
                            style={{
                              marginBottom: 18,
                              padding: 12,
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius)",
                            }}
                          >
                            <strong style={{ fontSize: 12 }}>
                              Resultado do contato
                            </strong>

                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                flexWrap: "wrap",
                                marginTop: 8,
                              }}
                            >
                              <select
                                value={feedbackType[lead.id] || ""}
                                onChange={(e) =>
                                  setFeedbackType((current) => ({
                                    ...current,
                                    [lead.id]: e.target.value,
                                  }))
                                }
                                onClick={(e) => e.stopPropagation()}
                                style={{ padding: "6px 8px" }}
                              >
                                <option value="">Selecione...</option>
                                {FEEDBACK_OPTIONS.map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>

                              <input
                                value={feedbackNotes[lead.id] || ""}
                                onChange={(e) =>
                                  setFeedbackNotes((current) => ({
                                    ...current,
                                    [lead.id]: e.target.value,
                                  }))
                                }
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Observação opcional"
                                style={{
                                  flex: "1 1 260px",
                                  minWidth: 220,
                                  padding: "6px 8px",
                                }}
                              />

                              <button
                                type="button"
                                disabled={feedbackSaving === lead.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  registerFeedback(lead.id);
                                }}
                              >
                                {feedbackSaving === lead.id
                                  ? "Registrando..."
                                  : "Registrar resultado"}
                              </button>
                            </div>

                            {feedbackMessage[lead.id] && (
                              <p
                                style={{
                                  fontSize: 12,
                                  margin: "8px 0 0",
                                }}
                              >
                                {feedbackMessage[lead.id]}
                              </p>
                            )}

                            <div
                              style={{
                                marginTop: 16,
                                paddingTop: 12,
                                borderTop: "1px solid var(--border)",
                              }}
                            >
                              <strong style={{ fontSize: 12 }}>
                                Histórico de resultados
                              </strong>

                              {feedbackLoading === lead.id && (
                                <p
                                  style={{
                                    fontSize: 12,
                                    margin: "8px 0 0",
                                  }}
                                >
                                  Carregando histórico...
                                </p>
                              )}

                              {feedbackHistoryError[lead.id] && (
                                <p
                                  className="error"
                                  style={{
                                    fontSize: 12,
                                    margin: "8px 0 0",
                                  }}
                                >
                                  {feedbackHistoryError[lead.id]}
                                </p>
                              )}

                              {feedbackHistory[lead.id] &&
                                feedbackHistory[lead.id].length === 0 && (
                                  <p
                                    style={{
                                      fontSize: 12,
                                      margin: "8px 0 0",
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    Nenhum resultado registrado ainda.
                                  </p>
                                )}

                              {feedbackHistory[lead.id] &&
                                feedbackHistory[lead.id].length > 0 && (
                                  <div style={{ marginTop: 8 }}>
                                    {feedbackHistory[lead.id].map((event) => (
                                      <div
                                        key={event.id}
                                        style={{
                                          padding: "8px 0",
                                          borderBottom:
                                            "1px solid var(--border)",
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: "flex",
                                            gap: 8,
                                            alignItems: "baseline",
                                            flexWrap: "wrap",
                                          }}
                                        >
                                          <strong style={{ fontSize: 12 }}>
                                            {feedbackLabel(event.eventType)}
                                          </strong>
                                          <span
                                            style={{
                                              fontSize: 11,
                                              color: "var(--text-muted)",
                                            }}
                                          >
                                            {formatFeedbackDate(
                                              event.createdAt
                                            )}
                                          </span>
                                        </div>

                                        {event.notes && (
                                          <p
                                            style={{
                                              fontSize: 12,
                                              margin: "4px 0 0",
                                            }}
                                          >
                                            {event.notes}
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                            </div>
                          </div>

                          {lead.fitReasons && lead.fitReasons.length > 0 && (
                            <>
                              <strong style={{ fontSize: 12 }}>
                                Motivos de fit:
                              </strong>
                              <ul className="reasons-list">
                                {lead.fitReasons.map((r, i) => (
                                  <li key={i}>{r}</li>
                                ))}
                              </ul>
                            </>
                          )}

                          {(lead.intentLevel ||
                            (lead.intentReasons &&
                              lead.intentReasons.length > 0)) && (
                            <>
                              <strong style={{ fontSize: 12 }}>
                                Sinais de intenção:
                              </strong>
                              {lead.intentLevel && (
                                <p
                                  style={{
                                    fontSize: 12,
                                    margin: "4px 0",
                                  }}
                                >
                                  Intenção:{" "}
                                  <span className="mono">
                                    {lead.intentLevel}
                                  </span>
                                  {lead.intentSource && (
                                    <span className="status-badge">
                                      {" "}
                                      origem: {lead.intentSource}
                                    </span>
                                  )}
                                </p>
                              )}
                              {lead.intentReasons &&
                                lead.intentReasons.length > 0 && (
                                  <ul className="reasons-list">
                                    {lead.intentReasons.map((r, i) => (
                                      <li key={i}>{r}</li>
                                    ))}
                                  </ul>
                                )}
                            </>
                          )}

                          {lead.negativeSignals &&
                            lead.negativeSignals.length > 0 && (
                              <>
                                <strong style={{ fontSize: 12 }}>
                                  Sinais negativos:
                                </strong>
                                <ul className="reasons-list">
                                  {lead.negativeSignals.map((r, i) => (
                                    <li key={i}>{r}</li>
                                  ))}
                                </ul>
                              </>
                            )}

                          {lead.recommendedChannel && (
                            <p style={{ fontSize: 12, marginTop: 8 }}>
                              Canal recomendado:{" "}
                              <span className="mono channel-hint">
                                {lead.recommendedChannel}
                              </span>
                            </p>
                          )}

                          <div
                            style={{
                              marginTop: 18,
                              padding: 12,
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius)",
                            }}
                          >
                            <strong style={{ fontSize: 13 }}>
                              Lead Package
                            </strong>

                            {leadPackageLoading === lead.id && (
                              <p style={{ fontSize: 12, margin: "8px 0 0" }}>
                                Carregando Lead Package...
                              </p>
                            )}

                            {leadPackageError[lead.id] && (
                              <p
                                className="error"
                                style={{ fontSize: 12, margin: "8px 0 0" }}
                              >
                                {leadPackageError[lead.id]}
                              </p>
                            )}

                            {(() => {
                              const pkg = leadPackages[lead.id];
                              if (!pkg) return null;

                              return (
                                <div
                                  style={{
                                    marginTop: 10,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 16,
                                  }}
                                >
                                  {/* 1. IDENTIFICAÇÃO */}
                                  <div>
                                    <div style={sectionTitleStyle}>
                                      1. Identificação
                                    </div>
                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns:
                                          "repeat(auto-fit, minmax(180px, 1fr))",
                                        gap: "4px 16px",
                                        fontSize: 12,
                                      }}
                                    >
                                      <div>
                                        Empresa: {pkg.identification.companyName || "Não informado"}
                                      </div>
                                      <div>
                                        Pessoa: {pkg.identification.personName || "Não informado"}
                                      </div>
                                      <div>
                                        Cargo: {pkg.identification.role || "Não informado"}
                                      </div>
                                      <div>
                                        Segmento: {pkg.identification.industry || "Não informado"}
                                      </div>
                                      <div>
                                        Subsegmento: {pkg.identification.subindustry || "Não informado"}
                                      </div>
                                      <div>
                                        Endereço: {pkg.identification.address || "Não informado"}
                                      </div>
                                      <div>
                                        Cidade: {pkg.identification.city || "Não informado"}
                                      </div>
                                      <div>
                                        Bairro: {pkg.identification.neighborhood || "Não informado"}
                                      </div>
                                      <div>
                                        Telefone: {pkg.identification.phone || "Não informado"}
                                      </div>
                                      <div>
                                        WhatsApp: {pkg.identification.whatsapp || "Não informado"}
                                      </div>
                                      <div>
                                        E-mail: {pkg.identification.email || "Não informado"}
                                      </div>
                                      <div>
                                        Website: {pkg.identification.website || "Não informado"}
                                      </div>
                                    </div>
                                  </div>

                                  {/* 2. CONTEXTO DA OPORTUNIDADE */}
                                  <div>
                                    <div style={sectionTitleStyle}>
                                      2. Contexto da oportunidade
                                    </div>
                                    {!pkg.context.available && (
                                      <p
                                        style={{
                                          fontSize: 12,
                                          color: "var(--text-muted)",
                                          margin: 0,
                                        }}
                                      >
                                        Contexto de campanha não disponível para este lead.
                                      </p>
                                    )}
                                    {pkg.context.available && (
                                      <div
                                        style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}
                                      >
                                        <div>Target: {describeUnknown(pkg.context.target)}</div>
                                        <div>Localização: {describeUnknown(pkg.context.location)}</div>
                                        <div>O que está sendo prospectado: {describeUnknown(pkg.context.what)}</div>
                                        <div>Estratégia de descoberta: {describeUnknown(pkg.context.discoveryStrategy)}</div>
                                        <div>Sinais de intenção da campanha: {describeUnknown(pkg.context.intentSignals)}</div>
                                        <div>Exclusões relevantes: {describeUnknown(pkg.context.exclusions)}</div>
                                      </div>
                                    )}
                                  </div>

                                  {/* 3. FIT */}
                                  <div>
                                    <div style={sectionTitleStyle}>3. FIT</div>
                                    <p style={{ fontSize: 12, margin: "0 0 4px" }}>
                                      Lead Score:{" "}
                                      <span className="mono">{pkg.fit.leadScore ?? "—"}</span>
                                    </p>
                                    {pkg.fit.fitReasons.length > 0 ? (
                                      <ul className="reasons-list">
                                        {pkg.fit.fitReasons.map((r, i) => (
                                          <li key={i}>{r}</li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                                        Nenhum motivo de FIT registrado.
                                      </p>
                                    )}
                                    {pkg.fit.negativeSignals.length > 0 && (
                                      <>
                                        <p style={{ fontSize: 12, margin: "8px 0 0" }}>
                                          Sinais negativos:
                                        </p>
                                        <ul className="reasons-list">
                                          {pkg.fit.negativeSignals.map((r, i) => (
                                            <li key={i}>{r}</li>
                                          ))}
                                        </ul>
                                      </>
                                    )}
                                  </div>

                                  {/* 4. INTENT */}
                                  <div>
                                    <div style={sectionTitleStyle}>4. INTENT</div>
                                    <p style={{ fontSize: 12, margin: "0 0 4px" }}>
                                      Nível:{" "}
                                      <span className="mono">{pkg.intent.intentLevel || "indeterminada"}</span>
                                      {pkg.intent.intentSource && (
                                        <span className="status-badge"> origem: {pkg.intent.intentSource}</span>
                                      )}
                                    </p>
                                    {pkg.intent.isEvidenceInsufficient && (
                                      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 4px" }}>
                                        Evidência de intenção insuficiente — isso não significa baixa intenção,
                                        apenas ausência de sinal identificado.
                                      </p>
                                    )}
                                    {pkg.intent.intentReasons.length > 0 && (
                                      <ul className="reasons-list">
                                        {pkg.intent.intentReasons.map((r, i) => (
                                          <li key={i}>{r}</li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>

                                  {/* 5. EVIDÊNCIAS */}
                                  <div>
                                    <div style={sectionTitleStyle}>5. Evidências</div>

                                    <p style={{ fontSize: 12, margin: "0 0 2px" }}>Evidência de listagem/fonte:</p>
                                    {pkg.evidence.listingEvidence.evidence.length > 0 ? (
                                      <ul className="reasons-list">
                                        {pkg.evidence.listingEvidence.evidence.map((item, i) => (
                                          <li key={i}>
                                            {item.summary || item.source || "Evidência de listagem"}
                                            {item.url && (
                                              <>
                                                {" — "}
                                                <a
                                                  className="link"
                                                  href={item.url}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  fonte
                                                </a>
                                              </>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 4px" }}>
                                        Nenhuma evidência de listagem registrada.
                                      </p>
                                    )}
                                    {pkg.evidence.listingEvidence.sources.length > 0 && (
                                      <p style={{ fontSize: 12, margin: "4px 0" }}>
                                        Fontes: {pkg.evidence.listingEvidence.sources.join(", ")}
                                      </p>
                                    )}
                                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 8px" }}>
                                      {pkg.evidence.listingEvidence.caveat}
                                    </p>

                                    <p style={{ fontSize: 12, margin: "0 0 2px" }}>
                                      Motivos de FIT (interpretação do scoring):
                                    </p>
                                    {pkg.evidence.scoringInterpretation.fitReasons.length > 0 ? (
                                      <ul className="reasons-list">
                                        {pkg.evidence.scoringInterpretation.fitReasons.map((r, i) => (
                                          <li key={i}>{r}</li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 4px" }}>
                                        Nenhum.
                                      </p>
                                    )}

                                    <p style={{ fontSize: 12, margin: "8px 0 2px" }}>
                                      Motivos de INTENT (interpretação do scoring):
                                    </p>
                                    {pkg.evidence.scoringInterpretation.intentReasons.length > 0 ? (
                                      <ul className="reasons-list">
                                        {pkg.evidence.scoringInterpretation.intentReasons.map((r, i) => (
                                          <li key={i}>{r}</li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 4px" }}>
                                        Nenhum.
                                      </p>
                                    )}

                                    {pkg.evidence.scoringInterpretation.painReasons.length > 0 && (
                                      <>
                                        <p style={{ fontSize: 12, margin: "8px 0 2px" }}>Sinais de dor:</p>
                                        <ul className="reasons-list">
                                          {pkg.evidence.scoringInterpretation.painReasons.map((r, i) => (
                                            <li key={i}>{r}</li>
                                          ))}
                                        </ul>
                                      </>
                                    )}

                                    {pkg.evidence.scoringInterpretation.negativeSignals.length > 0 && (
                                      <>
                                        <p style={{ fontSize: 12, margin: "8px 0 2px" }}>Sinais negativos:</p>
                                        <ul className="reasons-list">
                                          {pkg.evidence.scoringInterpretation.negativeSignals.map((r, i) => (
                                            <li key={i}>{r}</li>
                                          ))}
                                        </ul>
                                      </>
                                    )}

                                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "8px 0 0" }}>
                                      {pkg.evidence.scoringInterpretation.caveat}
                                    </p>
                                  </div>

                                  {/* 6. INFORMAÇÕES QUE FALTAM */}
                                  {pkg.informationGaps.gaps.length > 0 && (
                                    <div>
                                      <div style={sectionTitleStyle}>
                                        6. Informações que faltam
                                      </div>
                                      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 4px" }}>
                                        Informações a descobrir — não são necessariamente problemas do lead:
                                      </p>
                                      <ul className="reasons-list">
                                        {pkg.informationGaps.gaps.map((gap) => (
                                          <li key={gap.code}>{gap.label}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* 7. PRIORIDADE OPERACIONAL */}
                                  <div>
                                    <div style={sectionTitleStyle}>
                                      7. Prioridade operacional
                                    </div>
                                    <span
                                      className="temp-badge"
                                      style={PRIORITY_STYLES[pkg.operationalPriority.priority]}
                                    >
                                      {pkg.operationalPriority.priority}
                                    </span>
                                    <p style={{ fontSize: 12, margin: "6px 0 0" }}>
                                      {pkg.operationalPriority.rationale}
                                    </p>
                                  </div>

                                  {/* 8. PRÓXIMA AÇÃO */}
                                  <div>
                                    <div style={sectionTitleStyle}>8. Próxima ação</div>
                                    <p style={{ fontSize: 12, margin: 0 }}>
                                      {pkg.recommendedAction.recommendedAction || "Não informado"}
                                    </p>
                                    {pkg.recommendedAction.recommendedChannel && (
                                      <p style={{ fontSize: 12, margin: "4px 0 0" }}>
                                        Canal:{" "}
                                        <span className="mono channel-hint">
                                          {pkg.recommendedAction.recommendedChannel}
                                        </span>
                                      </p>
                                    )}
                                  </div>

                                  {/* 9. HISTÓRICO */}
                                  <div>
                                    <div style={sectionTitleStyle}>9. Histórico</div>
                                    {!pkg.history.hasHistory && (
                                      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                                        Sem histórico de contato registrado.
                                      </p>
                                    )}
                                    {pkg.history.hasHistory && (
                                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        {pkg.history.events.map((event) => (
                                          <div key={event.id} style={{ fontSize: 12 }}>
                                            <strong>{feedbackLabel(event.eventType)}</strong>{" "}
                                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                              {formatFeedbackDate(String(event.createdAt))}
                                            </span>
                                            {event.notes && (
                                              <div style={{ fontSize: 12 }}>{event.notes}</div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* 10. ESTADO COMERCIAL */}
                                  <div>
                                    <div style={sectionTitleStyle}>10. Estado comercial</div>
                                    <p style={{ fontSize: 12, margin: 0 }}>
                                      {pkg.commercialStage.derivedStageLabel}
                                    </p>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {discarded.length > 0 && (
          <details style={{ marginTop: 20 }}>
            <summary
              style={{
                cursor: "pointer",
                fontSize: 13,
                color: "var(--text-muted)",
              }}
            >
              {discarded.length} lead(s) descartado(s) por exclusão — ver
            </summary>
            <table style={{ marginTop: 12 }}>
              <tbody>
                {discarded.map((lead) => (
                  <tr key={lead.id}>
                    <td>{lead.companyName}</td>
                    <td
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                      }}
                    >
                      {(lead.negativeSignals || []).join("; ") ||
                        "excluído pela spec"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </div>

      <p style={{ marginTop: 16 }}>
        <Link className="link" href="/">
          ← Voltar para Clientes
        </Link>
      </p>
    </main>
  );
}


