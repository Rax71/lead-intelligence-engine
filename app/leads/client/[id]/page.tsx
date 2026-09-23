"use client";

import { useEffect, useState, Fragment } from "react";
import Link from "next/link";

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

  function toggleExpanded(leadId: string) {
    const next = expanded === leadId ? null : leadId;
    setExpanded(next);

    if (next && feedbackHistory[next] === undefined) {
      loadFeedbackHistory(next);
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


