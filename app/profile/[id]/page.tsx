"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PROFILE_FIELD_DEFINITIONS } from "@/lib/profile-fields";

type ProfileRecord = Record<string, any>;

function toFieldString(value: unknown, type: "text" | "json") {
  if (value === null || value === undefined) return "";
  if (type === "json") return JSON.stringify(value, null, 2);
  return String(value);
}

export default function ProfilePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/profiles/${params.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao carregar perfil");
      setProfile(data.profile);
      const initialForm: Record<string, string> = {};
      for (const def of PROFILE_FIELD_DEFINITIONS) {
        initialForm[def.key] = toFieldString(data.profile[def.key], def.type);
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
      const res = await fetch(`/api/profiles/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao salvar");
      setProfile(data.profile);
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
      const res = await fetch(`/api/profiles/${params.id}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao aprovar perfil");
      router.push(`/prospection-spec/${data.prospectionSpec.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
      setApproving(false);
    }
  }

  if (loading) {
    return (
      <main className="shell">
        <p className="empty">Carregando perfil...</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="shell">
        <p className="error">{error || "Perfil não encontrado."}</p>
      </main>
    );
  }

  const isApproved = profile.approved;
  const latestSpec = profile.prospectionSpecs?.[0];

  return (
    <main className="shell">
      <p className="eyebrow">Lead Intelligence Engine</p>
      <h1>Perfil — {profile.client?.businessName}</h1>

      <div className="panel">
        <div className="badge" style={{ marginBottom: 16 }}>
          <span className="dot" />
          profile readiness: <span className="mono">{profile.profileReadiness}/100</span>
          {isApproved && <span> · aprovado</span>}
        </div>

        {isApproved && (
          <p className="readonly-banner">
            Este perfil já foi aprovado e não pode mais ser editado.
            {latestSpec && (
              <>
                {" "}
                <Link className="link" href={`/prospection-spec/${latestSpec.id}`}>
                  Ver Prospection Spec →
                </Link>
              </>
            )}
          </p>
        )}

        <div className="field-grid">
          {PROFILE_FIELD_DEFINITIONS.map((def) => (
            <div className="field" key={def.key}>
              <label htmlFor={def.key}>{def.label}</label>
              {def.type === "json" ? (
                <textarea
                  id={def.key}
                  value={form[def.key] ?? ""}
                  disabled={isApproved}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [def.key]: e.target.value }))
                  }
                />
              ) : (
                <input
                  id={def.key}
                  value={form[def.key] ?? ""}
                  disabled={isApproved}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [def.key]: e.target.value }))
                  }
                />
              )}
            </div>
          ))}
        </div>

        {!isApproved && (
          <div className="actions-bar">
            <button className="ghost" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
            <button onClick={handleApprove} disabled={approving || saving}>
              {approving ? "Gerando Prospection Spec..." : "Aprovar perfil e gerar Prospection Spec"}
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

      <p style={{ marginTop: 16 }}>
        <Link className="link" href="/">
          ← Voltar para Clientes
        </Link>
      </p>
    </main>
  );
}
