"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserCheck, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

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
  datum: string;
  begintijd: string;
  eindtijd: string;
  lokaal: string | null;
  klas: Klas;
}

interface AanwezigheidRecord {
  id: string;
  leerlingId: string;
  status: string;
}

const STATUSSEN = [
  { value: "AANWEZIG", label: "Aanwezig", kleur: "bg-green-100 text-green-700 border-green-300" },
  { value: "AFWEZIG", label: "Afwezig", kleur: "bg-red-100 text-red-700 border-red-300" },
  { value: "TE_LAAT", label: "Te laat", kleur: "bg-amber-100 text-amber-700 border-amber-300" },
  { value: "GEOORLOOFD", label: "Geoorloofd", kleur: "bg-blue-100 text-blue-700 border-blue-300" },
];

export default function AbsentiePage() {
  const [lessen, setLessen] = useState<Les[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [selectedLesId, setSelectedLesId] = useState("");
  const [aanwezigheid, setAanwezigheid] = useState<AanwezigheidRecord[]>([]);
  const [loadingLes, setLoadingLes] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/docent/lessen")
      .then((r) => r.json())
      .then((data) => {
        setLessen(Array.isArray(data) ? data : []);
        setIsFetching(false);
      })
      .catch(() => setIsFetching(false));
  }, []);

  async function loadAanwezigheid(lesId: string) {
    setSelectedLesId(lesId);
    if (!lesId) {
      setAanwezigheid([]);
      return;
    }
    setLoadingLes(true);
    try {
      const res = await fetch(`/api/docent/absentie?lesId=${lesId}`);
      const data = await res.json();
      setAanwezigheid(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Kon aanwezigheid niet laden.");
    } finally {
      setLoadingLes(false);
    }
  }

  async function registreer(leerlingId: string, status: string) {
    setSavingId(leerlingId);
    try {
      const res = await fetch("/api/docent/absentie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesId: selectedLesId, leerlingId, status }),
      });
      if (!res.ok) throw new Error();
      const record = await res.json();
      // Update local state
      setAanwezigheid((prev) => {
        const exists = prev.find((a) => a.leerlingId === leerlingId);
        if (exists) return prev.map((a) => a.leerlingId === leerlingId ? record : a);
        return [...prev, record];
      });
      toast.success("Opgeslagen.");
    } catch {
      toast.error("Opslaan mislukt.");
    } finally {
      setSavingId(null);
    }
  }

  const selectedLes = lessen.find((l) => l.id === selectedLesId);
  const leerlingen = selectedLes?.klas.leerlingen.map((kl) => kl.leerling) ?? [];

  function getStatus(leerlingId: string): string {
    return aanwezigheid.find((a) => a.leerlingId === leerlingId)?.status ?? "";
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
        <h1 className="text-2xl font-bold text-gray-900">Absentie registreren</h1>
        <p className="text-gray-500 mt-1 text-sm">Selecteer een les en registreer de aanwezigheid.</p>
      </div>

      {/* Les selectie */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base text-gray-900">Les selecteren</CardTitle>
        </CardHeader>
        <CardContent>
          {lessen.length === 0 ? (
            <p className="text-sm text-gray-500">
              Geen lessen gevonden. Vraag de beheerder om lessen aan te maken.
            </p>
          ) : (
            <select
              value={selectedLesId}
              onChange={(e) => loadAanwezigheid(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">— Selecteer een les —</option>
              {lessen.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.klas.naam} · {formatDate(l.datum)} · {l.begintijd}–{l.eindtijd}
                  {l.lokaal ? ` · Lokaal ${l.lokaal}` : ""}
                </option>
              ))}
            </select>
          )}
        </CardContent>
      </Card>

      {/* Aanwezigheid registratie */}
      {selectedLesId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <UserCheck className="h-5 w-5 text-green-700" />
              {selectedLes?.klas.naam} — {selectedLes && formatDate(selectedLes.datum)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingLes ? (
              <div className="flex items-center gap-2 text-gray-500 py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Laden…
              </div>
            ) : leerlingen.length === 0 ? (
              <p className="text-sm text-gray-500">
                Geen leerlingen ingeschreven in deze klas.
              </p>
            ) : (
              <div className="space-y-3">
                {leerlingen.map((leerling) => {
                  const huidigeStatus = getStatus(leerling.id);
                  const isSaving = savingId === leerling.id;
                  return (
                    <div key={leerling.id} className="flex items-center gap-3 flex-wrap">
                      <div className="w-36 shrink-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{leerling.name}</p>
                      </div>
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      ) : (
                        <div className="flex gap-2 flex-wrap">
                          {STATUSSEN.map((s) => (
                            <button
                              key={s.value}
                              onClick={() => registreer(leerling.id, s.value)}
                              className={`
                                px-3 py-1 rounded-full text-xs font-medium border transition-all
                                ${huidigeStatus === s.value
                                  ? `${s.kleur} ring-2 ring-offset-1 ring-current`
                                  : "bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300"
                                }
                              `}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
