"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Aceita somente caminhos internos ("/", "/clients/...") como destino pós-login.
 * Bloqueia URLs absolutas, protocol-relative ("//host") e "/\host" (que alguns
 * navegadores normalizam como "//host"), evitando open redirect via ?next=.
 */
function sanitizeNextPath(rawNext: string | null): string {
  if (!rawNext) return "/";

  const startsWithSingleSlash =
    rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\");
  const hasExternalScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawNext);

  if (!startsWithSingleSlash || hasExternalScheme) {
    return "/";
  }

  return rawNext;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        throw new Error("Credenciais inválidas");
      }

      const next = sanitizeNextPath(new URLSearchParams(window.location.search).get("next"));
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
      setSubmitting(false);
    }
  }

  return (
    <main className="shell">
      <p className="eyebrow">Signal 360</p>
      <h1>Acesso administrativo</h1>

      <div className="panel">
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" disabled={submitting}>
            {submitting ? "Entrando..." : "Entrar"}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    </main>
  );
}
