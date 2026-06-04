"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen, Plus, ChevronDown, ChevronUp, Loader2,
  Trash2, CheckCircle, Circle, Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SURAHS, getSurah } from "@/lib/quran";
import { formatDate } from "@/lib/utils";

interface Leerling { id: string; name: string; email: string; }
interface HifdhTaak {
  id: string; type: string; surahNr: number; vanAyah: number;
  totAyah: number; weekStart: string; voltooid: boolean;
}
interface HifdhProfiel {
  id: string; leerlingId: string; leerling: Leerling;
  startSurahNr: number; startAyahNr: number;
  huidigeSurahNr: number; huidigeAyahNr: number;
  ayaatPerWeek: number; opmerkingen: string | null;
  taken: HifdhTaak[];
}

interface Les {
  klas: { leerlingen: { leerling: Leerling }[] };
}

export default function DocentHifdhPage() {
  const [profielen, setProfielen] = useState<HifdhProfiel[]>([]);
  const [leerlingen, setLeerlingen] = useState<Leerling[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showProfielForm, setShowProfielForm] = useState(false);
  const [savingProfiel, setSavingProfiel] = useState(false);
  const [savingTaak, setSavingTaak] = useState<string | null>(null); // profielId

  const [profielForm, setProfielForm] = useState({
    leerlingId: "", startSurahNr: "114", startAyahNr: "1",
    ayaatPerWeek: "5", opmerkingen: "",
  });

  // Taak form per profiel (keyed by profielId)
  const [taakForms, setTaakForms] = useState<Record<string, {
    type: string; surahNr: string; vanAyah: string; totAyah: string; weekStart: string;
  }>>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/hifdh").then((r) => r.json()),
      fetch("/api/docent/lessen").then((r) => r.json()),
    ]).then(([hifdhData, lesData]) => {
      setProfielen(Array.isArray(hifdhData) ? hifdhData : []);
      // Extract unique leerlingen from lessen
      const map = new Map<string, Leerling>();
      if (Array.isArray(lesData)) {
        for (const les of lesData as Les[]) {
          for (const { leerling } of les.klas?.leerlingen ?? []) {
            map.set(leerling.id, leerling);
          }
        }
      }
      setLeerlingen(Array.from(map.values()));
      setIsFetching(false);
    }).catch(() => setIsFetching(false));
  }, []);

  const leerlingenZonderProfiel = leerlingen.filter(
    (l) => !profielen.some((p) => p.leerlingId === l.id)
  );

  async function saveProfiel(e: React.FormEvent) {
    e.preventDefault();
    if (!profielForm.leerlingId) { toast.error("Selecteer een leerling."); return; }
    setSavingProfiel(true);
    try {
      const res = await fetch("/api/hifdh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leerlingId: profielForm.leerlingId,
          startSurahNr: Number(profielForm.startSurahNr),
          startAyahNr: Number(profielForm.startAyahNr),
          ayaatPerWeek: Number(profielForm.ayaatPerWeek),
          opmerkingen: profielForm.opmerkingen || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Hifdh-profiel opgeslagen.");
      setProfielen((prev) => {
        const exists = prev.findIndex((p) => p.leerlingId === data.leerlingId);
        return exists >= 0 ? prev.map((p) => p.leerlingId === data.leerlingId ? data : p) : [data, ...prev];
      });
      setProfielForm({ leerlingId: "", startSurahNr: "114", startAyahNr: "1", ayaatPerWeek: "5", opmerkingen: "" });
      setShowProfielForm(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Opslaan mislukt.");
    } finally {
      setSavingProfiel(false);
    }
  }

  async function saveTaak(profielId: string, e: React.FormEvent) {
    e.preventDefault();
    const form = taakForms[profielId];
    if (!form) return;
    setSavingTaak(profielId);
    try {
      const res = await fetch("/api/hifdh/taken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profielId,
          type: form.type,
          surahNr: Number(form.surahNr),
          vanAyah: Number(form.vanAyah),
          totAyah: Number(form.totAyah),
          weekStart: form.weekStart,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Taak toegevoegd.");
      setProfielen((prev) => prev.map((p) =>
        p.id === profielId ? { ...p, taken: [...p.taken, data] } : p
      ));
      setTaakForms((prev) => ({ ...prev, [profielId]: { ...prev[profielId], vanAyah: "", totAyah: "" } }));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Mislukt.");
    } finally {
      setSavingTaak(null);
    }
  }

  async function deleteTaak(profielId: string, taakId: string) {
    try {
      await fetch(`/api/hifdh/taken/${taakId}`, { method: "DELETE" });
      setProfielen((prev) => prev.map((p) =>
        p.id === profielId ? { ...p, taken: p.taken.filter((t) => t.id !== taakId) } : p
      ));
      toast.success("Taak verwijderd.");
    } catch {
      toast.error("Verwijderen mislukt.");
    }
  }

  // Group taken by week for display
  function groupByWeek(taken: HifdhTaak[]) {
    const groups: Record<string, HifdhTaak[]> = {};
    for (const t of taken) {
      const key = t.weekStart.slice(0, 10);
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return groups;
  }

  if (isFetching) {
    return (
      <div className="p-6 flex items-center gap-2 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Laden…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hifdh Tracker</h1>
          <p className="text-gray-500 mt-1 text-sm">Beheer Quran-memorisatie voortgang van leerlingen.</p>
        </div>
        <Button onClick={() => setShowProfielForm((v) => !v)} className="bg-green-700 hover:bg-green-800 text-white">
          {showProfielForm ? <ChevronUp className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          {showProfielForm ? "Sluiten" : "Profiel aanmaken"}
        </Button>
      </div>

      {/* Create/update profiel form */}
      {showProfielForm && (
        <Card>
          <CardHeader><CardTitle className="text-base text-gray-900">Hifdh-profiel instellen</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={saveProfiel} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Leerling <span className="text-red-500">*</span></label>
                <select
                  value={profielForm.leerlingId}
                  onChange={(e) => setProfielForm((p) => ({ ...p, leerlingId: e.target.value }))}
                  required
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">— Selecteer leerling —</option>
                  {leerlingen.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                {leerlingenZonderProfiel.length < leerlingen.length && (
                  <p className="text-xs text-green-700 mt-1">
                    ✓ {leerlingen.length - leerlingenZonderProfiel.length} leerling(en) hebben al een profiel (selecteer opnieuw om bij te werken)
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Startsurah <span className="text-red-500">*</span></label>
                <select
                  value={profielForm.startSurahNr}
                  onChange={(e) => setProfielForm((p) => ({ ...p, startSurahNr: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {[...SURAHS].reverse().map((s) => (
                    <option key={s.nr} value={s.nr}>{s.nr}. {s.naamAr} — {s.naam} ({s.ayaat} ayaat)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Startayah</label>
                <Input
                  type="number" min="1"
                  value={profielForm.startAyahNr}
                  onChange={(e) => setProfielForm((p) => ({ ...p, startAyahNr: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Doel (ayaat/week)</label>
                <Input
                  type="number" min="1" max="50"
                  value={profielForm.ayaatPerWeek}
                  onChange={(e) => setProfielForm((p) => ({ ...p, ayaatPerWeek: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opmerkingen</label>
                <Input
                  value={profielForm.opmerkingen}
                  onChange={(e) => setProfielForm((p) => ({ ...p, opmerkingen: e.target.value }))}
                  placeholder="bijv. Maak gebruik van tajweed regels"
                />
              </div>
              <div className="sm:col-span-2 flex gap-3">
                <Button type="submit" disabled={savingProfiel} className="bg-green-700 hover:bg-green-800 text-white">
                  {savingProfiel && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Opslaan
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowProfielForm(false)}>Annuleren</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Profielen list */}
      {profielen.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-400 text-sm">
            <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
            Nog geen hifdh-profielen aangemaakt.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {profielen.map((profiel) => {
            const isExpanded = expandedId === profiel.id;
            const voltooide = profiel.taken.filter((t) => t.voltooid).length;
            const huidigeSurah = getSurah(profiel.huidigeSurahNr);
            const weekGroups = groupByWeek(profiel.taken);
            const taakForm = taakForms[profiel.id] ?? { type: "NIEUW", surahNr: String(profiel.huidigeSurahNr), vanAyah: "", totAyah: "", weekStart: new Date().toISOString().slice(0, 10) };

            return (
              <Card key={profiel.id}>
                <CardContent className="py-4 px-4">
                  <button
                    className="w-full flex items-center gap-3 text-left"
                    onClick={() => setExpandedId(isExpanded ? null : profiel.id)}
                  >
                    <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <BookOpen className="h-4 w-4 text-green-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{profiel.leerling.name}</p>
                      <p className="text-xs text-gray-500">
                        Huidig: {huidigeSurah?.naamAr} ({huidigeSurah?.naam}) · Ayah {profiel.huidigeAyahNr}
                        {" · "}doel: {profiel.ayaatPerWeek} ayaat/week
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-green-700 font-medium">
                        {voltooide}/{profiel.taken.length} ✓
                      </span>
                      <button
                        className="p-1 rounded hover:bg-gray-100"
                        onClick={(e) => { e.stopPropagation(); setShowProfielForm(true); setProfielForm({ leerlingId: profiel.leerlingId, startSurahNr: String(profiel.startSurahNr), startAyahNr: String(profiel.startAyahNr), ayaatPerWeek: String(profiel.ayaatPerWeek), opmerkingen: profiel.opmerkingen ?? "" }); }}
                        title="Profiel bewerken"
                      >
                        <Users className="h-3.5 w-3.5 text-gray-400" />
                      </button>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                      {/* Taken per week */}
                      {Object.entries(weekGroups).sort(([a], [b]) => a.localeCompare(b)).map(([weekKey, taken]) => {
                        const allDone = taken.every((t) => t.voltooid);
                        return (
                          <div key={weekKey}>
                            <p className="text-xs font-medium text-gray-500 uppercase mb-1.5">
                              Week van {formatDate(weekKey)}
                            </p>
                            <div className="space-y-1.5">
                              {taken.map((taak) => {
                                const surah = getSurah(taak.surahNr);
                                return (
                                  <div key={taak.id} className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm ${taak.voltooid ? "bg-green-50" : "bg-gray-50"}`}>
                                    {taak.voltooid
                                      ? <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                      : <Circle className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                                    }
                                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${taak.type === "NIEUW" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                                      {taak.type === "NIEUW" ? "Nieuw" : "Herh."}
                                    </span>
                                    <span className={`flex-1 font-medium ${taak.voltooid ? "text-green-700" : "text-gray-800"}`}>
                                      {surah?.naamAr} v{taak.vanAyah}–{taak.totAyah}
                                    </span>
                                    <button
                                      onClick={() => deleteTaak(profiel.id, taak.id)}
                                      className="p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                            {allDone && <p className="text-xs text-green-600 mt-1">✓ Alles voltooid deze week!</p>}
                          </div>
                        );
                      })}

                      {/* Add taak form */}
                      <form onSubmit={(e) => saveTaak(profiel.id, e)} className="bg-green-50 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-semibold text-green-800">Nieuwe taak toevoegen</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-600 mb-0.5">Type</label>
                            <select
                              value={taakForm.type}
                              onChange={(e) => setTaakForms((p) => ({ ...p, [profiel.id]: { ...taakForm, type: e.target.value } }))}
                              className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900"
                            >
                              <option value="NIEUW">Nieuw memoriseren</option>
                              <option value="HERHALING">Herhaling</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-0.5">Surah</label>
                            <select
                              value={taakForm.surahNr}
                              onChange={(e) => setTaakForms((p) => ({ ...p, [profiel.id]: { ...taakForm, surahNr: e.target.value } }))}
                              className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900"
                            >
                              {[...SURAHS].reverse().map((s) => (
                                <option key={s.nr} value={s.nr}>{s.nr}. {s.naam}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-0.5">Van ayah</label>
                            <Input
                              type="number" min="1"
                              value={taakForm.vanAyah}
                              onChange={(e) => setTaakForms((p) => ({ ...p, [profiel.id]: { ...taakForm, vanAyah: e.target.value } }))}
                              required className="text-xs py-1.5"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-0.5">Tot ayah</label>
                            <Input
                              type="number" min="1"
                              value={taakForm.totAyah}
                              onChange={(e) => setTaakForms((p) => ({ ...p, [profiel.id]: { ...taakForm, totAyah: e.target.value } }))}
                              required className="text-xs py-1.5"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs text-gray-600 mb-0.5">Week van</label>
                            <Input
                              type="date"
                              value={taakForm.weekStart}
                              onChange={(e) => setTaakForms((p) => ({ ...p, [profiel.id]: { ...taakForm, weekStart: e.target.value } }))}
                              required className="text-xs py-1.5"
                            />
                          </div>
                        </div>
                        <Button type="submit" size="sm" disabled={savingTaak === profiel.id} className="bg-green-700 hover:bg-green-800 text-white">
                          {savingTaak === profiel.id && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Taak toevoegen
                        </Button>
                      </form>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
