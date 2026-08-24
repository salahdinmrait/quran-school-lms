"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Calendar, Clock, Plus, Trash2, BookOpen,
  ChevronDown, ChevronUp, Loader2, RepeatIcon, CheckCircle, UserCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VakBadge } from "@/components/vakken/VakBadge";
import { formatDate } from "@/lib/utils";

const AANWEZIGHEID_STATUSSEN = [
  { value: "AANWEZIG", label: "Aanwezig", kleur: "bg-green-100 text-green-700 border-green-300" },
  { value: "TE_LAAT", label: "Te laat", kleur: "bg-amber-100 text-amber-700 border-amber-300" },
  { value: "GEOORLOOFD", label: "Geoorloofd", kleur: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "AFWEZIG", label: "Afwezig", kleur: "bg-red-100 text-red-700 border-red-300" },
];

type VakCategorie = "HIFZ" | "TAJWEED" | "ARABISCH" | "FIQH" | "SIRA" | "OVERIG";

interface Vak { id: string; naam: string; categorie: string; }
interface Klas {
  id: string; naam: string;
  vakken: { vak: Vak }[];
  leerlingen: { leerling: { id: string; name: string } }[];
}
interface Les {
  id: string; datum: string; begintijd: string; eindtijd: string;
  lokaal: string | null; klas: Klas; vak: Vak | null;
}
interface HuiswerkItem {
  id: string; titel: string; beschrijving: string | null;
  vak: Vak;
  inleveringen: { id: string }[];
}

export default function DocentRoosterPage() {
  const [lessen, setLessen] = useState<Les[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingLesson, setAddingLesson] = useState(false);

  const [expandedLesId, setExpandedLesId] = useState<string | null>(null);
  const [huiswerkPerLes, setHuiswerkPerLes] = useState<Record<string, HuiswerkItem[]>>({});
  const [loadingHw, setLoadingHw] = useState<string | null>(null);
  const [showHwForm, setShowHwForm] = useState<string | null>(null);
  const [savingHw, setSavingHw] = useState(false);
  const [deletingHw, setDeletingHw] = useState<string | null>(null);

  // Aanwezigheid hoort bij de les, niet bij een aparte pagina
  const [aanwezigheidPerLes, setAanwezigheidPerLes] = useState<Record<string, Record<string, string>>>({});
  const [savingAanw, setSavingAanw] = useState<string | null>(null);

  const [lesForm, setLesForm] = useState({
    selectedKlasId: "",
    vakId: "",
    datum: "",
    begintijd: "",
    eindtijd: "",
    lokaal: "",
    herhalen: false,
    totDatum: "",
  });

  const [hwForm, setHwForm] = useState({
    titel: "", beschrijving: "", vakId: "",
  });

  useEffect(() => {
    fetch("/api/lessen")
      .then((r) => r.json())
      .then((data) => {
        setLessen(Array.isArray(data) ? data : []);
        setIsFetching(false);
      })
      .catch(() => setIsFetching(false));
  }, []);

  // Derive unique klassen from lesson list
  const klassenMap = new Map<string, Klas>();
  for (const les of lessen) {
    if (!klassenMap.has(les.klas.id)) klassenMap.set(les.klas.id, les.klas);
  }
  const klassen = Array.from(klassenMap.values());

  const selectedKlasForForm = klassen.find((k) => k.id === lesForm.selectedKlasId);
  const vakkenVoorFormKlas = selectedKlasForForm?.vakken.map((kv) => kv.vak) ?? [];

  async function toggleLes(les: Les) {
    if (expandedLesId === les.id) { setExpandedLesId(null); return; }
    setExpandedLesId(les.id);
    if (!huiswerkPerLes[les.id]) {
      setLoadingHw(les.id);
      try {
        const [hw, aanw] = await Promise.all([
          fetch(`/api/docent/huiswerk?lesId=${les.id}`).then((r) => r.json()),
          fetch(`/api/docent/absentie?lesId=${les.id}`).then((r) => r.json()),
        ]);
        setHuiswerkPerLes((prev) => ({ ...prev, [les.id]: Array.isArray(hw) ? hw : [] }));
        setAanwezigheidPerLes((prev) => ({
          ...prev,
          [les.id]: Object.fromEntries(
            (Array.isArray(aanw) ? aanw : []).map((a: { leerlingId: string; status: string }) => [
              a.leerlingId,
              a.status,
            ])
          ),
        }));
      } catch {
        toast.error("Kon de les niet laden.");
      } finally {
        setLoadingHw(null);
      }
    }
  }

  // Aanwezigheid registreren: optimistisch wegschrijven en terugdraaien bij een
  // fout — precies zoals het lesdetail in de app dat doet.
  async function registreerAanwezigheid(lesId: string, leerlingId: string, status: string) {
    const vorige = aanwezigheidPerLes[lesId]?.[leerlingId];
    setAanwezigheidPerLes((prev) => ({
      ...prev,
      [lesId]: { ...(prev[lesId] ?? {}), [leerlingId]: status },
    }));
    setSavingAanw(leerlingId);
    try {
      const res = await fetch("/api/docent/absentie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesId, leerlingId, status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setAanwezigheidPerLes((prev) => {
        const les = { ...(prev[lesId] ?? {}) };
        if (vorige) les[leerlingId] = vorige;
        else delete les[leerlingId];
        return { ...prev, [lesId]: les };
      });
      toast.error("Opslaan mislukt.");
    } finally {
      setSavingAanw(null);
    }
  }

  async function addLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!lesForm.selectedKlasId || !lesForm.datum || !lesForm.begintijd || !lesForm.eindtijd) {
      toast.error("Vul alle verplichte velden in.");
      return;
    }
    setAddingLesson(true);
    try {
      const body: Record<string, unknown> = {
        klasId: lesForm.selectedKlasId,
        vakId: lesForm.vakId || null,
        datum: lesForm.datum,
        begintijd: lesForm.begintijd,
        eindtijd: lesForm.eindtijd,
        lokaal: lesForm.lokaal || null,
      };
      if (lesForm.herhalen && lesForm.totDatum) body.herhalen = { totDatum: lesForm.totDatum };

      const res = await fetch("/api/lessen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.count === 1 ? "Les aangemaakt." : `${data.count} herhalende lessen aangemaakt.`);

      const lesRes = await fetch("/api/lessen");
      const lesData = await lesRes.json();
      setLessen(Array.isArray(lesData) ? lesData : []);
      setLesForm({ selectedKlasId: "", vakId: "", datum: "", begintijd: "", eindtijd: "", lokaal: "", herhalen: false, totDatum: "" });
      setShowAddForm(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Aanmaken mislukt.");
    } finally {
      setAddingLesson(false);
    }
  }

  async function addHuiswerk(lesId: string, vakkenForLes: Vak[], e: React.FormEvent) {
    e.preventDefault();
    if (!hwForm.titel || !hwForm.vakId) { toast.error("Titel en vak zijn verplicht."); return; }
    setSavingHw(true);
    try {
      const res = await fetch("/api/docent/huiswerk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titel: hwForm.titel, beschrijving: hwForm.beschrijving || null,
          vakId: hwForm.vakId, lesId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const vakObj = vakkenForLes.find((v) => v.id === hwForm.vakId) ?? { id: hwForm.vakId, naam: "Onbekend", categorie: "OVERIG" };
      toast.success("Huiswerk toegevoegd aan les.");
      setHuiswerkPerLes((prev) => ({
        ...prev,
        [lesId]: [{ id: data.id, titel: data.titel, beschrijving: data.beschrijving, vak: vakObj, inleveringen: [] }, ...(prev[lesId] ?? [])],
      }));
      setHwForm({ titel: "", beschrijving: "", vakId: "" });
      setShowHwForm(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Aanmaken mislukt.");
    } finally {
      setSavingHw(false);
    }
  }

  // Huiswerk verwijderen vanuit de les — inclusief bevestiging. De API ruimt
  // ook de koppelingen (doelleerlingen, afvinkingen) op.
  async function deleteHuiswerk(lesId: string, huiswerkId: string) {
    if (!confirm("Weet je zeker dat je dit huiswerk wilt verwijderen?")) return;
    setDeletingHw(huiswerkId);
    try {
      const res = await fetch(`/api/docent/huiswerk/${huiswerkId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setHuiswerkPerLes((prev) => ({
        ...prev,
        [lesId]: (prev[lesId] ?? []).filter((h) => h.id !== huiswerkId),
      }));
      toast.success("Huiswerk verwijderd.");
    } catch {
      toast.error("Verwijderen mislukt.");
    } finally {
      setDeletingHw(null);
    }
  }

  async function deleteLesson(id: string) {
    if (!confirm("Les verwijderen? Ook gekoppeld huiswerk wordt verwijderd.")) return;
    try {
      const res = await fetch(`/api/lessen/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Les verwijderd.");
      setLessen((prev) => prev.filter((l) => l.id !== id));
      if (expandedLesId === id) setExpandedLesId(null);
    } catch {
      toast.error("Verwijderen mislukt.");
    }
  }

  // Group lessons by date
  const grouped: Record<string, Les[]> = {};
  for (const les of lessen) {
    const key = les.datum.slice(0, 10);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(les);
  }

  if (isFetching) {
    return (
      <div className="p-6 flex items-center gap-2 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Laden…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rooster</h1>
          <p className="text-gray-500 mt-1 text-sm">Uw lessen. Klik op een les om huiswerk toe te voegen.</p>
        </div>
        <Button onClick={() => setShowAddForm((v) => !v)} className="bg-green-700 hover:bg-green-800 text-white">
          <Plus className="h-4 w-4 mr-1" />
          Nieuwe les
        </Button>
      </div>

      {/* Add lesson form */}
      {showAddForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base text-gray-900">Les toevoegen</CardTitle>
          </CardHeader>
          <CardContent>
            {klassen.length === 0 ? (
              <p className="text-sm text-gray-500">U bent nog niet aan een klas gekoppeld. Vraag de beheerder u aan een klas te koppelen.</p>
            ) : (
              <form onSubmit={addLesson} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Klas */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Klas <span className="text-red-500">*</span></label>
                  <select
                    value={lesForm.selectedKlasId}
                    onChange={(e) => setLesForm((p) => ({ ...p, selectedKlasId: e.target.value, vakId: "" }))}
                    required
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">— Selecteer klas —</option>
                    {klassen.map((k) => <option key={k.id} value={k.id}>{k.naam}</option>)}
                  </select>
                </div>

                {/* Vak (linked to selected klas) */}
                {lesForm.selectedKlasId && (
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vak <span className="text-gray-400 font-normal">(optioneel)</span></label>
                    <select
                      value={lesForm.vakId}
                      onChange={(e) => setLesForm((p) => ({ ...p, vakId: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">— Geen specifiek vak —</option>
                      {vakkenVoorFormKlas.map((v) => (
                        <option key={v.id} value={v.id}>{v.naam}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Datum <span className="text-red-500">*</span></label>
                  <Input type="date" value={lesForm.datum} onChange={(e) => setLesForm((p) => ({ ...p, datum: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lokaal</label>
                  <Input value={lesForm.lokaal} onChange={(e) => setLesForm((p) => ({ ...p, lokaal: e.target.value }))} placeholder="bijv. A101" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Begintijd <span className="text-red-500">*</span></label>
                  <Input type="time" value={lesForm.begintijd} onChange={(e) => setLesForm((p) => ({ ...p, begintijd: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Eindtijd <span className="text-red-500">*</span></label>
                  <Input type="time" value={lesForm.eindtijd} onChange={(e) => setLesForm((p) => ({ ...p, eindtijd: e.target.value }))} required />
                </div>

                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lesForm.herhalen}
                      onChange={(e) => setLesForm((p) => ({ ...p, herhalen: e.target.checked }))}
                      className="rounded border-gray-300 text-green-700"
                    />
                    <RepeatIcon className="h-4 w-4 text-green-700" />
                    <span className="text-sm font-medium text-gray-700">Wekelijks herhalen</span>
                  </label>
                </div>
                {lesForm.herhalen && (
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Herhalen tot <span className="text-red-500">*</span></label>
                    <Input type="date" value={lesForm.totDatum} onChange={(e) => setLesForm((p) => ({ ...p, totDatum: e.target.value }))} min={lesForm.datum} />
                  </div>
                )}

                <div className="sm:col-span-2 flex gap-3">
                  <Button type="submit" disabled={addingLesson} className="bg-green-700 hover:bg-green-800 text-white">
                    {addingLesson ? "Bezig…" : lesForm.herhalen ? "Herhalende lessen aanmaken" : "Les aanmaken"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Annuleren</Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lesson list */}
      {lessen.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-400 text-sm">
            <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
            Geen lessen gevonden.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([date, dagLessen]) => (
            <div key={date}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {formatDate(date)}
              </h2>
              <div className="space-y-2">
                {dagLessen.map((les) => {
                  const isExpanded = expandedLesId === les.id;
                  const lesHw = huiswerkPerLes[les.id] ?? [];
                  const isLoadingHw = loadingHw === les.id;
                  const showingHwForm = showHwForm === les.id;
                  // Vakken: prefer les.klas.vakken, fallback to empty
                  const vakkenForLes = les.klas?.vakken?.map((kv) => kv.vak) ?? [];

                  return (
                    <Card key={les.id} className={isExpanded ? "ring-1 ring-green-300" : ""}>
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <button
                            className="flex-1 flex items-center gap-3 text-left"
                            onClick={() => toggleLes(les)}
                          >
                            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                              <Clock className="h-4 w-4 text-green-700" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-gray-900">{les.klas.naam}</p>
                                {les.vak && (
                                  <VakBadge categorie={les.vak.categorie as VakCategorie} />
                                )}
                              </div>
                              <p className="text-xs text-gray-500">
                                {les.begintijd} – {les.eindtijd}
                                {les.lokaal && ` · Lokaal ${les.lokaal}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {!isExpanded && lesHw.length > 0 && (
                                <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">
                                  {lesHw.length} hw
                                </span>
                              )}
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                            </div>
                          </button>
                          <button
                            onClick={() => deleteLesson(les.id)}
                            className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors shrink-0"
                            title="Les verwijderen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Expanded panel */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                            {isLoadingHw ? (
                              <div className="flex items-center gap-2 text-gray-400 text-sm">
                                <Loader2 className="h-4 w-4 animate-spin" /> Laden…
                              </div>
                            ) : (
                              <>
                                {/* Aanwezigheid — alleen hier, niet meer op een aparte pagina */}
                                {les.klas.leerlingen.length > 0 && (
                                  <div className="rounded-lg border border-gray-200 p-3">
                                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                                      <UserCheck className="h-3.5 w-3.5 text-green-600" />
                                      Aanwezigheid
                                    </p>
                                    <div className="space-y-1.5">
                                      {les.klas.leerlingen.map(({ leerling }) => {
                                        const huidig = aanwezigheidPerLes[les.id]?.[leerling.id] ?? "";
                                        return (
                                          <div key={leerling.id} className="flex flex-wrap items-center gap-2">
                                            <span className="min-w-0 flex-1 truncate text-sm text-gray-800">
                                              {leerling.name}
                                            </span>
                                            <div className="flex gap-1">
                                              {AANWEZIGHEID_STATUSSEN.map((st) => (
                                                <button
                                                  key={st.value}
                                                  type="button"
                                                  disabled={savingAanw === leerling.id}
                                                  onClick={() => registreerAanwezigheid(les.id, leerling.id, st.value)}
                                                  className={`rounded border px-2 py-0.5 text-xs transition-colors disabled:opacity-50 ${
                                                    huidig === st.value
                                                      ? st.kleur
                                                      : "border-gray-200 text-gray-500 hover:bg-gray-50"
                                                  }`}
                                                >
                                                  {st.label}
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {lesHw.length === 0 ? (
                                  <p className="text-sm text-gray-400 italic">Nog geen huiswerk aan deze les gekoppeld.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {lesHw.map((hw) => (
                                      <div key={hw.id} className="flex items-start gap-2 bg-gray-50 rounded-md px-3 py-2">
                                        <BookOpen className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-medium text-gray-800">{hw.titel}</p>
                                            <VakBadge categorie={hw.vak.categorie as VakCategorie} />
                                          </div>
                                          <p className="text-xs text-gray-500">
                                            <span className="inline-flex items-center gap-0.5">
                                              <CheckCircle className="h-3 w-3 text-green-600" />
                                              {hw.inleveringen.length} afgevinkt
                                            </span>
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => deleteHuiswerk(les.id, hw.id)}
                                          disabled={deletingHw === hw.id}
                                          title="Huiswerk verwijderen"
                                          className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {!showingHwForm ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setShowHwForm(les.id);
                                      setHwForm({ titel: "", beschrijving: "", vakId: vakkenForLes[0]?.id ?? "" });
                                    }}
                                  >
                                    <Plus className="h-3.5 w-3.5 mr-1" />
                                    Huiswerk toevoegen
                                  </Button>
                                ) : (
                                  <form onSubmit={(e) => addHuiswerk(les.id, vakkenForLes, e)} className="space-y-3 bg-green-50 rounded-lg p-3">
                                    <p className="text-xs font-semibold text-green-800">Nieuw huiswerk</p>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">Vak <span className="text-red-500">*</span></label>
                                      <select
                                        value={hwForm.vakId}
                                        onChange={(e) => setHwForm((p) => ({ ...p, vakId: e.target.value }))}
                                        required
                                        className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-green-500"
                                      >
                                        <option value="">— Selecteer vak —</option>
                                        {vakkenForLes.map((v) => (
                                          <option key={v.id} value={v.id}>{v.naam}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">Titel <span className="text-red-500">*</span></label>
                                      <Input value={hwForm.titel} onChange={(e) => setHwForm((p) => ({ ...p, titel: e.target.value }))} placeholder="bijv. Surah Al-Baqara v1-5 memoriseren" required className="text-sm" />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">Beschrijving</label>
                                      <Textarea value={hwForm.beschrijving} onChange={(e) => setHwForm((p) => ({ ...p, beschrijving: e.target.value }))} rows={2} className="text-sm" />
                                    </div>
                                    <div className="flex gap-2">
                                      <Button type="submit" size="sm" disabled={savingHw} className="bg-green-700 hover:bg-green-800 text-white">
                                        {savingHw && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                                        Opslaan
                                      </Button>
                                      <Button type="button" size="sm" variant="outline" onClick={() => setShowHwForm(null)}>Annuleren</Button>
                                    </div>
                                  </form>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
