"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Turn = { role: "assistant" | "user"; text: string };

export default function InterviewPage({
  params,
}: {
  params: { id: string };
}) {
  const clientId = params.id;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [answer, setAnswer] = useState("");
  const [readiness, setReadiness] = useState(0);
  const [done, setDone] = useState(false);
  const [clientProfileId, setClientProfileId] = useState<string | null>(null);
  const [interviewStateId, setInterviewStateId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const startedRef = useRef(false);

  useEffect(() => {
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  function pushAssistantTurn(message: string | null, question: string | null) {
    const text = [message, question].filter(Boolean).join("\n\n");
    if (text) {
      setTurns((t) => [...t, { role: "assistant", text }]);
    }
  }

  async function start() {
    if (startedRef.current) return;
    startedRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao iniciar entrevista");

      setInterviewStateId(data.interviewState.id);
      setReadiness(data.interviewState.profileReadiness ?? 0);
      if (data.clientProfileId) setClientProfileId(data.clientProfileId);
      const isDone = data.interviewState.status !== "IN_PROGRESS";
      setDone(isDone);
      pushAssistantTurn(
        data.message,
        data.question ?? (isDone ? "Entrevista já concluída." : null)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function sendAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || !interviewStateId || loading || submittingRef.current) return;

    submittingRef.current = true;

    const userText = answer.trim();
    setTurns((t) => [...t, { role: "user", text: userText }]);
    setAnswer("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/interview/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewStateId, answer: userText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao processar resposta");

      setReadiness(data.profileReadiness ?? 0);
      setDone(data.done);
      if (data.clientProfileId) setClientProfileId(data.clientProfileId);
      pushAssistantTurn(
        data.message,
        data.done
          ? "Entrevista concluída — perfil em rascunho gerado. A revisão completa (editar/aprovar) chega no Sprint 03."
          : data.question
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <p className="eyebrow">Lead Intelligence Engine</p>
      <h1>Entrevista dinâmica</h1>

      <div className="panel">
        <div className="readiness">
          <span className="badge">
            <span className="dot" />
            profile readiness:{" "}
            <span className="mono">{readiness}/100</span>
          </span>
          <div className="readiness-track">
            <div
              className="readiness-fill"
              style={{ width: `${readiness}%` }}
            />
          </div>
        </div>

        <div className="chat">
          {turns.map((t, i) => (
            <div
              key={i}
              className={`bubble ${
                t.role === "user" ? "bubble-user" : "bubble-assistant"
              }`}
            >
              {t.text}
            </div>
          ))}
          {loading && turns.length === 0 && (
            <p className="empty">Carregando entrevista...</p>
          )}
          <div ref={bottomRef} />
        </div>

        {!done && (
          <form className="chat-input-row" onSubmit={sendAnswer}>
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Digite sua resposta..."
              disabled={loading}
              autoFocus
            />
            <button type="submit" disabled={loading || !answer.trim()}>
              {loading ? "..." : "Enviar"}
            </button>
          </form>
        )}

        {done && (
          <div className="done-banner">
            Perfil em rascunho gerado com readiness {readiness}/100.
            {clientProfileId ? (
              <>
                {" "}
                <Link className="link" href={`/profile/${clientProfileId}`}>
                  Revisar e aprovar o perfil →
                </Link>
              </>
            ) : (
              " Esta entrevista já estava concluída antes desta sessão — abra o perfil pela lista de Clientes."
            )}
          </div>
        )}

        {error && <p className="error">{error}</p>}
      </div>

      <p style={{ marginTop: 16 }}>
        <Link className="link" href="/">
          ← Voltar para Clientes
        </Link>
      </p>
    </main>
  );
}









