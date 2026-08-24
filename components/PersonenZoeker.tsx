"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";

// Eén manier om in de LMS personen te kiezen: een zoekbalk, geen lijst met
// honderden vinkjes. Dezelfde regels als de zoekbalk in de app:
//   • lege zoekterm toont niets;
//   • er wordt op naam én e-mailadres gezocht;
//   • maximaal 8 treffers, met een hint om verder te typen;
//   • gekozen personen staan als chips boven het veld en zijn weg te klikken.
export interface Persoon {
  id: string;
  name: string;
  email?: string | null;
  /** Extra regel achter de naam, bv. "kind: Yusuf" of een klasnaam. */
  extra?: string | null;
}

const MAX_TREFFERS = 8;

export function PersonenZoeker({
  personen,
  selectedIds,
  onChange,
  multi = true,
  placeholder = "Zoek op naam of e-mailadres…",
  leegMelding = "Geen personen gevonden.",
}: {
  personen: Persoon[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  multi?: boolean;
  placeholder?: string;
  leegMelding?: string;
}) {
  const [zoek, setZoek] = useState("");

  const term = zoek.trim().toLowerCase();
  const treffers = term
    ? personen.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          (p.email ?? "").toLowerCase().includes(term)
      )
    : [];
  const zichtbaar = treffers.slice(0, MAX_TREFFERS);

  // De selectie bewaren we als id's; de naam halen we er hier weer bij, zodat
  // een chip blijft kloppen als de lijst opnieuw geladen wordt.
  const gekozen = selectedIds
    .map((id) => personen.find((p) => p.id === id))
    .filter((p): p is Persoon => !!p);

  function kies(id: string) {
    if (!multi) {
      onChange(selectedIds.includes(id) ? [] : [id]);
      setZoek("");
      return;
    }
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  }

  if (personen.length === 0) {
    return <p className="text-sm text-amber-600">{leegMelding}</p>;
  }

  return (
    <div className="space-y-2">
      {gekozen.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {gekozen.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => kies(p.id)}
              className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-xs text-green-800 hover:bg-green-100 transition-colors"
            >
              {p.name}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2">
        <Search className="h-4 w-4 text-gray-400 shrink-0" />
        <input
          type="text"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
        />
      </div>

      {term.length > 0 && (
        <div className="rounded-md border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {zichtbaar.length === 0 ? (
            <p className="px-3 py-3 text-sm text-gray-400 text-center">Geen resultaten gevonden.</p>
          ) : (
            zichtbaar.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => kies(p.id)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                  selectedIds.includes(p.id) ? "bg-green-50" : "hover:bg-gray-50"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-gray-900">{p.name}</span>
                  {(p.email || p.extra) && (
                    <span className="block truncate text-xs text-gray-500">{p.extra ?? p.email}</span>
                  )}
                </span>
                {selectedIds.includes(p.id) && (
                  <span className="text-xs text-green-700 shrink-0">gekozen</span>
                )}
              </button>
            ))
          )}
          {treffers.length > MAX_TREFFERS && (
            <p className="px-3 py-2 text-xs text-gray-400 text-center">
              Nog {treffers.length - MAX_TREFFERS} anderen — typ verder om te verfijnen.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
