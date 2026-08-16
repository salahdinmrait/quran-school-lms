"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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
  const router = useRouter();
  const [school, setSchool] = useState<SchoolDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Definitief verwijderen (gevarenzone)
  const [delOpen, setDelOpen] = useState(false);
  const [delSlug, setDelSlug] = useState("");
  const [delLoading, setDelLoading] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);

  // Nieuw account form
  const [accForm, setAccForm] = useState({ name: "", email: "", role: "DOCENT", password: "" });
  const [accLoading, setAccLoading] = useState(false);
  const [accError, setAccError] = useState<string | null>(null);
  const [createdCreds, setCreatedCreds] = useState<
    { name: string; email: string; role: string; password: string }[]
  >([]);

  // Excel-import
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    totaal: number;
    aangemaakt: number;
    overgeslagen: number;
    fouten: number;
    resultaten: {
      rij: number;
      naam: string;
      email: string;
      status: "aangemaakt" | "overgeslagen" | "fout";
      reden?: string;
      wachtwoord?: string;
    }[];
  } | null>(null);

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

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!school) return;
    setDelError(null);
    setDelLoading(true);
    try {
      const res = await fetch(`/api/dev/scholen/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bevestiging: delSlug.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDelError(data.error ?? "Kon school niet verwijderen");
        return;
      }
      router.push("/dev");
    } catch {
      setDelError("Verwijderen mislukt — probeer het opnieuw");
    } finally {
      setDelLoading(false);
    }
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

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importFile) return;
    setImportError(null);
    setImportResult(null);
    setImportLoading(true);
    try {
      const formData = new FormData();
      formData.append("bestand", importFile);
      const res = await fetch(`/api/dev/scholen/${id}/import`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error ?? "Import mislukt");
        return;
      }
      setImportResult(data);
      setImportFile(null);
      load();
    } catch {
      setImportError("Import mislukt — probeer het opnieuw");
    } finally {
      setImportLoading(false);
    }
  }

  if (error) return <p className="text-red-400">{error}</p>;
  if (!school) return <p className="text-slate-400">Laden...</p>;

  // text-slate-100 is nodig: globals.css zet `input { color: #111827 }` (donker),
  // wat op de donkere dev-achtergrond onleesbaar is. Een class wint van die regel.
  const inputClass =
    "w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-500";

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

          <form
            onSubmit={handleImport}
            className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-4"
          >
            <h2 className="font-medium">Gebruikers importeren (Excel)</h2>
            <p className="text-xs text-slate-400">
              Laat de school de template invullen en upload hem hier. Voor iedere rij wordt
              een account aangemaakt en automatisch een welkomstmail met inloggegevens
              verstuurd. Tip: splits lijsten groter dan ±150 rijen in meerdere bestanden.
            </p>
            <a
              href="/api/dev/import-template"
              className="inline-block rounded-md border border-emerald-700 px-3 py-1.5 text-sm text-emerald-400 hover:bg-emerald-950"
            >
              ⬇ Download template
            </a>
            <div>
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-sm file:text-white hover:file:bg-slate-600"
              />
            </div>
            {importError && <p className="text-sm text-red-400">{importError}</p>}
            <button
              type="submit"
              disabled={!importFile || importLoading}
              className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {importLoading ? "Bezig met importeren... (kan even duren)" : "Importeren"}
            </button>
          </form>

          {importResult && (
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <p className="mb-2 text-sm font-medium">
                Import klaar: <span className="text-emerald-400">{importResult.aangemaakt} aangemaakt</span>
                {importResult.overgeslagen > 0 && (
                  <span className="text-amber-400"> · {importResult.overgeslagen} overgeslagen</span>
                )}
                {importResult.fouten > 0 && (
                  <span className="text-red-400"> · {importResult.fouten} fouten</span>
                )}
              </p>
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-500">
                      <th className="py-1 pr-2">Rij</th>
                      <th className="py-1 pr-2">E-mail</th>
                      <th className="py-1">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {importResult.resultaten.map((r) => (
                      <tr key={r.rij}>
                        <td className="py-1 pr-2 text-slate-500">{r.rij}</td>
                        <td className="py-1 pr-2 font-mono">{r.email || "—"}</td>
                        <td className="py-1">
                          {r.status === "aangemaakt" && (
                            <span className="text-emerald-400">
                              ✓ aangemaakt{r.wachtwoord ? ` · ww: ${r.wachtwoord}` : ""}
                            </span>
                          )}
                          {r.status === "overgeslagen" && (
                            <span className="text-amber-400">− {r.reden ?? "overgeslagen"}</span>
                          )}
                          {r.status === "fout" && (
                            <span className="text-red-400">✗ {r.reden ?? "fout"}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                De wachtwoorden hierboven zijn alleen nu zichtbaar — iedere gebruiker heeft
                ze ook per e-mail ontvangen.
              </p>
            </div>
          )}

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

      <section className="mt-10 rounded-lg border border-red-900 bg-red-950/40 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-red-400">
          Gevarenzone
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          <strong>Deactiveren</strong> houdt alles bewaard en blokkeert alleen het inloggen —
          dat is bijna altijd wat je wilt. <strong>Definitief verwijderen</strong> wist de
          school en álle bijbehorende data (accounts, klassen, vakken, cijfers, huiswerk,
          aanwezigheid, berichten, materialen). Dit is <strong>onomkeerbaar</strong> en kan
          alleen nog worden teruggehaald uit een nachtelijke backup van vóór het verwijderen.
        </p>

        {!delOpen ? (
          <button
            onClick={() => {
              setDelOpen(true);
              setDelError(null);
              setDelSlug("");
            }}
            className="mt-3 rounded-md border border-red-700 px-3 py-1.5 text-sm text-red-300 hover:bg-red-900"
          >
            School definitief verwijderen…
          </button>
        ) : (
          <form onSubmit={handleDelete} className="mt-3 max-w-md space-y-3">
            <p className="text-sm text-slate-300">
              Typ ter bevestiging de slug{" "}
              <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-red-300">
                {school.slug}
              </code>{" "}
              over:
            </p>
            <input
              value={delSlug}
              onChange={(e) => setDelSlug(e.target.value)}
              className={inputClass}
              placeholder={school.slug}
              autoComplete="off"
            />
            {delError && <p className="text-sm text-red-400">{delError}</p>}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={delLoading || delSlug.trim() !== school.slug}
                className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-40"
              >
                {delLoading ? "Bezig met verwijderen..." : "Ja, definitief verwijderen"}
              </button>
              <button
                type="button"
                onClick={() => setDelOpen(false)}
                disabled={delLoading}
                className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
              >
                Annuleren
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
