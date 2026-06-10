"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Account {
  id: string;
  name: string;
  email: string;
  role: string;
  actief: boolean;
  createdAt: string;
}

interface SchoolDetail {
  id: string;
  naam: string;
  slug: string;
  plaats: string | null;
  adres: string | null;
  contactEmail: string | null;
  contactTelefoon: string | null;
  actief: boolean;
  gebruikers: Account[];
  _count: { klassen: number; vakken: number };
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admins",
  DOCENT: "Docenten",
  LEERLING: "Leerlingen",
  OUDER: "Ouders",
};

export default function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [school, setSchool] = useState<SchoolDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Nieuw account form
  const [accForm, setAccForm] = useState({ name: "", email: "", role: "DOCENT", password: "" });
  const [accLoading, setAccLoading] = useState(false);
  const [accError, setAccError] = useState<string | null>(null);
  const [createdCreds, setCreatedCreds] = useState<
    { name: string; email: string; role: string; password: string }[]
  >([]);

  const load = useCallback(() => {
    fetch(`/api/dev/scholen/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Kon school niet laden"))))
      .then(setSchool)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  async function toggleActief() {
    if (!school) return;
    const res = await fetch(`/api/dev/scholen/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actief: !school.actief }),
    });
    if (res.ok) load();
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setAccError(null);
    setAccLoading(true);
    try {
      const res = await fetch(`/api/dev/scholen/${id}/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: accForm.name,
          email: accForm.email,
          role: accForm.role,
          ...(accForm.password ? { password: accForm.password } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAccError(data.error ?? "Kon account niet aanmaken");
        return;
      }
      setCreatedCreds((prev) => [...prev, ...data.created]);
      setAccForm({ name: "", email: "", role: accForm.role, password: "" });
      load();
    } finally {
      setAccLoading(false);
    }
  }

  if (error) return <p className="text-red-400">{error}</p>;
  if (!school) return <p className="text-slate-400">Laden...</p>;

  const inputClass =
    "w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500";

  const byRole = (role: string) => school.gebruikers.filter((g) => g.role === role);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{school.naam}</h1>
          <p className="text-sm text-slate-400">
            {school.slug}
            {school.plaats ? ` · ${school.plaats}` : ""}
            {school.contactEmail ? ` · ${school.contactEmail}` : ""}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {school._count.klassen} klassen · {school._count.vakken} vakken ·{" "}
            {school.gebruikers.length} accounts
          </p>
        </div>
        <button
          onClick={toggleActief}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            school.actief
              ? "bg-red-900 text-red-200 hover:bg-red-800"
              : "bg-emerald-700 text-white hover:bg-emerald-600"
          }`}
        >
          {school.actief ? "Deactiveren" : "Activeren"}
        </button>
      </div>

      {!school.actief && (
        <div className="mb-6 rounded-md border border-red-800 bg-red-950 p-3 text-sm text-red-300">
          Deze school is gedeactiveerd — gebruikers kunnen niet meer inloggen in de app.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {(["ADMIN", "DOCENT", "LEERLING", "OUDER"] as const).map((role) => {
            const accounts = byRole(role);
            return (
              <section key={role}>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                  {ROLE_LABELS[role]} ({accounts.length})
                </h2>
                {accounts.length === 0 ? (
                  <p className="text-sm text-slate-600">Geen accounts.</p>
                ) : (
                  <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-900">
                    {accounts.map((a) => (
                      <li key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium">{a.name}</span>
                          <span className="ml-2 text-slate-400">{a.email}</span>
                        </div>
                        {!a.actief && (
                          <span className="rounded-full bg-red-900 px-2 py-0.5 text-xs text-red-300">
                            inactief
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

        <div className="space-y-4">
          <form
            onSubmit={handleCreateAccount}
            className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-4"
          >
            <h2 className="font-medium">Account toevoegen</h2>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Rol</label>
              <select
                value={accForm.role}
                onChange={(e) => setAccForm((f) => ({ ...f, role: e.target.value }))}
                className={inputClass}
              >
                <option value="ADMIN">Admin</option>
                <option value="DOCENT">Docent</option>
                <option value="LEERLING">Leerling</option>
                <option value="OUDER">Ouder</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Naam</label>
              <input
                required
                value={accForm.name}
                onChange={(e) => setAccForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">E-mail</label>
              <input
                required
                type="email"
                value={accForm.email}
                onChange={(e) => setAccForm((f) => ({ ...f, email: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Wachtwoord (leeg = genereren)
              </label>
              <input
                type="text"
                value={accForm.password}
                onChange={(e) => setAccForm((f) => ({ ...f, password: e.target.value }))}
                className={inputClass}
              />
            </div>
            {accError && <p className="text-sm text-red-400">{accError}</p>}
            <button
              type="submit"
              disabled={accLoading}
              className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {accLoading ? "Bezig..." : "Account aanmaken"}
            </button>
          </form>

          {createdCreds.length > 0 && (
            <div className="rounded-lg border border-amber-700 bg-amber-950 p-4">
              <p className="mb-2 text-sm font-medium text-amber-300">
                Aangemaakte inloggegevens (alleen nu zichtbaar):
              </p>
              <ul className="space-y-2">
                {createdCreds.map((c, i) => (
                  <li key={i} className="font-mono text-xs">
                    <span className="text-amber-200">{c.role}</span> — {c.email} /{" "}
                    <span className="font-semibold">{c.password}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
