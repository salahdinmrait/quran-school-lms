"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  BookOpen, Plus, Trash2, Loader2, ChevronDown, ChevronUp,
  CheckCircle, XCircle, Users, Trophy, MessageSquare, Save,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VakBadge } from "@/components/vakken/VakBadge";
import { formatDate } from "@/lib/utils";

type VakCategorie = "HIFZ" | "TAJWEED" | "ARABISCH" | "FIQH" | "SIRA" | "OVERIG";

interface Vak { id: string; naam: string; categorie: string; }
interface Klas {
  id: string; naam: string;
  vakken: { vak: Vak }[];
  leerlingen: { leerling: { id: string; name: string } }[];
}
interface Les { id: string; datum: string; begintijd: string; eindtijd: string; lokaal: string | null; klas: Klas; }

interface Inlevering {
  id: string;
  inhoud: string;
  opmerking: string | null;
  opmerkingOp: string | null;
  leerling: { id: string; name: string };
}

interface HuiswerkItem {
  id: string;
  titel: string;
  beschrijving: string | null;
  deadline: string | null;
  vak: Vak;
  les: { id: string; datum: string; begintijd: string; eindtijd: string; klas: { naam: string } } | null;
  inleveringen: Inlevering[];
}

interface RankingItem {
  positie: number;
  leerling: { id: string; name: string };
  aantalIngeleverd: number;
  totaal: number;
  percentage: number;
}
interface KlasRanking { klasId: string; klasNaam: string; top3: RankingItem[]; totaalHw: number; }

const MEDAL = ["🥇", "🥈", "🥉"];

export default function HuiswerkPage() {
  const [lessen, setLessen] = useState<Les[]>([]);
  const [huiswerk, setHuiswerk] = useState<HuiswerkItem[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedHwId, setExpandedHwId] = useState<string | null>(null);

  // Opmerking state: { [inleveringId]: text }
  const [opmerkingen, setOpmerkingen] = useState<Record<string, string>>({});
  const [savingOpmerking, setSavingOpmerking] = useState<Record<string, boolean>>({});

  // Ranking
  const [rankings, setRankings] = useState<KlasRanking[]>([]);
  const [selectedKlasRanking, setSelectedKlasRanking] = useState<string>("");

  const [form, setForm] = useState({
    titel: "", beschrijving: "", deadline: "", vakId: "", lesId: "", selectedKlasId: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/docent/lessen").then((r) => r.json()),
      fetch("/api/docent/huiswerk").then((r) => r.json()),
    ]).then(([lesData, hwData]) => {
      const les: Les[] = Array.isArray(lesData) ? lesData : [];
      const hw: HuiswerkItem[] = Array.isArray(hwData) ? hwData : [];
      setLessen(les);
      setHuiswerk(hw);

      // Init opmerking state from existing data
      const initOp: Record<string, string> = {};
      for (const h of hw) {
        for (const inv of h.inleveringen) {
          if (inv.opmerking) initOp[inv.id] = inv.opmerking;
        }
      }
      setOpmerkingen(initOp);

      setIsFetching(false);

      // Fetch rankings for unique klassen
      const klassenMap = new Map<string, string>();
      for (const l of les) klassenMap.set(l.klas.id, l.klas.naam);
      if (klassenMap.size > 0) {
        setSelectedKlasRanking(Array.from(klassenMap.keys())[0]);
        Promise.all(
          Array.from(klassenMap.keys()).map((kid) =>
            fetch(`/api/klassen/${kid}/ranking`).then((r) => r.json())
          )
        ).then((results) => {
          setRankings(results.filter((r) => r && !r.error));
        });
      }
    }).catch(() => setIsFetching(false));
  }, []);

  const klassenMap = new Map<string, Klas>();
  for (const les of lessen) {
    if (!klassenMap.has(les.klas.id)) klassenMap.set(les.klas.id, les.klas);
  }
  const klassen = Array.from(klassenMap.values());
  const selectedKlas = klassen.find((k) => k.id === form.selectedKlasId);
  const vakkenForKlas = selectedKlas?.vakken.map((kv) => kv.vak) ?? [];
  const lessenForKlas = lessen.filter((l) => l.klas.id === form.selectedKlasId);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "selectedKlasId") { next.vakId = ""; next.lesId = ""; }
      return next;
    });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titel || !form.vakId) { toast.error("Titel en vak zijn verplicht."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/docent/huiswerk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titel: form.titel, beschrijving: form.beschrijving || null,
          deadline: form.deadline || null, vakId: form.vakId, lesId: form.lesId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Huiswerk aangemaakt.");
      setHuiswerk((prev) => [data, ...prev]);
      setForm({ titel: "", beschrijving: "", deadline: "", vakId: "", lesId: "", selectedKlasId: "" });
      setShowForm(false);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Aanmaken mislukt."); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Huiswerkopgave verwijderen?")) return;
    try {
      const res = await fetch(`/api/docent/huiswerk/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Verwijderd.");
      setHuiswerk((prev) => prev.filter((h) => h.id !== id));
    } catch { toast.error("Verwijderen mislukt."); }
  }

  const handleSaveOpmerking = useCallback(async (inleveringId: string) => {
    const tekst = opmerkingen[inleveringId] ?? "";
    if (!tekst.trim()) { toast.error("Opmerking is leeg."); return; }
    setSavingOpmerking((p) => ({ ...p, [inleveringId]: true }));
    try {
      const res = await fetch(`/api/docent/huiswerk/inleveringen/${inleveringId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opmerking: tekst }),
      });
      if (!res.ok) throw new Error();
      toast.success("Opmerking opgeslagen. Leerling en ouder(s) zijn genotificeerd.");
      // Update local state
      setHuiswerk((prev) =>
        prev.map((hw) => ({
          ...hw,
          inleveringen: hw.inleveringen.map((inv) =>
            inv.id === inleveringId
              ? { ...inv, opmerking: tekst, opmerkingOp: new Date().toISOString() }
              : inv
          ),
        }))
      );
    } catch { toast.error("Opslaan mislukt."); }
    finally { setSavingOpmerking((p) => ({ ...p, [inleveringId]: false })); }
  }, [opmerkingen]);

  if (isFetching) {
    return <div className="p-6 flex items-center gap-2 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Laden…</div>;
  }

  const activeRanking = rankings.find((r) => r.klasId === selectedKlasRanking) ?? rankings[0];

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Huiswerk</h1>
          <p className="text-gray-500 mt-1 text-sm">Huiswerkopgaven beheren en inleveringen bekijken.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} className="bg-green-700 hover:bg-green-800 text-white">
          {showForm ? <ChevronUp className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          {showForm ? "Sluiten" : "Nieuw huiswerk"}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base text-gray-900">Huiswerkopdracht aanmaken</CardTitle></CardHeader>
          <CardContent>
            {klassen.length === 0 ? (
              <p className="text-sm text-gray-500">U bent nog niet aan een klas gekoppeld.</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Klas</label>
                  <select name="selectedKlasId" value={form.selectedKlasId} onChange={handleChange}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">— Selecteer klas —</option>
                    {klassen.map((k) => <option key={k.id} value={k.id}>{k.naam}</option>)}
                  </select>
                </div>
                {form.selectedKlasId && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Vak <span className="text-red-500">*</span></label>
                      <select name="vakId" value={form.vakId} onChange={handleChange} required
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500">
                        <option value="">— Selecteer vak —</option>
                        {vakkenForKlas.map((v) => <option key={v.id} value={v.id}>{v.naam}</option>)}
                      </select>
                    </div>
                    {lessenForKlas.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Koppelen aan les (optioneel)</label>
                        <select name="lesId" value={form.lesId} onChange={handleChange}
                          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500">
                          <option value="">— Geen specifieke les —</option>
                          {lessenForKlas.map((l) => (
                            <option key={l.id} value={l.id}>
                              {formatDate(l.datum)} · {l.begintijd}–{l.eindtijd}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titel <span className="text-red-500">*</span></label>
                  <Input name="titel" value={form.titel} onChange={handleChange} placeholder="bijv. Surah Al-Fatiha memoriseren" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Beschrijving</label>
                  <Textarea name="beschrijving" value={form.beschrijving} onChange={handleChange} rows={3} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                  <Input type="date" name="deadline" value={form.deadline} onChange={handleChange} />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" disabled={saving} className="bg-green-700 hover:bg-green-800 text-white">
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    Aanmaken
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Annuleren</Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Klassement ───────────────────────────────────────────────── */}
      {klassen.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="flex items-center gap-2 text-base text-gray-900">
                <Trophy className="h-4 w-4 text-amber-500" />
                Klassement — ingeleverd huiswerk
              </CardTitle>
              {klassen.length > 1 && (
                <select
                  value={selectedKlasRanking}
                  onChange={(e) => setSelectedKlasRanking(e.target.value)}
                  className="text-sm rounded-md border border-gray-300 bg-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {klassen.map((k) => <option key={k.id} value={k.id}>{k.naam}</option>)}
                </select>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!activeRanking || activeRanking.totaalHw === 0 ? (
              <p className="text-sm text-gray-400 italic">Nog geen huiswerk aangemaakt voor deze klas.</p>
            ) : activeRanking.top3.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Nog geen inleveringen.</p>
            ) : (
              <div className="space-y-2">
                {activeRanking.top3.map((item) => (
                  <div key={item.leerling.id} className="flex items-center gap-3 rounded-lg bg-white border border-amber-100 px-3 py-2">
                    <span className="text-xl w-8 text-center">{MEDAL[item.positie - 1] ?? `#${item.positie}`}</span>
                    <span className="flex-1 text-sm font-medium text-gray-900">{item.leerling.name}</span>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-green-700">{item.percentage}%</p>
                      <p className="text-xs text-gray-400">{item.aantalIngeleverd}/{item.totaal}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Huiswerk list ─────────────────────────────────────────────── */}
      {huiswerk.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-400 text-sm">
            <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
            Nog geen huiswerkopgaven aangemaakt.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {huiswerk.map((hw) => {
            const isExpanded = expandedHwId === hw.id;
            const ingeleverdeIds = new Set(hw.inleveringen.map((i) => i.leerling.id));

            const relevanteLessen = lessen.filter((l) =>
              l.klas.vakken.some((kv) => kv.vak.id === hw.vak.id)
            );
            const allLeerlingenIds = new Map<string, { id: string; name: string }>();
            for (const les of relevanteLessen) {
              for (const { leerling } of les.klas.leerlingen) {
                allLeerlingenIds.set(leerling.id, leerling);
              }
            }
            const allLeerlingen = Array.from(allLeerlingenIds.values());
            const totaal = allLeerlingen.length;
            const aantalIngeleverd = hw.inleveringen.length;
            const aantalOpen = totaal - aantalIngeleverd;
            const notIngeleverd = allLeerlingen.filter((l) => !ingeleverdeIds.has(l.id));

            return (
              <Card key={hw.id}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-semibold text-gray-900">{hw.titel}</p>
                        <VakBadge categorie={hw.vak.categorie as VakCategorie} />
                      </div>
                      {hw.les && (
                        <p className="text-xs text-gray-500 mb-1">
                          📅 {formatDate(hw.les.datum)} · {hw.les.begintijd}–{hw.les.eindtijd} · {hw.les.klas.naam}
                        </p>
                      )}
                      {hw.beschrijving && <p className="text-xs text-gray-500 mb-1">{hw.beschrijving}</p>}
                      <div className="flex items-center gap-4 mt-1 flex-wrap">
                        {hw.deadline && (
                          <span className="text-xs text-amber-600">Deadline: {formatDate(hw.deadline)}</span>
                        )}
                        {totaal > 0 && (
                          <button
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                            onClick={() => setExpandedHwId(isExpanded ? null : hw.id)}
                          >
                            <Users className="h-3.5 w-3.5" />
                            <span className="text-green-700 font-medium">{aantalIngeleverd}</span>/{totaal} ingeleverd
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>

                      {/* ── Expanded: submissions + feedback ─────────── */}
                      {isExpanded && totaal > 0 && (
                        <div className="mt-4 pt-3 border-t border-gray-100 space-y-4">

                          {/* Ingeleverd with full content + opmerking */}
                          {hw.inleveringen.length > 0 && (
                            <div className="space-y-3">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                                Ingeleverd ({hw.inleveringen.length})
                              </p>
                              {hw.inleveringen.map((inv) => {
                                const saving = savingOpmerking[inv.id] ?? false;
                                const opmerkingText = opmerkingen[inv.id] ?? inv.opmerking ?? "";
                                return (
                                  <div key={inv.id} className="rounded-lg border border-green-100 bg-green-50/40 p-3 space-y-2">
                                    <p className="text-xs font-semibold text-green-800">{inv.leerling.name}</p>
                                    {/* Submission content */}
                                    <div className="rounded bg-white border border-green-100 px-2 py-1.5 text-sm text-gray-700 whitespace-pre-wrap">
                                      {inv.inhoud}
                                    </div>
                                    {/* Opmerking */}
                                    <div className="space-y-1.5">
                                      <div className="flex items-center gap-1 text-xs text-gray-500">
                                        <MessageSquare className="h-3.5 w-3.5" />
                                        <span className="font-medium">Opmerking</span>
                                        {inv.opmerkingOp && (
                                          <span className="text-gray-400">· opgeslagen {formatDate(inv.opmerkingOp)}</span>
                                        )}
                                      </div>
                                      <Textarea
                                        rows={2}
                                        placeholder="Voeg feedback toe aan deze inlevering…"
                                        value={opmerkingText}
                                        onChange={(e) =>
                                          setOpmerkingen((p) => ({ ...p, [inv.id]: e.target.value }))
                                        }
                                        className="text-sm"
                                      />
                                      <Button
                                        size="sm"
                                        disabled={saving || !opmerkingText.trim() || opmerkingText.trim() === (inv.opmerking ?? "")}
                                        onClick={() => handleSaveOpmerking(inv.id)}
                                        className="bg-green-700 hover:bg-green-800 text-white h-7 text-xs px-3"
                                      >
                                        {saving
                                          ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                          : <Save className="h-3 w-3 mr-1" />
                                        }
                                        {inv.opmerking ? "Bijwerken" : "Opslaan"} & notificeer
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Not yet submitted */}
                          {notIngeleverd.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-2">
                                <XCircle className="h-3.5 w-3.5 text-red-400" />
                                Niet ingeleverd ({notIngeleverd.length})
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                {notIngeleverd.map((l) => (
                                  <div key={l.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm bg-red-50">
                                    <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                                    <span className="text-red-700 font-medium">{l.name}</span>
                                    <span className="text-xs text-red-400">openstaand</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {aantalOpen === 0 && (
                            <p className="text-xs text-green-700 font-medium">
                              ✓ Alle leerlingen hebben ingeleverd!
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(hw.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
