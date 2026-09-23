"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SPEC_FIELD_DEFINITIONS } from "@/lib/spec-fields";

type SpecRecord = Record<string, any>;

function toFieldString(value: unknown) {
  if (value === null || value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

export default function ProspectionSpecPage({
  params,
}: {
  params: { id: string };
}) {
  const [spec, setSpec] = useState<SpecRecord | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  const [maxItems, setMaxItems] = useState(30);
  const [maxRunCost, setMaxRunCost] = useState(5);
  const [estimate, setEstimate] = useState<{
    actorName: string;
    estimatedCost: number;
    maxItems: number;
    notes: string;
  } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<any | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processSummary, setProcessSummary] = useState<any | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/prospection-specs/${params.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao carregar Prospection Spec");
      setSpec(data.prospectionSpec);
      const initialForm: Record<string, string> = {};
      for (const def of SPEC_FIELD_DEFINITIONS) {
        initialForm[def.key] = toFieldString(data.prospectionSpec[def.key]);
      }
      setForm(initialForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSavedNotice(false);
    try {
      const res = await fetch(`/api/prospection-specs/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao salvar");
      setSpec(data.prospectionSpec);
      setSavedNotice(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    setApproving(true);
    setError(null);
    try {
      await handleSave();
      const res = await fetch(`/api/prospection-specs/${params.id}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao aprovar");
      setSpec(data.prospectionSpec);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setApproving(false);
    }
  }

  async function handleEstimate() {
    setEstimating(true);
    setRunError(null);
    try {
      const res = await fetch(`/api/prospection-specs/${params.id}/estimate-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxItems }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao estimar execução");
      setEstimate(data.estimate);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setEstimating(false);
    }
  }

  async function handleRun() {
    setRunning(true);
    setRunError(null);
    setRunResult(null);
    try {
      const res = await fetch(`/api/prospection-specs/${params.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxItems, maxRunCost }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao executar coleta");
      setRunResult(data);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setRunning(false);
    }
  }

  async function handleProcess() {
    if (!runResult?.run?.id) return;
    setProcessing(true);
    setRunError(null);
    try {
      const res = await fetch(`/api/runs/${runResult.run.id}/process`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao processar leads");
      setProcessSummary(data.summary);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <main className="shell">
        <p className="empty">Carregando Prospection Spec...</p>
      </main>
    );
  }

  if (!spec) {
    return (
      <main className="shell">
        <p className="error">{error || "Prospection Spec não encontrada."}</p>
      </main>
    );
  }

  const isApproved = spec.approved;

  return (
    <main className="shell">
      <p className="eyebrow">Lead Intelligence Engine</p>
      <h1>Prospection Spec — {spec.client?.businessName}</h1>

      <div className="panel">
        {isApproved ? (
          <p className="readonly-banner">
            Aprovada — pronta para o Apify Adapter (Sprint 04). Não pode mais
            ser editada.
          </p>
        ) : (
          <p className="readonly-banner">
            Gerada automaticamente a partir do perfil aprovado. Revise e
            ajuste antes de aprovar — nenhuma coleta de dados acontece ainda
            neste sprint.
          </p>
        )}

        <div className="field-grid">
          {SPEC_FIELD_DEFINITIONS.map((def) => (
            <div className="field" key={def.key}>
              <label htmlFor={def.key}>{def.label}</label>
              <textarea
                id={def.key}
                value={form[def.key] ?? ""}
                disabled={isApproved}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [def.key]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>

        {!isApproved && (
          <div className="actions-bar">
            <button className="ghost" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
            <button onClick={handleApprove} disabled={approving || saving}>
              {approving ? "Aprovando..." : "Aprovar Prospection Spec"}
            </button>
            {savedNotice && !saving && (
              <span className="badge">
                <span className="dot" />
                salvo
              </span>
            )}
          </div>
        )}

        {error && <p className="error">{error}</p>}
      </div>

      {isApproved && (
        <div className="panel">
          <h2>Executar coleta (Apify — modo validação)</h2>
          <p className="readonly-banner">
            Roda o Google Maps Scraper com o Cost-Aware Execution: a coleta
            só é disparada se o custo estimado ficar dentro do teto definido
            abaixo. Isso chama a API real da Apify e pode gastar créditos —
            confirme o `APIFY_TOKEN` no `.env` antes de rodar.
          </p>

          <div className="row" style={{ marginBottom: 14 }}>
            <div className="field">
              <label htmlFor="maxItems">Máximo de itens (modo validação)</label>
              <input
                id="maxItems"
                type="number"
                min={1}
                max={200}
                value={maxItems}
                onChange={(e) => setMaxItems(Number(e.target.value) || 0)}
              />
            </div>
            <div className="field">
              <label htmlFor="maxRunCost">Teto de custo (USD)</label>
              <input
                id="maxRunCost"
                type="number"
                min={0.1}
                step={0.1}
                value={maxRunCost}
                onChange={(e) => setMaxRunCost(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="actions-bar" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
            <button className="ghost" onClick={handleEstimate} disabled={estimating}>
              {estimating ? "Estimando..." : "Estimar custo"}
            </button>
            <button onClick={handleRun} disabled={running}>
              {running ? "Rodando (pode levar até 1 min)..." : "Rodar coleta agora"}
            </button>
          </div>

          {estimate && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 12 }}>
              Actor: <span className="mono">{estimate.actorName}</span> ·
              custo estimado: <span className="mono">US$ {estimate.estimatedCost}</span>{" "}
              para {estimate.maxItems} itens.
              <br />
              {estimate.notes}
            </p>
          )}

          {runResult && (
            <div style={{ marginTop: 16 }}>
              {runResult.blocked ? (
                <p className="error">
                  Execução bloqueada: custo estimado (US${" "}
                  {runResult.run.estimatedCost}) acima do teto de US${" "}
                  {runResult.run.maxRunCost}. Aumente o teto ou reduza o
                  máximo de itens.
                </p>
              ) : (
                <>
                  <p className="badge" style={{ marginBottom: 10 }}>
                    <span className="dot" />
                    run {runResult.run.status.toLowerCase()} ·{" "}
                    {runResult.run.itemsCollected} itens coletados · custo
                    real ≈ US$ {runResult.run.actualCost}
                  </p>
                  <p className="field-hint" style={{ marginBottom: 8 }}>
                    Prévia dos itens brutos (normalização e scoring em Lead
                    são escopo do Sprint 05):
                  </p>
                  <textarea
                    readOnly
                    style={{ width: "100%", minHeight: 200 }}
                    value={JSON.stringify(
                      (runResult.run.rawItems || []).slice(0, 3),
                      null,
                      2
                    )}
                  />

                  <div className="actions-bar" style={{ marginTop: 16 }}>
                    <button onClick={handleProcess} disabled={processing}>
                      {processing
                        ? "Processando (normalizando + pontuando)..."
                        : "Processar leads (normalizar + pontuar)"}
                    </button>
                  </div>

                  {processSummary && (
                    <div style={{ marginTop: 12 }}>
                      <p className="badge" style={{ marginBottom: 8 }}>
                        <span className="dot" />
                        {processSummary.totalDeduped} únicos ·{" "}
                        {processSummary.totalCreated} qualificados ·{" "}
                        {processSummary.totalNeedsReview} para revisão ·{" "}
                        {processSummary.totalDiscarded} descartados
                      </p>
                      <Link className="link" href={`/leads/client/${spec.clientId}`}>
                        Ver leads →
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {runError && <p className="error">{runError}</p>}
        </div>
      )}

      <p style={{ marginTop: 16 }}>
        <Link className="link" href="/">
          ← Voltar para Clientes
        </Link>
      </p>
    </main>
  );
}

