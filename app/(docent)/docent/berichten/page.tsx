"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageSquare, Send, Inbox, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";

interface BerichtIn {
  id: string;
  onderwerp: string;
  inhoud: string;
  gelezen: boolean;
  createdAt: string;
  verzender: { id: string; name: string; role: string };
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
}

interface Leerling {
  id: string;
  name: string;
}

interface Klas {
  id: string;
  naam: string;
  leerlingen: { leerling: Leerling }[];
}

interface Les {
  id: string;
  klas: Klas;
}

export default function BerichtenPage() {
  const [inbox, setInbox] = useState<BerichtIn[]>([]);
  const [verzonden, setVerzonden] = useState<BerichtUit[]>([]);
  const [lessen, setLessen] = useState<Les[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [tab, setTab] = useState<"inbox" | "verzonden" | "nieuw">("inbox");
  const [sending, setSending] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    doelType: "LEERLING" as "LEERLING" | "KLAS",
    doelId: "",
    onderwerp: "",
    inhoud: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/berichten").then((r) => r.json()),
      fetch("/api/docent/lessen").then((r) => r.json()),
    ]).then(([berichtData, lesData]) => {
      setInbox(berichtData.inbox ?? []);
      setVerzonden(berichtData.verzonden ?? []);
      setLessen(Array.isArray(lesData) ? lesData : []);
      setIsFetching(false);
    }).catch(() => setIsFetching(false));
  }, []);

  // Derive unique klassen
  const klassenMap = new Map<string, Klas>();
  for (const les of lessen) {
    if (!klassenMap.has(les.klas.id)) klassenMap.set(les.klas.id, les.klas);
  }
  const klassen = Array.from(klassenMap.values());

  // Options for doelId based on doelType
  function getDoelOpties() {
    if (form.doelType === "LEERLING") {
      // All leerlingen from all klassen (deduplicated)
      const leerlingenMap = new Map<string, Leerling>();
      for (const klas of klassen) {
        for (const { leerling } of klas.leerlingen) {
          leerlingenMap.set(leerling.id, leerling);
        }
      }
      return Array.from(leerlingenMap.values()).map((l) => ({ id: l.id, label: l.name }));
    }
    if (form.doelType === "KLAS") {
      return klassen.map((k) => ({ id: k.id, label: k.naam }));
    }
    return [];
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "doelType") next.doelId = "";
      return next;
    });
  };

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!form.doelId || !form.onderwerp || !form.inhoud) {
      toast.error("Vul alle velden in.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/berichten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doelType: form.doelType,
          doelId: form.doelId,
          onderwerp: form.onderwerp,
          inhoud: form.inhoud,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Bericht verstuurd naar ${data.count} ontvanger${data.count !== 1 ? "s" : ""}.`);
      setForm({ doelType: "LEERLING", doelId: "", onderwerp: "", inhoud: "" });
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
    } catch {
      // silent
    }
  }

  const ongelezen = inbox.filter((b) => !b.gelezen).length;

  if (isFetching) {
    return (
      <div className="p-6 flex items-center gap-2 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Laden…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Berichten</h1>
        <p className="text-gray-500 mt-1 text-sm">Berichten sturen en ontvangen.</p>
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
              tab === key
                ? "border-green-700 text-green-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Inbox */}
      {tab === "inbox" && (
        <div className="space-y-2">
          {inbox.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-gray-400 text-sm">
                Geen berichten in uw inbox.
              </CardContent>
            </Card>
          ) : (
            inbox.map((b) => (
              <Card key={b.id} className={b.gelezen ? "opacity-70" : ""}>
                <CardContent className="py-3 px-4">
                  <button
                    className="w-full text-left"
                    onClick={() => {
                      setExpandedId(expandedId === b.id ? null : b.id);
                      if (!b.gelezen) markRead(b.id);
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {!b.gelezen && (
                          <span className="w-2 h-2 rounded-full bg-green-600 shrink-0" />
                        )}
                        <p className={`text-sm truncate ${!b.gelezen ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                          {b.onderwerp}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-400">{formatDate(b.createdAt)}</span>
                        <span className="text-xs text-gray-500">{b.verzender.name}</span>
                        {expandedId === b.id
                          ? <ChevronUp className="h-4 w-4 text-gray-400" />
                          : <ChevronDown className="h-4 w-4 text-gray-400" />
                        }
                      </div>
                    </div>
                  </button>
                  {expandedId === b.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{b.inhoud}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Verzonden */}
      {tab === "verzonden" && (
        <div className="space-y-2">
          {verzonden.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-gray-400 text-sm">
                Geen verzonden berichten.
              </CardContent>
            </Card>
          ) : (
            verzonden.map((b) => (
              <Card key={b.id}>
                <CardContent className="py-3 px-4">
                  <button
                    className="w-full text-left"
                    onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-700 truncate">{b.onderwerp}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-400">{formatDate(b.createdAt)}</span>
                        <span className="text-xs text-gray-500">
                          → {b.doelLabel ?? b.ontvanger?.name ?? "onbekend"}
                          {b.aantalOntvangers > 1 && (
                            <span className="ml-1 bg-gray-100 rounded-full px-1.5 py-0.5 text-gray-600">
                              {b.aantalOntvangers}×
                            </span>
                          )}
                        </span>
                        {expandedId === b.id
                          ? <ChevronUp className="h-4 w-4 text-gray-400" />
                          : <ChevronDown className="h-4 w-4 text-gray-400" />
                        }
                      </div>
                    </div>
                  </button>
                  {expandedId === b.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{b.inhoud}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
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
            {klassen.length === 0 ? (
              <p className="text-sm text-gray-500">
                U bent nog niet aan een klas gekoppeld. Neem contact op met de beheerder.
              </p>
            ) : (
              <form onSubmit={handleSend} className="space-y-4">
                {/* Doel type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sturen naar
                  </label>
                  <div className="flex gap-2">
                    {(["LEERLING", "KLAS"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, doelType: t, doelId: "" }))}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                          form.doelType === t
                            ? "bg-green-700 text-white border-green-700"
                            : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        {t === "LEERLING" ? "Specifieke leerling" : "Hele klas"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Doel */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {form.doelType === "LEERLING" ? "Leerling" : "Klas"}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="doelId"
                    value={form.doelId}
                    onChange={handleChange}
                    required
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">— Selecteer —</option>
                    {getDoelOpties().map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* Onderwerp */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Onderwerp <span className="text-red-500">*</span>
                  </label>
                  <Input
                    name="onderwerp"
                    value={form.onderwerp}
                    onChange={handleChange}
                    placeholder="bijv. Huiswerk week 5"
                    required
                  />
                </div>

                {/* Inhoud */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bericht <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    name="inhoud"
                    value={form.inhoud}
                    onChange={handleChange}
                    placeholder="Schrijf uw bericht hier…"
                    rows={5}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={sending}
                  className="bg-green-700 hover:bg-green-800 text-white"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  Versturen
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
