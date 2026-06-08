"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  BookOpen, Plus, Trash2, Loader2, ChevronDown, ChevronUp,
  CheckSquare, Square, Users, Trophy, MessageSquare, Save, Paperclip, Download, X as XIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VakBadge } from "@/components/vakken/VakBadge";
import { formatDate } from "@/lib/utils";

type VakCategorie = "HIFZ" | "TAJWEED" | "ARABISCH" | "FIQH" | "SIRA" | "OVERIG";

interface Vak { id: string; naam: string; categorie: string; }
interface LeerlingInfo { id: string; name: string; }
interface Klas {
  id: string; naam: string;
  vakken: { vak: Vak }[];
  leerlingen: { leerling: LeerlingInfo }[];
}
interface Les { id: string; datum: string; begintijd: string; eindtijd: string; lokaal: string | null; klas: Klas; }

interface Inlevering {
  id: string;
  inhoud: string;
  opmerking: string | null;
  opmerkingOp: string | null;
  leerling: LeerlingInfo;
}
interface HuiswerkItem {
  id: string;
  titel: string;
  beschrijving: string | null;
  deadline: string | null;
  bijlageNaam: string | null;
  hasBijlage: boolean;
  vak: Vak;
  les: { id: string; datum: string; begintijd: string; klas: { naam: string } } | null;
  inleveringen: Inlevering[];
}

interface RankingItem {
  positie: number;
  leerling: LeerlingInfo;
  aantalIngeleverd: number;
  totaal: number;
  percentage: number;
}
interface KlasRanking { klasId: string; klasNaam: string; top3: RankingItem[]; totaalHw: number; }

const MEDAL = ["🥇", "🥈", "🥉"];

export default function HuiswerkPage() {
  const [lessen, setLessen] = useState<Les[]>([]);
  const [klassenDirect, setKlassenDirect] = useState<{ id: string; naam: string; vakken: Vak[]; leerlingen: LeerlingInfo[] }[]>([]);
  const [huiswerk, setHuiswerk] = useState<HuiswerkItem[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedHwId, setExpandedHwId] = useState<string | null>(null);

  // Per-inlevering opmerking state
  const [opmerkingen, setOpmerkingen] = useState<Record<string, string>>({});
  const [savingOpmerking, setSavingOpmerking] = useState<Record<string, boolean>>({});
  // Afvinken in-flight: key = `${huiswerkId}-${leerlingId}`
  const [afvinkLoading, setAfvinkLoading] = useState<Record<string, boolean>>({});

  const [rankings, setRankings] = useState<KlasRanking[]>([]);
  const [selectedKlasRanking, setSelectedKlasRanking] = useState<string>("");

  const [form, setForm] = useState({
    titel: "", beschrijving: "", deadline: "", vakId: "", lesId: "", selectedKlasId: "",
  });
  const [bijlage, setBijlage] = useState<{ naam: string; data: string; type: string } | null>(null);
  const [bijlageLoading, setBijlageLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/docent/lessen").then((r) => r.json()),
      fetch("/api/docent/huiswerk").then((r) => r.json()),
      fetch("/api/docent/klassen").then((r) => r.json()),
    ]).then(([lesData, hwData, klasData]) => {
      const les: Les[] = Array.isArray(lesData) ? lesData : [];
      const hw: HuiswerkItem[] = Array.isArray(hwData) ? hwData : [];
      setLessen(les);
      setHuiswerk(hw);

      // Store klassen from direct API for the form (avoids dependency on lessons existing)
      if (Array.isArray(klasData)) {
        setKlassenDirect(
          klasData.map((k: { id: string; naam: string; vakken: { id: string; naam: string; categorie: string }[]; leerlingen: { id: string; name: string }[] }) => ({
            id: k.id,
            naam: k.naam,
            vakken: k.vakken,
            leerlingen: k.leerlingen,
          }))
        );
      }

      const initOp: Record<string, string> = {};
      for (const h of hw) {
        for (const inv of h.inleveringen) {
          if (inv.opmerking) initOp[inv.id] = inv.opmerking;
        }
      }
      setOpmerkingen(initOp);
      setIsFetching(false);

      const klassenMap = new Map<string, string>();
      for (const l of les) klassenMap.set(l.klas.id, l.klas.naam);
      if (klassenMap.size > 0) {
        setSelectedKlasRanking(Array.from(klassenMap.keys())[0]);
        Promise.all(
          Array.from(klassenMap.keys()).map((kid) =>
            fetch(`/api/klassen/${kid}/ranking`).then((r) => r.json())
          )
        ).then((results) => setRankings(results.filter((r) => r && !r.error)));
      }
    }).catch(() => setIsFetching(false));
  }, []);

  // Derived: unique klassen from lessen (for leerlingen / ranking purposes)
  const klassenMap = new Map<string, Klas>();
  for (const les of lessen) {
    if (!klassenMap.has(les.klas.id)) klassenMap.set(les.klas.id, les.klas);
  }
  const klassen = Array.from(klassenMap.values());

  // For the FORM: use klassenDirect (independent of lessons existing)
  const formKlassenMap = new Map(klassenDirect.map((k) => [k.id, k]));
  const formKlas = formKlassenMap.get(form.selectedKlasId);
  const vakkenForKlas = formKlas?.vakken ?? [];
  const lessenForKlas = lessen.filter((l) => l.klas.id === form.selectedKlasId);

  // For a huiswerk, find all leerlingen across klassen that have its vak
  function getLeerlingenForHw(hw: HuiswerkItem): LeerlingInfo[] {
    const seen = new Set<string>();
    const result: LeerlingInfo[] = [];
    for (const klas of klassen) {
      const hasVak = klas.vakken.some((kv) => kv.vak.id === hw.vak.id);
      if (!hasVak) continue;
      for (const { leerling } of klas.leerlingen) {
        if (!seen.has(leerling.id)) {
          seen.add(leerling.id);
          result.push(leerling);
        }
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "selectedKlasId") { next.vakId = ""; next.lesId = ""; }
      return next;
    });
  };

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Bestand is te groot (max 5 MB).");
      e.target.value = "";
      return;
    }
    setBijlageLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // dataUrl = "data:<mime>;base64,<data>"
      const base64 = dataUrl.split(",")[1];
      setBijlage({ naam: file.name, data: base64, type: file.type || "application/octet-stream" });
      setBijlageLoading(false);
    };
    reader.onerror = () => { toast.error("Bestand lezen mislukt."); setBijlageLoading(false); };
    reader.readAsDataURL(file);
  }

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
          bijlageNaam: bijlage?.naam ?? null,
          bijlageData: bijlage?.data ?? null,
          bijlageType: bijlage?.type ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Huiswerk aangemaakt.");
      setHuiswerk((prev) => [data, ...prev]);
      setForm({ titel: "", beschrijving: "", deadline: "", vakId: "", lesId: "", selectedKlasId: "" });
      setBijlage(null);
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

  // Toggle afvinken for a specific leerling on a huiswerk
  async function toggleAfvink(hw: HuiswerkItem, leerling: LeerlingInfo) {
    const key = `${hw.id}-${leerling.id}`;
    const alreadyDone = hw.inleveringen.some((inv) => inv.leerling.id === leerling.id);
    setAfvinkLoading((p) => ({ ...p, [key]: true }));
    try {
      const res = await fetch("/api/docent/huiswerk/afvinken", {
        method: alreadyDone ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ huiswerkId: hw.id, leerlingId: leerling.id }),
      });
      if (!res.ok) throw new Error();

      setHuiswerk((prev) =>
        prev.map((h) => {
          if (h.id !== hw.id) return h;
          const newInleveringen = alreadyDone
            ? h.inleveringen.filter((inv) => inv.leerling.id !== leerling.id)
            : [...h.inleveringen, { id: key, inhoud: "✓", opmerking: null, opmerkingOp: null, leerling }];
          return { ...h, inleveringen: newInleveringen };
        })
      );
      toast.success(alreadyDone ? "Afvink ongedaan gemaakt." : `✓ ${leerling.name} afgevinkt`);
    } catch { toast.error("Bijwerken mislukt."); }
    finally { setAfvinkLoading((p) => ({ ...p, [key]: false })); }
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
      toast.success("Opmerking opgeslagen & leerling genotificeerd.");
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
          <p className="text-gray-500 mt-1 text-sm">{huiswerk.length} opgave{huiswerk.length !== 1 ? "n" : ""}</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} className="bg-green-700 hover:bg-green-800 text-white">
          <Plus className="h-4 w-4 mr-1" />
          Nieuw huiswerk
        </Button>
      </div>

      {/* Klassement */}
      {rankings.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base text-gray-900">
                <Trophy className="h-4 w-4 text-amber-500" />
                Klassement
              </CardTitle>
              {klassen.length > 1 && (
                <select
                  value={selectedKlasRanking}
                  onChange={(e) => setSelectedKlasRanking(e.target.value)}
                  className="text-xs border rounded px-2 py-1 bg-white"
                >
                  {klassen.map((k) => (
                    <option key={k.id} value={k.id}>{k.naam}</option>
                  ))}
                </select>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!activeRanking || activeRanking.totaalHw === 0 ? (
              <p className="text-sm text-gray-400 italic">Nog geen huiswerk/inleveringen voor deze klas.</p>
            ) : activeRanking.top3.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Nog geen inleveringen.</p>
            ) : (
              <div className="space-y-2">
                {activeRanking.top3.map((item) => (
                  <div key={item.leerling.id} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2">
                    <span className="text-xl w-8 text-center">{MEDAL[item.positie - 1]}</span>
                    <span className="flex-1 text-sm font-medium text-gray-900">{item.leerling.name}</span>
                    <p className="text-sm font-bold text-green-700">{item.percentage}%</p>
                    <p className="text-xs text-gray-400">{item.aantalIngeleverd}/{item.totaal}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* New homework form */}
      {showForm && (
        <Card className="border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-green-800 flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Nieuwe huiswerkopgave
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
                  <Input name="titel" value={form.titel} onChange={handleChange} placeholder="bijv. Memoriseer surah Al-Ikhlas" required />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Beschrijving</label>
                  <Textarea name="beschrijving" value={form.beschrijving} onChange={handleChange} placeholder="Optionele uitleg..." rows={2} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Klas</label>
                  <select name="selectedKlasId" value={form.selectedKlasId} onChange={handleChange}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                    <option value="">— Selecteer klas —</option>
                    {klassenDirect.map((k) => <option key={k.id} value={k.id}>{k.naam}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vak *</label>
                  <select name="vakId" value={form.vakId} onChange={handleChange} required
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                    <option value="">— Selecteer vak —</option>
                    {vakkenForKlas.map((v) => <option key={v.id} value={v.id}>{v.naam}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                  <Input type="date" name="deadline" value={form.deadline} onChange={handleChange} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Koppel aan les (optioneel)</label>
                  <select name="lesId" value={form.lesId} onChange={handleChange}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                    <option value="">— Geen —</option>
                    {lessenForKlas.map((l) => (
                      <option key={l.id} value={l.id}>
                        {new Date(l.datum).toLocaleDateString("nl-NL")} {l.begintijd}–{l.eindtijd}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Paperclip className="inline h-3.5 w-3.5 mr-1" />
                    Bijlage (optioneel, max 5 MB)
                  </label>
                  {bijlage ? (
                    <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2">
                      <Paperclip className="h-4 w-4 text-green-600 shrink-0" />
                      <span className="text-sm text-green-800 flex-1 truncate">{bijlage.naam}</span>
                      <button
                        type="button"
                        onClick={() => setBijlage(null)}
                        className="text-green-600 hover:text-red-500 transition-colors"
                      >
                        <XIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="file"
                        onChange={handleFileChange}
                        disabled={bijlageLoading}
                        accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.mp3,.mp4"
                        className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100 cursor-pointer border border-gray-300 rounded-md py-1.5 px-2"
                      />
                      {bijlageLoading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={saving} className="bg-green-700 hover:bg-green-800 text-white">
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Opslaan
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Annuleren</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Homework list */}
      {huiswerk.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-400 text-sm">
            <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
            Nog geen huiswerk aangemaakt.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {huiswerk.map((hw) => {
            const isExpanded = expandedHwId === hw.id;
            const alleL = getLeerlingenForHw(hw);
            const afgevinkt = hw.inleveringen.map((i) => i.leerling.id);
            const countDone = afgevinkt.length;
            const countTotal = alleL.length;

            return (
              <Card key={hw.id}>
                <CardContent className="py-4 px-4">
                  {/* Summary row */}
                  <button
                    className="w-full flex items-center gap-3 text-left"
                    onClick={() => setExpandedHwId(isExpanded ? null : hw.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{hw.titel}</p>
                        <VakBadge categorie={hw.vak.categorie as VakCategorie} />
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        {hw.deadline && <span>Deadline: {new Date(hw.deadline).toLocaleDateString("nl-NL")}</span>}
                        {hw.les && <span>Les: {new Date(hw.les.datum).toLocaleDateString("nl-NL")}</span>}
                        {hw.hasBijlage && hw.bijlageNaam && (
                          <a
                            href={`/api/bijlage/${hw.id}`}
                            download={hw.bijlageNaam}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-green-600 hover:text-green-800 transition-colors"
                          >
                            <Download className="h-3 w-3" />
                            {hw.bijlageNaam}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Progress pill */}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        countDone === countTotal && countTotal > 0
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        <Users className="h-3 w-3 inline mr-0.5" />
                        {countDone}/{countTotal}
                      </span>
                      <button
                        className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                        onClick={(e) => { e.stopPropagation(); handleDelete(hw.id); }}
                        title="Verwijderen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    </div>
                  </button>

                  {/* Expanded: per-leerling afvinken */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      {alleL.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">
                          Geen leerlingen gevonden in gekoppelde klassen.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-gray-500 uppercase mb-2">Afvinken per leerling</p>
                          {alleL.map((leerling) => {
                            const key = `${hw.id}-${leerling.id}`;
                            const isDone = afgevinkt.includes(leerling.id);
                            const isLoading = afvinkLoading[key];
                            const inlevering = hw.inleveringen.find((inv) => inv.leerling.id === leerling.id);

                            return (
                              <div key={leerling.id} className="space-y-1">
                                <div
                                  className={`flex items-center gap-3 rounded-lg px-3 py-2 border transition-colors cursor-pointer ${
                                    isDone
                                      ? "bg-green-50 border-green-200"
                                      : "bg-gray-50 border-gray-200 hover:border-green-300"
                                  }`}
                                  onClick={() => !isLoading && toggleAfvink(hw, leerling)}
                                >
                                  {isLoading ? (
                                    <Loader2 className="h-4 w-4 text-green-600 animate-spin shrink-0" />
                                  ) : isDone ? (
                                    <CheckSquare className="h-4 w-4 text-green-600 shrink-0" />
                                  ) : (
                                    <Square className="h-4 w-4 text-gray-300 shrink-0" />
                                  )}
                                  <span className={`flex-1 text-sm ${isDone ? "text-green-800 font-medium" : "text-gray-700"}`}>
                                    {leerling.name}
                                  </span>
                                  {isDone && (
                                    <span className="text-xs text-green-600">✓ afgevinkt</span>
                                  )}
                                </div>

                                {/* Opmerking for afgevinkte leerling */}
                                {isDone && inlevering && (
                                  <div className="ml-7 pl-2 border-l-2 border-green-100 space-y-1.5">
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                      <MessageSquare className="h-3 w-3" />
                                      Opmerking voor {leerling.name}
                                    </div>
                                    <div className="flex gap-2">
                                      <Textarea
                                        value={opmerkingen[inlevering.id] ?? inlevering.opmerking ?? ""}
                                        onChange={(e) => setOpmerkingen((p) => ({ ...p, [inlevering.id]: e.target.value }))}
                                        placeholder="Voeg opmerking toe (wordt gestuurd naar leerling + ouder)..."
                                        rows={2}
                                        className="text-xs flex-1"
                                      />
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={
                                          savingOpmerking[inlevering.id] ||
                                          (opmerkingen[inlevering.id] ?? "") === (inlevering.opmerking ?? "")
                                        }
                                        onClick={() => handleSaveOpmerking(inlevering.id)}
                                        className="self-end shrink-0"
                                      >
                                        {savingOpmerking[inlevering.id]
                                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          : <Save className="h-3.5 w-3.5" />
                                        }
                                      </Button>
                                    </div>
                                    {inlevering.opmerking && (
                                      <p className="text-xs text-blue-600 italic">
                                        Huidige opmerking: &ldquo;{inlevering.opmerking}&rdquo;
                                        {inlevering.opmerkingOp && ` · ${formatDate(inlevering.opmerkingOp)}`}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
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
