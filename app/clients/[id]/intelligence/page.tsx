"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Bucket = {
  totalLeads: number;
  contacted: number;
  responded: number;
  interested: number;
  meetings: number;
  proposals: number;
  sales: number;
};

type HypothesisPattern = {
  leadsWithFeedback: number;
  positiveLeads: number;
  negativeLeads: number;
  positiveRatePct: number;
  negativeRatePct: number;
  evidenceLevel: string;
};

type Hypotheses = {
  sample: {
    totalLeads: number;
    leadsWithFeedback: number;
    evidenceLevel: string;
  };
  observedOutcomes: {
    leadsWithFeedback: number;
    positiveLeads: number;
    negativeLeads: number;
    positiveRatePct: number;
    negativeRatePct: number;
    types: string[];
  };
  hypotheses: {
    scorePatterns: Array<HypothesisPattern & { scoreRange: string }>;
    temperaturePatterns: Array<HypothesisPattern & { temperature: string }>;
    intentPatterns: Array<HypothesisPattern & { intent: string }>;
  };
  guardrails: {
    readOnly: boolean;
    automaticScoringChange: boolean;
    minimumEvidenceForLearning: number;
    note: string;
  };
};

type Summary = {
  totalLeads: number;
  totalFeedbackEvents: number;
  stages: Record<string, number>;
  conversionRates: Record<string, number>;
  stageConversionRates: Record<
    string,
    {
      from: string;
      to: string;
      fromCount: number;
      toCount: number;
      rate: number | null;
      available: boolean;
    }
  >;
  byTemperature: Record<string, Bucket>;
  byIntent: Record<string, Bucket>;
  byScoreRange: Record<string, Bucket>;
};

const STAGES = [
  ["contacted", "Contatados"],
  ["responded", "Responderam"],
  ["interested", "Interessados"],
  ["meeting", "Reuniões"],
  ["proposal", "Propostas"],
  ["sale", "Vendas"],
] as const;

function label(value: string) {
  const labels: Record<string, string> = {
    frio: "Frio",
    morno: "Morno",
    quente: "Quente",
    indeterminada: "Indeterminada",
    baixa: "Baixa",
    média: "Média",
    alta: "Alta",
    sem_intencao: "Sem intenção",
    "80-100": "80–100",
    "70-79": "70–79",
    "40-69": "40–69",
    "0-39": "0–39",
    sem_score: "Sem score",
  };

  return labels[value] || value;
}

function percentage(value: number) {
  return `${value.toFixed(2).replace(".", ",")}%`;
}

function stagePercentage(value: number | null) {
  if (value === null) return "N/A";
  return percentage(value);
}

function SegmentTable({
  title,
  data,
}: {
  title: string;
  data: Record<string, Bucket>;
}) {
  const entries = Object.entries(data);

  return (
    <section className="panel">
      <h2>{title}</h2>

      {entries.length === 0 ? (
        <p className="empty">Nenhum dado disponível.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: 700 }}>
            <thead>
              <tr>
                <th style={{ paddingLeft: 12, paddingRight: 12 }}>Segmento</th>
                <th style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>Leads</th>
                <th style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>Contatados</th>
                <th style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>Interessados</th>
                <th style={{ textAlign: "right" }}>Reuniões</th>
                <th style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>Propostas</th>
                <th style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>Vendas</th>
              </tr>
            </thead>

            <tbody>
              {entries.map(([key, bucket]) => (
                <tr key={key}>
                  <td style={{ paddingLeft: 12, paddingRight: 12 }}>{label(key)}</td>
                  <td style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>{bucket.totalLeads}</td>
                  <td style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>{bucket.contacted}</td>
                  <td style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>{bucket.interested}</td>
                  <td style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>{bucket.meetings}</td>
                  <td style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>{bucket.proposals}</td>
                  <td style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>{bucket.sales}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function IntelligencePage({
  params,
}: {
  params: { id: string };
}) {
  const clientId = params.id;

  const [summary, setSummary] = useState<Summary | null>(null);
  const [hypotheses, setHypotheses] = useState<Hypotheses | null>(null);
  const [loading, setLoading] = useState(true);
  const [hypothesesLoading, setHypothesesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hypothesesError, setHypothesesError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSummary() {
      try {
        const res = await fetch(
          `/api/clients/${clientId}/feedback/summary`
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data.error || "Falha ao carregar inteligência comercial."
          );
        }

        setSummary(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Erro inesperado ao carregar inteligência comercial."
        );
      } finally {
        setLoading(false);
      }
    }

    loadSummary();
  }, [clientId]);

  useEffect(() => {
    async function loadHypotheses() {
      try {
        const res = await fetch(
          `/api/clients/${clientId}/learning/hypotheses`
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data.error || "Falha ao carregar hipóteses de aprendizado."
          );
        }

        setHypotheses(data);
      } catch (err) {
        setHypothesesError(
          err instanceof Error
            ? err.message
            : "Erro inesperado ao carregar hipóteses de aprendizado."
        );
      } finally {
        setHypothesesLoading(false);
      }
    }

    loadHypotheses();
  }, [clientId]);

  if (loading) {
    return (
      <main className="shell">
        <p className="eyebrow">Lead Intelligence Engine</p>
        <h1>Inteligência Comercial</h1>

        <div className="panel">
          <p className="empty">Carregando inteligência comercial...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="shell">
        <p className="eyebrow">Lead Intelligence Engine</p>
        <h1>Inteligência Comercial</h1>

        <div className="panel">
          <p className="error">{error}</p>
        </div>

        <p style={{ marginTop: 16 }}>
          <Link className="link" href="/">
            ← Voltar para Clientes
          </Link>
        </p>
      </main>
    );
  }

  if (!summary) return null;

  return (
    <main className="shell">
      <p className="eyebrow">Lead Intelligence Engine</p>
      <h1>Inteligência Comercial</h1>

      <p style={{ margin: "0 0 24px", color: "var(--text-muted)" }}>
        Resultados comerciais acumulados a partir dos feedbacks registrados
        sobre os leads.
      </p>

      <section className="panel">
        <h2>Resumo</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 12,
          }}
        >
          <div
            style={{
              background: "var(--panel-raised)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "14px 16px",
            }}
          >
            <div className="badge">Leads</div>
            <div className="mono" style={{ fontSize: 22, marginTop: 6 }}>
              {summary.totalLeads}
            </div>
          </div>

          <div
            style={{
              background: "var(--panel-raised)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "14px 16px",
            }}
          >
            <div className="badge">Feedbacks</div>
            <div className="mono" style={{ fontSize: 22, marginTop: 6 }}>
              {summary.totalFeedbackEvents}
            </div>
          </div>

          {STAGES.map(([key, stageLabel]) => (
            <div
              key={key}
              style={{
                background: "var(--panel-raised)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "14px 16px",
              }}
            >
              <div className="badge">{stageLabel}</div>
              <div className="mono" style={{ fontSize: 22, marginTop: 6 }}>
                {summary.stages[key] ?? 0}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Conversão sobre o total de leads</h2>

        <div style={{ display: "grid", gap: 0 }}>
          {STAGES.map(([key, stageLabel]) => (
            <div
              key={key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                padding: "11px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span>{stageLabel}</span>

              <span className="mono">
                {percentage(summary.conversionRates[key] ?? 0)}
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Conversão entre etapas</h2>

        <div style={{ display: "grid", gap: 0 }}>
          {[
            ["contacted_to_responded", "Contatado → Respondeu"],
            ["responded_to_interested", "Respondeu → Interessado"],
            ["interested_to_meeting", "Interessado → Reunião"],
            ["meeting_to_proposal", "Reunião → Proposta"],
            ["proposal_to_sale", "Proposta → Venda"],
          ].map(([key, transitionLabel]) => {
            const transition = summary.stageConversionRates[key];

            return (
              <div
                key={key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "center",
                  gap: 16,
                  padding: "11px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div>
                  <div>{transitionLabel}</div>
                  <div className="badge" style={{ marginTop: 4 }}>
                    {transition?.fromCount ?? 0} na etapa de origem{" · "}
                    {transition?.toCount ?? 0} na etapa seguinte
                  </div>
                </div>

                <span className="mono">
                  {stagePercentage(transition?.rate ?? null)}
                </span>
              </div>
            );
          })}
        </div>

        <p style={{ margin: "14px 0 0", color: "var(--text-muted)", fontSize: 12 }}>
          N/A = dados insuficientes na etapa de origem para calcular a conversão.
        </p>
      </section>

      <SegmentTable
        title="Performance por temperatura"
        data={summary.byTemperature}
      />

      <SegmentTable
        title="Performance por intenção"
        data={summary.byIntent}
      />

      <SegmentTable
        title="Performance por faixa de score"
        data={summary.byScoreRange}
      />

      <section className="panel">
        <h2>Aprendizado e hipóteses</h2>

        {hypothesesLoading ? (
          <p className="empty">Carregando hipóteses de aprendizado...</p>
        ) : hypothesesError ? (
          <p className="error">{hypothesesError}</p>
        ) : !hypotheses ? (
          <p className="empty">Nenhum dado de aprendizado disponível.</p>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  background: "var(--panel-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "14px 16px",
                }}
              >
                <div className="badge">Leads com feedback</div>
                <div className="mono" style={{ fontSize: 22, marginTop: 6 }}>
                  {hypotheses.sample.leadsWithFeedback}
                </div>
              </div>

              <div
                style={{
                  background: "var(--panel-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "14px 16px",
                }}
              >
                <div className="badge">Nível de evidência</div>
                <div style={{ marginTop: 8 }}>
                  {hypotheses.sample.evidenceLevel === "insufficient_sample"
                    ? "Amostra insuficiente"
                    : hypotheses.sample.evidenceLevel === "descriptive"
                      ? "Descritivo"
                      : "Candidato a aprendizado"}
                </div>
              </div>

              <div
                style={{
                  background: "var(--panel-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "14px 16px",
                }}
              >
                <div className="badge">Mínimo para aprendizado</div>
                <div className="mono" style={{ fontSize: 22, marginTop: 6 }}>
                  {hypotheses.guardrails.minimumEvidenceForLearning}
                </div>
              </div>
            </div>

            <p style={{ margin: "0 0 18px", color: "var(--text-muted)" }}>
              Os padrões abaixo são observações descritivas. Eles não alteram
              automaticamente as regras de scoring.
            </p>

            <h3 style={{ marginBottom: 10 }}>Por faixa de score</h3>

            {hypotheses.hypotheses.scorePatterns.length === 0 ? (
              <p className="empty">Nenhum padrão observado.</p>
            ) : (
              <div style={{ overflowX: "auto", marginBottom: 22 }}>
                <table style={{ minWidth: 700 }}>
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 12, paddingRight: 12 }}>Faixa</th>
                      <th style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                        Leads
                      </th>
                      <th style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                        Positivos
                      </th>
                      <th style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                        Negativos
                      </th>
                      <th style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                        Taxa positiva
                      </th>
                      <th style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                        Evidência
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {hypotheses.hypotheses.scorePatterns.map((pattern) => (
                      <tr key={pattern.scoreRange}>
                        <td style={{ paddingLeft: 12, paddingRight: 12 }}>
                          {label(pattern.scoreRange)}
                        </td>
                        <td style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                          {pattern.leadsWithFeedback}
                        </td>
                        <td style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                          {pattern.positiveLeads}
                        </td>
                        <td style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                          {pattern.negativeLeads}
                        </td>
                        <td style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                          {percentage(pattern.positiveRatePct)}
                        </td>
                        <td style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                          {pattern.evidenceLevel === "insufficient_sample"
                            ? "Insuficiente"
                            : pattern.evidenceLevel === "descriptive"
                              ? "Descritiva"
                              : "Candidato"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 style={{ marginBottom: 10 }}>Por temperatura</h3>

            {hypotheses.hypotheses.temperaturePatterns.length === 0 ? (
              <p className="empty">Nenhum padrão observado.</p>
            ) : (
              <div style={{ overflowX: "auto", marginBottom: 22 }}>
                <table style={{ minWidth: 700 }}>
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 12, paddingRight: 12 }}>Temperatura</th>
                      <th style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                        Leads
                      </th>
                      <th style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                        Positivos
                      </th>
                      <th style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                        Negativos
                      </th>
                      <th style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                        Taxa positiva
                      </th>
                      <th style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                        Evidência
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {hypotheses.hypotheses.temperaturePatterns.map((pattern) => (
                      <tr key={pattern.temperature}>
                        <td style={{ paddingLeft: 12, paddingRight: 12 }}>
                          {label(pattern.temperature)}
                        </td>
                        <td style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                          {pattern.leadsWithFeedback}
                        </td>
                        <td style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                          {pattern.positiveLeads}
                        </td>
                        <td style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                          {pattern.negativeLeads}
                        </td>
                        <td style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                          {percentage(pattern.positiveRatePct)}
                        </td>
                        <td style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                          {pattern.evidenceLevel === "insufficient_sample"
                            ? "Insuficiente"
                            : pattern.evidenceLevel === "descriptive"
                              ? "Descritiva"
                              : "Candidato"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 style={{ marginBottom: 10 }}>Por intenção</h3>

            {hypotheses.hypotheses.intentPatterns.length === 0 ? (
              <p className="empty">Nenhum padrão observado.</p>
            ) : (
              <div style={{ overflowX: "auto", marginBottom: 22 }}>
                <table style={{ minWidth: 700 }}>
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 12, paddingRight: 12 }}>Intenção</th>
                      <th style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                        Leads
                      </th>
                      <th style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                        Positivos
                      </th>
                      <th style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                        Negativos
                      </th>
                      <th style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                        Taxa positiva
                      </th>
                      <th style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                        Evidência
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {hypotheses.hypotheses.intentPatterns.map((pattern) => (
                      <tr key={pattern.intent}>
                        <td style={{ paddingLeft: 12, paddingRight: 12 }}>
                          {label(pattern.intent)}
                        </td>
                        <td style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                          {pattern.leadsWithFeedback}
                        </td>
                        <td style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                          {pattern.positiveLeads}
                        </td>
                        <td style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                          {pattern.negativeLeads}
                        </td>
                        <td style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                          {percentage(pattern.positiveRatePct)}
                        </td>
                        <td style={{ textAlign: "right", paddingLeft: 12, paddingRight: 12 }}>
                          {pattern.evidenceLevel === "insufficient_sample"
                            ? "Insuficiente"
                            : pattern.evidenceLevel === "descriptive"
                              ? "Descritiva"
                              : "Candidato"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div
              style={{
                marginTop: 8,
                padding: "12px 14px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                color: "var(--text-muted)",
                fontSize: 13,
              }}
            >
              {hypotheses.guardrails.note}
            </div>
          </>
        )}
      </section>

      <p style={{ marginTop: 16 }}>
        <Link className="link" href="/">
          ← Voltar para Clientes
        </Link>
      </p>
    </main>
  );
}
