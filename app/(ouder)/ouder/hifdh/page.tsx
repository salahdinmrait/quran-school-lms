"use client";

import { useEffect, useState } from "react";
import { Loader2, BookOpen, CheckCircle, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSurah } from "@/lib/quran";
import { formatDate } from "@/lib/utils";
import { useLang } from "@/contexts/LanguageContext";

interface HifdhTaak {
  id: string; type: string; surahNr: number; vanAyah: number;
  totAyah: number; weekStart: string; voltooid: boolean; voltooidOp: string | null;
}

interface HifdhProfiel {
  startSurahNr: number; startAyahNr: number;
  huidigeSurahNr: number; huidigeAyahNr: number;
  ayaatPerWeek: number; opmerkingen: string | null;
  taken: HifdhTaak[];
}

interface Leerling {
  id: string; name: string;
  hifdhProfiel: HifdhProfiel | null;
}

export default function OuderHifdhPage() {
  const { t } = useLang();
  const [kinderen, setKinderen] = useState<Leerling[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetch("/api/ouder/kind")
      .then((r) => r.json())
      .then((data) => { setKinderen(Array.isArray(data) ? data : []); setIsFetching(false); })
      .catch(() => setIsFetching(false));
  }, []);

  if (isFetching) {
    return (
      <div className="p-6 flex items-center gap-2 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("laden")}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("hifdh_kind")}</h1>
        <p className="text-gray-500 mt-1 text-sm">{t("hifdh_kind_sub")}</p>
      </div>

      {kinderen.map((kind) => {
        const p = kind.hifdhProfiel;
        if (!p) {
          return (
            <div key={kind.id}>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">{kind.name}</h2>
              <Card>
                <CardContent className="py-6 text-center text-gray-400 text-sm">
                  {t("hifdh_geen_profiel")} — {kind.name}
                </CardContent>
              </Card>
            </div>
          );
        }

        const startSurah = getSurah(p.startSurahNr);
        const huidigeSurah = getSurah(p.huidigeSurahNr);
        const voltooide = p.taken.filter((tk) => tk.voltooid).length;
        const totaal = p.taken.length;

        // Group taken by week
        const weekGroups: Record<string, HifdhTaak[]> = {};
        for (const tk of p.taken) {
          const k = tk.weekStart.slice(0, 10);
          if (!weekGroups[k]) weekGroups[k] = [];
          weekGroups[k].push(tk);
        }

        return (
          <div key={kind.id} className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">{kind.name}</h2>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-green-700" />
                  {t("hifdh_huidige_positie")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{t("hifdh_start")}:</span>
                  <span className="font-medium">{startSurah?.naamAr} ({startSurah?.naam}), {t("hifdh_ayah")} {p.startAyahNr}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{t("hifdh_huidig")}:</span>
                  <span className="font-medium text-green-700">{huidigeSurah?.naamAr} ({huidigeSurah?.naam}), {t("hifdh_ayah")} {p.huidigeAyahNr}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{t("hifdh_doel")}:</span>
                  <span>{p.ayaatPerWeek} {t("hifdh_ayaat_week")}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{t("hifdh_taken_voltooid")}:</span>
                  <span className="font-medium">{voltooide} / {totaal}</span>
                </div>
                {p.opmerkingen && (
                  <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">{p.opmerkingen}</p>
                )}
              </CardContent>
            </Card>

            {/* Tasks per week (read-only) */}
            <div className="space-y-2">
              {Object.entries(weekGroups).sort(([a], [b]) => a.localeCompare(b)).map(([weekKey, taken]) => {
                const allDone = taken.every((tk) => tk.voltooid);
                const doneCount = taken.filter((tk) => tk.voltooid).length;
                return (
                  <Card key={weekKey} className={allDone ? "opacity-80" : ""}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-700">{t("hifdh_week_van")} {formatDate(weekKey)}</p>
                        <span className={`text-xs font-medium ${allDone ? "text-green-600" : "text-amber-600"}`}>
                          {doneCount}/{taken.length}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {taken.map((taak) => {
                          const surah = getSurah(taak.surahNr);
                          return (
                            <div key={taak.id} className={`flex items-center gap-2 text-sm rounded px-2 py-1 ${taak.voltooid ? "bg-green-50" : "bg-gray-50"}`}>
                              {taak.voltooid
                                ? <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                                : <Circle className="h-4 w-4 text-gray-300 shrink-0" />
                              }
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${taak.type === "NIEUW" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                                {taak.type === "NIEUW" ? t("hifdh_nieuw_label") : t("hifdh_herhaling_label")}
                              </span>
                              <span className="flex-1 text-gray-800">
                                {surah?.naamAr} ({surah?.naam}) v{taak.vanAyah}–{taak.totAyah}
                              </span>
                              {taak.voltooidOp && (
                                <span className="text-xs text-green-600 shrink-0">
                                  {formatDate(taak.voltooidOp)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
