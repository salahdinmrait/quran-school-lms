"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NieuweSchoolPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    schoolId: string;
    adminAccount: { email: string; password: string } | null;
  } | null>(null);

  const [form, setForm] = useState({
    naam: "",
    slug: "",
    plaats: "",
    adres: "",
    contactEmail: "",
    contactTelefoon: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  });

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function slugify(naam: string) {
    return naam
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        naam: form.naam,
        slug: form.slug || slugify(form.naam),
        plaats: form.plaats || undefined,
        adres: form.adres || undefined,
        contactEmail: form.contactEmail || undefined,
        contactTelefoon: form.contactTelefoon || undefined,
      };
      if (form.adminName && form.adminEmail) {
        body.admin = {
          name: form.adminName,
          email: form.adminEmail,
          ...(form.adminPassword ? { password: form.adminPassword } : {}),
        };
      }
      const res = await fetch("/api/dev/scholen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Kon school niet aanmaken");
        return;
      }
      setResult({ schoolId: data.school.id, adminAccount: data.adminAccount });
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="mb-4 text-2xl font-semibold text-emerald-400">School aangemaakt ✓</h1>
        {result.adminAccount && (
          <div className="mb-6 rounded-lg border border-amber-700 bg-amber-950 p-4">
            <p className="mb-2 font-medium text-amber-300">
              Admin-inloggegevens — bewaar deze, het wachtwoord wordt niet nog eens getoond:
            </p>
            <p className="font-mono text-sm">E-mail: {result.adminAccount.email}</p>
            <p className="font-mono text-sm">Wachtwoord: {result.adminAccount.password}</p>
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => router.push(`/dev/scholen/${result.schoolId}`)}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Naar schooldetail
          </button>
          <button
            onClick={() => router.push("/dev")}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Terug naar overzicht
          </button>
        </div>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500";

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-semibold">Nieuwe school onboarden</h1>
      <p className="mb-6 text-sm text-slate-400">
        Maak een nieuwe schoolomgeving aan, optioneel direct met het eerste admin-account.
        De admin maakt daarna zelf docenten, leerlingen en ouders aan (via site of app) —
        of je doet dat hier vanaf de schooldetailpagina.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset className="space-y-3 rounded-lg border border-slate-800 p-4">
          <legend className="px-1 text-sm font-medium text-slate-300">Schoolgegevens</legend>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Naam *</label>
            <input
              required
              value={form.naam}
              onChange={(e) => set("naam", e.target.value)}
              className={inputClass}
              placeholder="bijv. Moskee An-Nour Weekendschool"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">
              Slug (uniek, voor identificatie)
            </label>
            <input
              value={form.slug}
              onChange={(e) => set("slug", e.target.value)}
              className={inputClass}
              placeholder={form.naam ? slugify(form.naam) : "an-nour-weekendschool"}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Plaats</label>
              <input value={form.plaats} onChange={(e) => set("plaats", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Adres</label>
              <input value={form.adres} onChange={(e) => set("adres", e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Contact e-mail</label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => set("contactEmail", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Telefoon</label>
              <input
                value={form.contactTelefoon}
                onChange={(e) => set("contactTelefoon", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-lg border border-slate-800 p-4">
          <legend className="px-1 text-sm font-medium text-slate-300">
            Eerste admin-account (optioneel)
          </legend>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Naam</label>
            <input
              value={form.adminName}
              onChange={(e) => set("adminName", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">E-mail</label>
            <input
              type="email"
              value={form.adminEmail}
              onChange={(e) => set("adminEmail", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">
              Wachtwoord (leeg = automatisch genereren)
            </label>
            <input
              type="text"
              value={form.adminPassword}
              onChange={(e) => set("adminPassword", e.target.value)}
              className={inputClass}
              placeholder="min. 8 tekens"
            />
          </div>
        </fieldset>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading || !form.naam}
          className="w-full rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? "Bezig met aanmaken..." : "School aanmaken"}
        </button>
      </form>
    </div>
  );
}
