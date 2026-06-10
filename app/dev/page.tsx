"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface School {
  id: string;
  naam: string;
  slug: string;
  plaats: string | null;
  actief: boolean;
  createdAt: string;
  _count: { gebruikers: number; klassen: number; vakken: number };
}

export default function DevDashboard() {
  const [scholen, setScholen] = useState<School[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dev/scholen")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Kon scholen niet laden"))))
      .then(setScholen)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-400">{error}</p>;
  if (!scholen) return <p className="text-slate-400">Laden...</p>;

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Scholen</h1>
          <p className="text-sm text-slate-400">
            {scholen.length} schoolomgeving{scholen.length === 1 ? "" : "en"}
          </p>
        </div>
      </div>

      {scholen.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 p-10 text-center">
          <p className="mb-3 text-slate-400">Nog geen scholen onboarded.</p>
          <Link
            href="/dev/scholen/nieuw"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Eerste school aanmaken
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {scholen.map((s) => (
            <Link
              key={s.id}
              href={`/dev/scholen/${s.id}`}
              className="rounded-lg border border-slate-800 bg-slate-900 p-4 transition hover:border-emerald-600"
            >
              <div className="mb-1 flex items-center justify-between">
                <h2 className="font-semibold">{s.naam}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    s.actief ? "bg-emerald-900 text-emerald-300" : "bg-red-900 text-red-300"
                  }`}
                >
                  {s.actief ? "actief" : "inactief"}
                </span>
              </div>
              <p className="mb-3 text-sm text-slate-400">
                {s.slug}
                {s.plaats ? ` · ${s.plaats}` : ""}
              </p>
              <div className="flex gap-4 text-xs text-slate-400">
                <span>{s._count.gebruikers} accounts</span>
                <span>{s._count.klassen} klassen</span>
                <span>{s._count.vakken} vakken</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
