"use client";

import { useEffect, useState } from "react";
import { Loader2, Clock, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { useLang } from "@/contexts/LanguageContext";

interface Les {
  id: string; datum: string; begintijd: string; eindtijd: string;
  lokaal: string | null;
  klas: { naam: string };
  vak: { naam: string } | null;
  aanwezigheid: { status: string }[];
}

interface KindLessen {
  kind: { id: string; name: string };
  lessen: Les[];
}

const statusKleur: Record<string, string> = {
  AANWEZIG:    "bg-green-100 text-green-700",
  AFWEZIG:     "bg-red-100 text-red-700",
  TE_LAAT:     "bg-amber-100 text-amber-700",
  GEOORLOOFD:  "bg-blue-100 text-blue-700",
};

export default function OuderRoosterPage() {
  const { t } = useLang();
  const [data, setData] = useState<KindLessen[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetch("/api/ouder/lessen")
      .then((r) => r.json())
      .then((d) => { setData(Array.isArray(d) ? d : []); setIsFetching(false); })
      .catch(() => setIsFetching(false));
  }, []);

  if (isFetching) {
    return (
      <div className="p-6 flex items-center gap-2 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("laden")}
      </div>
    );
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return (
    <div className="p-6 max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("rooster_aankomend")}</h1>
        <p className="text-gray-500 mt-1 text-sm">{t("rooster_aankomend_sub")}</p>
      </div>

      {data.map(({ kind, lessen }) => {
        const upcoming = lessen
          .filter((l) => new Date(l.datum) >= now)
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
                  {t("rooster_geen_aankomend")}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {Object.entries(grouped).map(([date, dagLessen]) => (
                  <div key={date}>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      {formatDate(date)}
                    </h3>
                    <div className="space-y-2">
                      {dagLessen.map((les) => {
                        const aanw = les.aanwezigheid[0];
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
                                    {les.lokaal && ` · ${t("rooster_lokaal")} ${les.lokaal}`}
                                  </p>
                                </div>
                                {aanw && (
                                  <span className={`text-xs rounded-full px-2 py-0.5 font-medium shrink-0 ${statusKleur[aanw.status] ?? ""}`}>
                                    {t(`status_${aanw.status.toLowerCase()}` as Parameters<typeof t>[0]) ?? aanw.status}
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
