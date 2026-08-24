"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, UserPlus, BookOpen, GraduationCap, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VakBadge } from "@/components/vakken/VakBadge";

type VakCategorie = "HIFZ" | "TAJWEED" | "ARABISCH" | "FIQH" | "SIRA" | "OVERIG";

interface Leerling {
  id: string;
  leerlingId: string;
  name: string;
  email: string;
}

interface Docent {
  id: string;
  docentId: string;
  name: string;
  email: string;
}

interface Vak {
  id: string;
  vakId: string;
  naam: string;
  categorie: string;
}

interface AvailableUser {
  id: string;
  name: string;
  email: string;
}

interface AvailableVak {
  id: string;
  naam: string;
  categorie: string;
}

interface Props {
  klasId: string;
  gekoppeldeLeerlingen: Leerling[];
  gekoppeldeDocenten: Docent[];
  gekoppeldeVakken: Vak[];
  alleLeerlingen: AvailableUser[];
  alleDocenten: AvailableUser[];
  alleVakken: AvailableVak[];
}

export default function KlasBeheerClient({
  klasId,
  gekoppeldeLeerlingen,
  gekoppeldeDocenten,
  gekoppeldeVakken,
  alleLeerlingen,
  alleDocenten,
  alleVakken,
}: Props) {
  const router = useRouter();

  const linkedLeerlingIds = new Set(gekoppeldeLeerlingen.map((l) => l.leerlingId));
  const linkedDocentIds = new Set(gekoppeldeDocenten.map((d) => d.docentId));
  const linkedVakIds = new Set(gekoppeldeVakken.map((v) => v.vakId));

  const beschikbareLeerlingen = alleLeerlingen.filter((l) => !linkedLeerlingIds.has(l.id));
  const beschikbareDocenten = alleDocenten.filter((d) => !linkedDocentIds.has(d.id));
  const beschikbareVakken = alleVakken.filter((v) => !linkedVakIds.has(v.id));

  // Multi-select state for adding leerlingen
  const [checkedLeerlingen, setCheckedLeerlingen] = useState<Set<string>>(new Set());
  const [leerlingSearch, setLeerlingSearch] = useState("");
  const [loadingLeerling, setLoadingLeerling] = useState(false);

  // Multi-select state for removing enrolled leerlingen
  const [removeMode, setRemoveMode] = useState(false);
  const [checkedToRemove, setCheckedToRemove] = useState<Set<string>>(new Set());
  const [removingLeerlingen, setRemovingLeerlingen] = useState(false);

  // Single select for docent/vak
  const [selectedDocent, setSelectedDocent] = useState("");
  const [selectedVak, setSelectedVak] = useState("");
  const [loadingDocent, setLoadingDocent] = useState(false);
  const [loadingVak, setLoadingVak] = useState(false);

  // Filter leerlingen by search
  // Zonder zoekterm tonen we bewust niemand: bij een volle school zou dat een
  // lijst van honderden namen zijn. Typen levert maximaal MAX_TREFFERS rijen.
  const MAX_TREFFERS = 8;
  const zoekterm = leerlingSearch.trim().toLowerCase();
  const filteredBeschikbaar = zoekterm
    ? beschikbareLeerlingen.filter(
        (l) =>
          l.name.toLowerCase().includes(zoekterm) ||
          l.email.toLowerCase().includes(zoekterm)
      )
    : [];
  const zichtbareBeschikbaar = filteredBeschikbaar.slice(0, MAX_TREFFERS);

  function toggleLeerling(id: string) {
    setCheckedLeerlingen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (checkedLeerlingen.size === zichtbareBeschikbaar.length && zichtbareBeschikbaar.length > 0) {
      setCheckedLeerlingen(new Set());
    } else {
      setCheckedLeerlingen(new Set(zichtbareBeschikbaar.map((l) => l.id)));
    }
  }

  async function addLeerlingen() {
    if (checkedLeerlingen.size === 0) return;
    setLoadingLeerling(true);
    try {
      const res = await fetch(`/api/klassen/${klasId}/leerlingen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leerlingIds: Array.from(checkedLeerlingen) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Onbekende fout");
      toast.success(
        `${data.toegevoegd} leerling${data.toegevoegd !== 1 ? "en" : ""} ingeschreven.` +
          (data.overgeslagen > 0 ? ` (${data.overgeslagen} al ingeschreven)` : "")
      );
      setCheckedLeerlingen(new Set());
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Kon leerlingen niet toevoegen");
    } finally {
      setLoadingLeerling(false);
    }
  }

  async function removeLeerling(leerlingId: string) {
    try {
      const res = await fetch(`/api/klassen/${klasId}/leerlingen`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leerlingId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Leerling verwijderd uit klas");
      router.refresh();
    } catch {
      toast.error("Kon leerling niet verwijderen");
    }
  }

  async function removeLeerlingenBulk() {
    if (checkedToRemove.size === 0) return;
    if (!confirm(`${checkedToRemove.size} leerling(en) uit de klas verwijderen?`)) return;
    setRemovingLeerlingen(true);
    let ok = 0;
    for (const leerlingId of checkedToRemove) {
      try {
        await fetch(`/api/klassen/${klasId}/leerlingen`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leerlingId }),
        });
        ok++;
      } catch { /* continue */ }
    }
    toast.success(`${ok} leerling(en) verwijderd.`);
    setCheckedToRemove(new Set());
    setRemoveMode(false);
    setRemovingLeerlingen(false);
    router.refresh();
  }

  async function addDocent() {
    if (!selectedDocent) return;
    setLoadingDocent(true);
    try {
      const res = await fetch(`/api/klassen/${klasId}/docenten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docentId: selectedDocent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Onbekende fout");
      toast.success("Docent toegevoegd aan klas");
      setSelectedDocent("");
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Kon docent niet toevoegen");
    } finally {
      setLoadingDocent(false);
    }
  }

  async function removeDocent(docentId: string) {
    try {
      const res = await fetch(`/api/klassen/${klasId}/docenten`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docentId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Docent verwijderd uit klas");
      router.refresh();
    } catch {
      toast.error("Kon docent niet verwijderen");
    }
  }

  async function addVak() {
    if (!selectedVak) return;
    setLoadingVak(true);
    try {
      const res = await fetch(`/api/klassen/${klasId}/vakken`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vakId: selectedVak }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Onbekende fout");
      toast.success("Vak toegevoegd aan klas");
      setSelectedVak("");
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Kon vak niet toevoegen");
    } finally {
      setLoadingVak(false);
    }
  }

  async function removeVak(vakId: string) {
    try {
      const res = await fetch(`/api/klassen/${klasId}/vakken`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vakId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Vak verwijderd uit klas");
      router.refresh();
    } catch {
      toast.error("Kon vak niet verwijderen");
    }
  }

  const allFilteredChecked =
    zichtbareBeschikbaar.length > 0 &&
    zichtbareBeschikbaar.every((l) => checkedLeerlingen.has(l.id));

  return (
    <div className="grid gap-6">
      {/* ── Vakken ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <BookOpen className="h-5 w-5 text-green-700" />
            Vakken
            <span className="ml-auto text-sm font-normal text-gray-500">
              {gekoppeldeVakken.length} vak{gekoppeldeVakken.length !== 1 ? "ken" : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {gekoppeldeVakken.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Nog geen vakken gekoppeld.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {gekoppeldeVakken.map((v) => (
                <li key={v.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <VakBadge categorie={v.categorie as VakCategorie} />
                    <span className="text-sm font-medium text-gray-900">{v.naam}</span>
                  </div>
                  <button
                    onClick={() => removeVak(v.vakId)}
                    className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {beschikbareVakken.length > 0 && (
            <div className="flex gap-2 pt-2">
              <select
                value={selectedVak}
                onChange={(e) => setSelectedVak(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">— Selecteer een vak —</option>
                {beschikbareVakken.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.naam} ({v.categorie})
                  </option>
                ))}
              </select>
              <Button
                onClick={addVak}
                disabled={!selectedVak || loadingVak}
                className="bg-green-700 hover:bg-green-800 text-white shrink-0"
              >
                <BookOpen className="h-4 w-4 mr-1" />
                Toevoegen
              </Button>
            </div>
          )}
          {beschikbareVakken.length === 0 && gekoppeldeVakken.length > 0 && (
            <p className="text-xs text-gray-400 pt-1">Alle beschikbare vakken zijn al gekoppeld.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Docenten ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <GraduationCap className="h-5 w-5 text-green-700" />
            Docenten
            <span className="ml-auto text-sm font-normal text-gray-500">
              {gekoppeldeDocenten.length} docent{gekoppeldeDocenten.length !== 1 ? "en" : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {gekoppeldeDocenten.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Nog geen docenten gekoppeld.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {gekoppeldeDocenten.map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{d.name}</p>
                    <p className="text-xs text-gray-500">{d.email}</p>
                  </div>
                  <button
                    onClick={() => removeDocent(d.docentId)}
                    className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {beschikbareDocenten.length > 0 && (
            <div className="flex gap-2 pt-2">
              <select
                value={selectedDocent}
                onChange={(e) => setSelectedDocent(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">— Selecteer een docent —</option>
                {beschikbareDocenten.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.email}
                  </option>
                ))}
              </select>
              <Button
                onClick={addDocent}
                disabled={!selectedDocent || loadingDocent}
                className="bg-green-700 hover:bg-green-800 text-white shrink-0"
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Toevoegen
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Leerlingen (multi-select) ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <UserPlus className="h-5 w-5 text-green-700" />
            Leerlingen
            <span className="ml-auto text-sm font-normal text-gray-500">
              {gekoppeldeLeerlingen.length} leerling{gekoppeldeLeerlingen.length !== 1 ? "en" : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Ingeschreven leerlingen */}
          {gekoppeldeLeerlingen.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Nog geen leerlingen ingeschreven.</p>
          ) : (
            <>
              {/* Remove mode toggle */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">{gekoppeldeLeerlingen.length} ingeschreven</p>
                <button
                  type="button"
                  onClick={() => { setRemoveMode((v) => !v); setCheckedToRemove(new Set()); }}
                  className={`text-xs px-2 py-1 rounded transition-colors ${removeMode ? "bg-red-100 text-red-700" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {removeMode ? "Annuleren" : "Selecteren om te verwijderen"}
                </button>
              </div>
              <ul className="divide-y divide-gray-100">
                {gekoppeldeLeerlingen.map((l) => (
                  <li key={l.id} className="flex items-center justify-between py-2">
                    {removeMode ? (
                      <label className="flex items-center gap-3 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checkedToRemove.has(l.leerlingId)}
                          onChange={() => setCheckedToRemove((prev) => {
                            const next = new Set(prev);
                            next.has(l.leerlingId) ? next.delete(l.leerlingId) : next.add(l.leerlingId);
                            return next;
                          })}
                          className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{l.name}</p>
                          <p className="text-xs text-gray-500">{l.email}</p>
                        </div>
                      </label>
                    ) : (
                      <>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{l.name}</p>
                          <p className="text-xs text-gray-500">{l.email}</p>
                        </div>
                        <button
                          onClick={() => removeLeerling(l.leerlingId)}
                          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                          title="Verwijderen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {removeMode && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-gray-500">{checkedToRemove.size} geselecteerd</span>
                  <Button
                    size="sm"
                    onClick={removeLeerlingenBulk}
                    disabled={checkedToRemove.size === 0 || removingLeerlingen}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    {removingLeerlingen ? "Bezig…" : `Verwijderen (${checkedToRemove.size})`}
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Multi-select toevoegen */}
          {beschikbareLeerlingen.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden mt-2">
              {/* Search + select-all header */}
              <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Zoeken op naam of e-mail…"
                  value={leerlingSearch}
                  onChange={(e) => setLeerlingSearch(e.target.value)}
                  className="flex-1 text-sm bg-transparent outline-none text-gray-800 placeholder-gray-400"
                />
                {filteredBeschikbaar.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs text-green-700 hover:underline whitespace-nowrap shrink-0"
                  >
                    {allFilteredChecked ? "Deselecteer alles" : "Selecteer alles"}
                  </button>
                )}
              </div>

              {/* Checkbox list */}
              <ul className="max-h-52 overflow-y-auto divide-y divide-gray-100">
                {!zoekterm ? (
                  <li className="px-3 py-3 text-sm text-gray-400 text-center">
                    Typ een naam of e-mailadres om te zoeken.
                  </li>
                ) : filteredBeschikbaar.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-gray-400 text-center">
                    Geen resultaten gevonden.
                  </li>
                ) : (
                  zichtbareBeschikbaar.map((l) => (
                    <li key={l.id}>
                      <label className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checkedLeerlingen.has(l.id)}
                          onChange={() => toggleLeerling(l.id)}
                          className="rounded border-gray-300 text-green-700 focus:ring-green-500"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{l.name}</p>
                          <p className="text-xs text-gray-500 truncate">{l.email}</p>
                        </div>
                      </label>
                    </li>
                  ))
                )}
                {filteredBeschikbaar.length > MAX_TREFFERS && (
                  <li className="px-3 py-2 text-xs text-gray-400 text-center">
                    Nog {filteredBeschikbaar.length - MAX_TREFFERS} anderen — typ verder om te verfijnen.
                  </li>
                )}
              </ul>

              {/* Action footer */}
              <div className="bg-gray-50 px-3 py-2 border-t border-gray-200 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {checkedLeerlingen.size} geselecteerd
                </span>
                <Button
                  onClick={addLeerlingen}
                  disabled={checkedLeerlingen.size === 0 || loadingLeerling}
                  size="sm"
                  className="bg-green-700 hover:bg-green-800 text-white"
                >
                  <UserPlus className="h-3.5 w-3.5 mr-1" />
                  {loadingLeerling
                    ? "Bezig…"
                    : `Inschrijven (${checkedLeerlingen.size})`}
                </Button>
              </div>
            </div>
          )}

          {beschikbareLeerlingen.length === 0 && gekoppeldeLeerlingen.length > 0 && (
            <p className="text-xs text-gray-400">Alle beschikbare leerlingen zijn al ingeschreven.</p>
          )}
          {beschikbareLeerlingen.length === 0 && gekoppeldeLeerlingen.length === 0 && (
            <p className="text-xs text-gray-400">Er zijn geen leerlingen in het systeem.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
