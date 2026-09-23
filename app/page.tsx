"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ClientRow = {
  id: string;
  businessName: string;
  contactName: string | null;
  createdAt: string;
  _count: { leads: number; interviewStates: number };
  clientProfiles: { id: string; approved: boolean }[];
};

export default function HomePage() {
  const [clients, setClients] = useState<ClientRow[] | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadClients() {
    const res = await fetch("/api/clients");
    const data = await res.json();
    setClients(data.clients);
  }

  useEffect(() => {
    loadClients();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!businessName.trim()) {
      setError("Informe o nome do negócio.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, contactName, contactPhone }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Falha ao criar cliente");
      }

      setBusinessName("");
      setContactName("");
      setContactPhone("");
      await loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="shell">
      <p className="eyebrow">Lead Intelligence Engine</p>
      <h1>Clientes</h1>

      <div className="panel">
        <h2>Novo cliente</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="businessName">Nome do negócio</label>
            <input
              id="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="ex.: Quantitus Contabilidade"
            />
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="contactName">Contato</label>
              <input
                id="contactName"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="nome do responsável (opcional)"
              />
            </div>
            <div className="field">
              <label htmlFor="contactPhone">Telefone</label>
              <input
                id="contactPhone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="opcional"
              />
            </div>
          </div>
          <button type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Cadastrar cliente"}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>

      <div className="panel">
        <h2>Clientes cadastrados</h2>
        {clients === null && <p className="empty">Carregando...</p>}
        {clients !== null && clients.length === 0 && (
          <p className="empty">
            Nenhum cliente cadastrado ainda. A entrevista dinâmica (Sprint 02)
            começará a partir daqui.
          </p>
        )}
        {clients !== null && clients.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Negócio</th>
                <th>Contato</th>
                <th>Entrevistas</th>
                <th>Leads</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>{c.businessName}</td>
                  <td>{c.contactName || "—"}</td>
                  <td className="mono">{c._count.interviewStates}</td>
                  <td className="mono">{c._count.leads}</td>
                  <td>
                    <div style={{ display: "flex", gap: 10 }}>
                      <Link className="link" href={`/clients/${c.id}/interview`}>
                        {c._count.interviewStates > 0
                          ? "entrevista →"
                          : "iniciar entrevista →"}
                      </Link>
                      {c.clientProfiles[0] && (
                        <Link className="link" href={`/profile/${c.clientProfiles[0].id}`}>
                          {c.clientProfiles[0].approved ? "perfil (aprovado) →" : "perfil (rascunho) →"}
                        </Link>
                      )}
                      {c._count.leads > 0 && (
                        <Link className="link" href={`/leads/client/${c.id}`}>
                          leads →
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
