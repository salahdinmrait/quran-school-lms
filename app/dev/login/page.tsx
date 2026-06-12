"use client";

import { useState } from "react";

export default function DevLoginPage() {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/dev/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Inloggen mislukt (status ${res.status})`);
        setLoading(false);
        return;
      }
      // Volledige page-load zodat de middleware de nieuwe cookie zeker meekrijgt
      window.location.href = "/dev";
    } catch {
      setError("Kon geen verbinding maken met de server");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-sm">
      <h1 className="mb-1 text-xl font-semibold">Developer login</h1>
      <p className="mb-6 text-sm text-slate-400">
        Voer de developer-sleutel in om scholen te beheren.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Developer-sleutel"
          autoFocus
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading || !secret}
          className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? "Bezig..." : "Inloggen"}
        </button>
      </form>
    </div>
  );
}
