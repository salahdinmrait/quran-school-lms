"use client";

import { useEffect, useState } from "react";
import { Loader2, Clock, Calendar, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

interface HuiswerkItem {
  id: string; titel: string;
  inleveringen: { leerlingId: string }[];
}

interface Les {
  id: string; datum: string; begintijd: string; eindtijd: string;
  lokaal: string | null;
  klas: { naam: string };
  vak: { naam: string } | null;
  huiswerk: HuiswerkItem[];
}

interface Klas {
  lessen: Les[];
}

interface Leerling {
  id: string; name: string;
  leerlingKlassen: { klas: Klas }[];
}

export default function OuderRoosterPage() {
  const [kinderen, setKinderen] = useState<Leerling[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetch("/api/ouder/kind")
      .then((r) => r.json())
      .then((data) => { setKinderen(Array.isArray(data) ? data : []); setIsFetching(false); })
      .catch(() => setIsFetching(false));
  }, []);

  if (isFetching) {
    return <div className="p-6 flex items-center gap-2 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Laden…</div>;
  }

  const now = new Date();

  return (
    <div className="p-6 max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Aankomende lessen</h1>
        <p className="text-gray-500 mt-1 text-sm">Komende lessen van uw kind.</p>
      </div>

      {kinderen.map((kind) => {
        const alleLessen: Les[] = [];
        for (const { klas } of kind.leerlingKlassen) {
          for (const les of klas.lessen) {
            alleLessen.push(les);
          }
        }

        // Filter upcoming (today onwards) and sort
        const upcoming = alleLessen
          .filter((l) => new Date(l.datum) >= new Date(now.toDateString()))
          .sort((a, b) => a.datum.localeCompare(b.datum) || a.begintijd.localeCompare(b.begintijd))
          .slice(0, 20);

        // Group by date
        const grouped: Record<string, Les[]> = {};
        for (const les of upcoming) {
          const key = les.datum.slice(0, 10);
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(les);
        }

        return (
          <div key={kind.id} className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">{kind.name}</h2>

            {upcoming.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-400 text-sm">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Geen aankomende lessen gevonden.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {Object.entries(grouped).map(([date, lessen]) => (
                  <div key={date}>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      {formatDate(date)}
                    </h3>
                    <div className="space-y-2">
                      {lessen.map((les) => {
                        const openHw = les.huiswerk.filter(
                          (hw) => !hw.inleveringen.some((inv) => inv.leerlingId === kind.id)
                        ).length;
                        return (
                          <Card key={les.id}>
                            <CardContent className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                                  <Clock className="h-4 w-4 text-green-700" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900">
                                    {les.klas.naam}{les.vak && ` — ${les.vak.naam}`}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {les.begintijd} – {les.eindtijd}
                                    {les.lokaal && ` · Lokaal ${les.lokaal}`}
                                  </p>
                                </div>
                                {openHw > 0 && (
                                  <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 shrink-0">
                                    <BookOpen className="h-3 w-3" />
                                    {openHw} hw open
                                  </span>
                                )}
                              </div>
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
      })}
    </div>
  );
}
