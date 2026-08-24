"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PersonenZoeker } from "@/components/PersonenZoeker";
import { MessageSquare, Send, Inbox, ChevronDown, ChevronUp, Loader2, CornerDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";

interface ThreadMessage {
  id: string;
  onderwerp: string;
  inhoud: string;
  createdAt: string;
  verzender: { id: string; name: string; role: string };
}

interface BerichtIn {
  id: string;
  onderwerp: string;
  inhoud: string;
  gelezen: boolean;
  createdAt: string;
  verzender: { id: string; name: string; role: string };
  replies: ThreadMessage[];
  replyTo: ThreadMessage | null;
}

interface BerichtUit {
  id: string;
  groepId: string | null;
  onderwerp: string;
  inhoud: string;
  createdAt: string;
  doelLabel: string | null;
  aantalOntvangers: number;
  ontvanger: { id: string; name: string; role: string } | null;
  replies: ThreadMessage[];
}

interface Persoon { id: string; name: string; email?: string; kindNaam?: string; }
interface Klas {
  id: string;
  naam: string;
  leerlingen: Persoon[];
  ouders: Persoon[];
}

type DoelType = "LEERLINGEN" | "KLAS_LEERLINGEN" | "OUDERS" | "KLAS_OUDERS" | "DOCENTEN";

export default function AdminBerichtenPage() {
  const [inbox, setInbox] = useState<BerichtIn[]>([]);
  const [verzonden, setVerzonden] = useState<BerichtUit[]>([]);
  const [klassen, setKlassen] = useState<Klas[]>([]);
  const [docenten, setDocenten] = useState<Persoon[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [tab, setTab] = useState<"inbox" | "verzonden" | "nieuw">("inbox");
  const [sending, setSending] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [doelType, setDoelType] = useState<DoelType>("LEERLINGEN");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedKlasId, setSelectedKlasId] = useState("");
  const [onderwerp, setOnderwerp] = useState("");
  const [inhoud, setInhoud] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/berichten").then((r) => r.json()),
      fetch("/api/admin/berichten-data").then((r) => r.json()),
    ]).then(([berichtData, klasData]) => {
      setInbox(berichtData.inbox ?? []);
      setVerzonden(berichtData.verzonden ?? []);
      // Nieuw formaat: { klassen, docenten } — oud formaat was een array
      setKlassen(Array.isArray(klasData) ? klasData : klasData?.klassen ?? []);
      setDocenten(Array.isArray(klasData) ? [] : klasData?.docenten ?? []);
      setIsFetching(false);
    }).catch(() => setIsFetching(false));
  }, []);

  function getAllPersonen(type: "leerlingen" | "ouders"): Persoon[] {
    const map = new Map<string, Persoon>();
    for (const klas of klassen) {
      for (const p of klas[type]) {
        if (!map.has(p.id)) map.set(p.id, p);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  const allePersonen =
    doelType === "LEERLINGEN" ? getAllPersonen("leerlingen") :
    doelType === "OUDERS" ? getAllPersonen("ouders") :
    doelType === "DOCENTEN" ? docenten : [];

  function deselectAll() { setSelectedIds([]); }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const isKlasBroadcast = doelType === "KLAS_LEERLINGEN" || doelType === "KLAS_OUDERS";
    if (!onderwerp || !inhoud) { toast.error("Vul onderwerp en bericht in."); return; }
    if (isKlasBroadcast && !selectedKlasId) { toast.error("Selecteer een klas."); return; }
    if (!isKlasBroadcast && selectedIds.length === 0) { toast.error("Selecteer minimaal één ontvanger."); return; }

    setSending(true);
    try {
      const body = isKlasBroadcast
        ? { doelType: doelType === "KLAS_LEERLINGEN" ? "KLAS_LEERLINGEN" : "KLAS_OUDERS", doelId: selectedKlasId, onderwerp, inhoud }
        : { doelType: "GEBRUIKERS", doelIds: selectedIds, onderwerp, inhoud };

      const res = await fetch("/api/berichten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Bericht verstuurd naar ${data.count} ontvanger${data.count !== 1 ? "s" : ""}.`);
      setSelectedIds([]);
      setSelectedKlasId("");
      setOnderwerp("");
      setInhoud("");
      setTab("inbox");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Versturen mislukt.");
    } finally {
      setSending(false);
    }
  }

  async function markRead(id: string) {
    try {
      await fetch(`/api/berichten/${id}`, { method: "PUT" });
      setInbox((prev) => prev.map((b) => b.id === id ? { ...b, gelezen: true } : b));
    } catch { /* silent */ }
  }

  const ongelezen = inbox.filter((b) => !b.gelezen).length;

  if (isFetching) {
    return (
      <div className="p-6 flex items-center gap-2 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Laden…
      </div>
    );
  }

  const doelTypeOptions: { value: DoelType; label: string }[] = [
    { value: "LEERLINGEN", label: "Specifieke leerling(en)" },
    { value: "KLAS_LEERLINGEN", label: "Hele klas (leerlingen)" },
    { value: "OUDERS", label: "Specifieke ouder(s)" },
    { value: "KLAS_OUDERS", label: "Alle ouders van een klas" },
    { value: "DOCENTEN", label: "Specifieke docent(en)" },
  ];

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Berichten</h1>
        <p className="text-gray-500 mt-1 text-sm">Berichten sturen naar leerlingen en ouders.</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { key: "inbox", label: `Inbox${ongelezen > 0 ? ` (${ongelezen})` : ""}`, icon: Inbox },
          { key: "verzonden", label: "Verzonden", icon: Send },
          { key: "nieuw", label: "Nieuw bericht", icon: MessageSquare },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? "border-green-700 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Inbox ──────────────────────────────────────────────────────────── */}
      {tab === "inbox" && (
        <div className="space-y-2">
          {inbox.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-gray-400 text-sm">Geen berichten in uw inbox.</CardContent></Card>
          ) : (
            inbox.map((b) => {
              const isExpanded = expandedId === b.id;
              return (
                <Card key={b.id} className={b.gelezen ? "opacity-70" : ""}>
                  <CardContent className="py-3 px-4">
                    <button className="w-full text-left" onClick={() => { setExpandedId(isExpanded ? null : b.id); if (!b.gelezen) markRead(b.id); }}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {!b.gelezen && <span className="w-2 h-2 rounded-full bg-green-600 shrink-0" />}
                          <p className={`text-sm truncate ${!b.gelezen ? "font-semibold text-gray-900" : "text-gray-700"}`}>{b.onderwerp}</p>
                          {b.replyTo && (
                            <span className="shrink-0 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-full px-1.5 py-0.5">
                              antwoord
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-gray-400">{formatDate(b.createdAt)}</span>
                          <span className="text-xs text-gray-500">{b.verzender.name}</span>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                        </div>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-4">
                        {/* Original message context if this is a reply */}
                        {b.replyTo && (
                          <div className="bg-gray-50 rounded-md px-3 py-2.5 border border-gray-200">
                            <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                              <CornerDownRight className="h-3 w-3" />
                              Origineel bericht van <span className="font-medium text-gray-600">{b.replyTo.verzender.name}</span>
                              {" · "}{formatDate(b.replyTo.createdAt)}
                            </p>
                            <p className="text-xs font-medium text-gray-600 mb-1">{b.replyTo.onderwerp}</p>
                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{b.replyTo.inhoud}</p>
                          </div>
                        )}
                        {/* The inbox message */}
                        <div className={b.replyTo ? "ml-4 pl-3 border-l-2 border-blue-300" : ""}>
                          <p className="text-xs text-gray-400 mb-1.5">
                            <span className="font-medium text-gray-700">{b.verzender.name}</span>
                            {" · "}{formatDate(b.createdAt)}
                          </p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{b.inhoud}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ── Verzonden ──────────────────────────────────────────────────────── */}
      {tab === "verzonden" && (
        <div className="space-y-2">
          {verzonden.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-gray-400 text-sm">Geen verzonden berichten.</CardContent></Card>
          ) : (
            verzonden.map((b) => {
              const isExpanded = expandedId === b.id;
              const hasReplies = b.replies.length > 0;
              return (
                <Card key={b.id} className={hasReplies ? "border-blue-200" : ""}>
                  <CardContent className="py-3 px-4">
                    <button className="w-full text-left" onClick={() => setExpandedId(isExpanded ? null : b.id)}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate">{b.onderwerp}</p>
                          {hasReplies && (
                            <span className="shrink-0 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-full px-1.5 py-0.5 font-medium">
                              {b.replies.length} antwoord{b.replies.length !== 1 ? "en" : ""}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-gray-400">{formatDate(b.createdAt)}</span>
                          <span className="text-xs text-gray-500">
                            → {b.doelLabel ?? b.ontvanger?.name ?? "onbekend"}
                            {b.aantalOntvangers > 1 && (
                              <span className="ml-1 bg-gray-100 rounded-full px-1.5 py-0.5 text-gray-600">{b.aantalOntvangers}×</span>
                            )}
                          </span>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                        </div>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-4">
                        {/* The sent message */}
                        <div>
                          <p className="text-xs text-gray-400 mb-1.5">
                            <span className="font-medium text-gray-600">U</span>
                            {" · "}{formatDate(b.createdAt)}
                            {" · "}→ {b.doelLabel ?? b.ontvanger?.name ?? "onbekend"}
                          </p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{b.inhoud}</p>
                        </div>
                        {/* Replies received */}
                        {b.replies.map((reply) => (
                          <div key={reply.id} className="ml-4 pl-3 border-l-2 border-blue-300">
                            <p className="text-xs text-gray-400 mb-1.5">
                              <span className="font-medium text-blue-700">{reply.verzender.name}</span>
                              {" · "}{formatDate(reply.createdAt)}
                            </p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{reply.inhoud}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Nieuw bericht */}
      {tab === "nieuw" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-gray-900">Bericht versturen</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSend} className="space-y-4">
              {/* Doel type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sturen naar</label>
                <div className="grid grid-cols-2 gap-2">
                  {doelTypeOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setDoelType(opt.value); setSelectedIds([]); setSelectedKlasId(""); }}
                      className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors text-left ${
                        doelType === opt.value
                          ? "bg-green-700 text-white border-green-700"
                          : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Klas selector */}
              {(doelType === "KLAS_LEERLINGEN" || doelType === "KLAS_OUDERS") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Klas <span className="text-red-500">*</span></label>
                  <select
                    value={selectedKlasId}
                    onChange={(e) => setSelectedKlasId(e.target.value)}
                    required
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">— Selecteer klas —</option>
                    {klassen.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.naam}
                        {doelType === "KLAS_OUDERS" && ` (${k.ouders.length} ouder${k.ouders.length !== 1 ? "s" : ""})`}
                        {doelType === "KLAS_LEERLINGEN" && ` (${k.leerlingen.length} leerling${k.leerlingen.length !== 1 ? "en" : ""})`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Multi-select personen */}
              {(doelType === "LEERLINGEN" || doelType === "OUDERS" || doelType === "DOCENTEN") && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      {doelType === "LEERLINGEN" ? "Leerling(en)" : doelType === "OUDERS" ? "Ouder(s)" : "Docent(en)"}
                      <span className="text-red-500 ml-0.5">*</span>
                      {selectedIds.length > 0 && (
                        <span className="ml-2 text-green-700 font-normal">({selectedIds.length} geselecteerd)</span>
                      )}
                    </label>
                    {selectedIds.length > 0 && (
                      <button type="button" onClick={deselectAll} className="text-xs text-gray-400 hover:underline">Selectie wissen</button>
                    )}
                  </div>
                  <PersonenZoeker
                    personen={allePersonen.map((p) => ({
                      id: p.id,
                      name: p.name,
                      email: p.email,
                      extra: p.kindNaam ? `kind: ${p.kindNaam}` : undefined,
                    }))}
                    selectedIds={selectedIds}
                    onChange={setSelectedIds}
                    leegMelding={
                      doelType === "OUDERS"
                        ? "Geen ouders gevonden (koppel ouders aan leerlingen)."
                        : doelType === "DOCENTEN"
                        ? "Geen docenten gevonden."
                        : "Geen leerlingen gevonden."
                    }
                  />
                </div>
              )}

              {/* Onderwerp */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Onderwerp <span className="text-red-500">*</span></label>
                <Input value={onderwerp} onChange={(e) => setOnderwerp(e.target.value)} placeholder="bijv. Aankondiging schoolavond" required />
              </div>

              {/* Inhoud */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bericht <span className="text-red-500">*</span></label>
                <Textarea value={inhoud} onChange={(e) => setInhoud(e.target.value)} placeholder="Schrijf uw bericht hier…" rows={5} required />
              </div>

              <Button type="submit" disabled={sending} className="bg-green-700 hover:bg-green-800 text-white">
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Versturen
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
