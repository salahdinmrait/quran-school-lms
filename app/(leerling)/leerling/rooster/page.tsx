"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Calendar, Clock, BookOpen, ChevronDown, ChevronUp, Loader2, CheckCircle, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VakBadge } from "@/components/vakken/VakBadge";
import { formatDate } from "@/lib/utils";

type VakCategorie = "HIFZ" | "TAJWEED" | "ARABISCH" | "FIQH" | "SIRA" | "OVERIG";

interface Inlevering {
  id: string;
  inhoud: string;
  createdAt: string;
}

interface HuiswerkItem {
  id: string;
  titel: string;
  beschrijving: string | null;
  deadline: string | null;
  vak: { id: string; naam: string; categorie: string };
  inleveringen: Inlevering[];
}

interface Les {
  id: string;
  datum: string;
  begintijd: string;
  eindtijd: string;
  lokaal: string | null;
  klas: { id: string; naam: string };
  huiswerk: HuiswerkItem[];
}

export default function RoosterPage() {
  const [lessen, setLessen] = useState<Les[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [expandedLesId, setExpandedLesId] = useState<string | null>(null);
  // inhoud draft per huiswerk id
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/leerling/lessen")
      .then((r) => r.json())
      .then((data) => {
        setLessen(Array.isArray(data) ? data : []);
        setIsFetching(false);
      })
      .catch(() => setIsFetching(false));
  }, []);

  async function inleveren(huiswerkId: string) {
    const inhoud = drafts[huiswerkId];
    if (!inhoud?.trim()) { toast.error("Voer eerst een antwoord in."); return; }
    setSaving((p) => ({ ...p, [huiswerkId]: true }));
    try {
      const res = await fetch("/api/leerling/huiswerk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ huiswerkId, inhoud }),
      });
      if (!res.ok) throw new Error();
      toast.success("Huiswerk ingeleverd!");
      // Update local state
      setLessen((prev) =>
        prev.map((les) => ({
          ...les,
          huiswerk: les.huiswerk.map((hw) =>
            hw.id === huiswerkId
              ? {
                  ...hw,
                  inleveringen: [
                    { id: "new", inhoud, createdAt: new Date().toISOString() },
                  ],
                }
              : hw
          ),
        }))
      );
      setDrafts((p) => ({ ...p, [huiswerkId]: "" }));
    } catch {
      toast.error("Inleveren mislukt. Probeer opnieuw.");
    } finally {
      setSaving((p) => ({ ...p, [huiswerkId]: false }));
    }
  }

  // Group by date
  const grouped: Record<string, Les[]> = {};
  for (const les of lessen) {
    const key = les.datum.slice(0, 10);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(les);
  }

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
        <h1 className="text-2xl font-bold text-gray-900">Rooster</h1>
        <p className="text-gray-500 mt-1 text-sm">Klik op een les om huiswerk te bekijken en in te leveren.</p>
      </div>

      {lessen.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-400 text-sm">
            <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
            Geen lessen gepland.
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
                  const hwCount = les.huiswerk.length;
                  const openCount = les.huiswerk.filter((hw) => hw.inleveringen.length === 0).length;

                  return (
                    <Card key={les.id} className={isExpanded ? "ring-1 ring-green-300" : ""}>
                      <CardContent className="py-3 px-4">
                        {/* Les header */}
                        <button
                          className="w-full flex items-center gap-3 text-left"
                          onClick={() => setExpandedLesId(isExpanded ? null : les.id)}
                        >
                          <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                            <Clock className="h-4 w-4 text-green-700" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{les.klas.naam}</p>
                            <p className="text-xs text-gray-500">
                              {les.begintijd} – {les.eindtijd}
                              {les.lokaal && ` · Lokaal ${les.lokaal}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {hwCount > 0 && (
                              <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                                openCount > 0
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-green-100 text-green-700"
                              }`}>
                                {openCount > 0
                                  ? `${openCount} openstaand`
                                  : `${hwCount} ✓ alles ingeleverd`}
                              </span>
                            )}
                            {isExpanded
                              ? <ChevronUp className="h-4 w-4 text-gray-400" />
                              : <ChevronDown className="h-4 w-4 text-gray-400" />
                            }
                          </div>
                        </button>

                        {/* Expanded huiswerk */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                            {les.huiswerk.length === 0 ? (
                              <p className="text-sm text-gray-400 italic">
                                Geen huiswerk voor deze les.
                              </p>
                            ) : (
                              les.huiswerk.map((hw) => {
                                const isIngeleverd = hw.inleveringen.length > 0;
                                const inlevering = hw.inleveringen[0];

                                return (
                                  <div key={hw.id} className={`rounded-lg border p-3 ${isIngeleverd ? "border-green-200 bg-green-50/40" : "border-amber-200 bg-amber-50/30"}`}>
                                    <div className="flex items-start gap-2 mb-2">
                                      <BookOpen className={`h-4 w-4 mt-0.5 shrink-0 ${isIngeleverd ? "text-green-600" : "text-amber-600"}`} />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <p className="text-sm font-semibold text-gray-900">{hw.titel}</p>
                                          <VakBadge categorie={hw.vak.categorie as VakCategorie} />
                                        </div>
                                        {hw.beschrijving && (
                                          <p className="text-xs text-gray-500 mt-1">{hw.beschrijving}</p>
                                        )}
                                        {hw.deadline && (
                                          <p className="text-xs text-red-500 mt-1">
                                            Deadline: {formatDate(hw.deadline)}
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    {isIngeleverd ? (
                                      <div className="flex items-start gap-2 bg-white rounded border border-green-200 px-3 py-2">
                                        <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                                        <div>
                                          <p className="text-xs font-medium text-green-700">Ingeleverd</p>
                                          {inlevering?.inhoud && (
                                            <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-wrap">{inlevering.inhoud}</p>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        <Textarea
                                          placeholder="Schrijf hier uw antwoord…"
                                          value={drafts[hw.id] ?? ""}
                                          onChange={(e) => setDrafts((p) => ({ ...p, [hw.id]: e.target.value }))}
                                          rows={3}
                                          className="text-sm"
                                        />
                                        <Button
                                          size="sm"
                                          onClick={() => inleveren(hw.id)}
                                          disabled={saving[hw.id]}
                                          className="bg-green-700 hover:bg-green-800 text-white"
                                        >
                                          {saving[hw.id]
                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                            : <Send className="h-3.5 w-3.5 mr-1" />
                                          }
                                          Inleveren
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })
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
