"use client";

import { useEffect, useState } from "react";
import { BookOpen, CheckCircle, Circle, Loader2, ChevronDown, ChevronUp, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SURAHS, getSurah } from "@/lib/quran";
import { useLang } from "@/contexts/LanguageContext";

interface HifdhTaak {
  id: string;
  type: string;
  surahNr: number;
  vanAyah: number;
  totAyah: number;
  weekStart: string;
  voltooid: boolean;
  voltooidOp: string | null;
}

interface HifdhProfiel {
  id: string;
  startSurahNr: number;
  startAyahNr: number;
  huidigeSurahNr: number;
  huidigeAyahNr: number;
  ayaatPerWeek: number;
  opmerkingen: string | null;
  taken: HifdhTaak[];
}

function weekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  return `${d.getDate()} ${d.toLocaleDateString("nl-NL", { month: "short" })} – ${end.getDate()} ${end.toLocaleDateString("nl-NL", { month: "short", year: "numeric" })}`;
}

function getMondayOfDate(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export default function LeerlingHifdhPage() {
  const { t } = useLang();
  const [profiel, setProfiel] = useState<HifdhProfiel | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState(false);

  useEffect(() => {
    fetch("/api/leerling/hifdh")
      .then((r) => r.json())
      .then((data) => { setProfiel(data); setIsFetching(false); })
      .catch(() => setIsFetching(false));
  }, []);

  const weekGroups: Record<string, HifdhTaak[]> = {};
  for (const taak of profiel?.taken ?? []) {
    const key = taak.weekStart.slice(0, 10);
    if (!weekGroups[key]) weekGroups[key] = [];
    weekGroups[key].push(taak);
  }

  const thisMonday = getMondayOfDate(new Date()).toISOString().slice(0, 10);

  useEffect(() => {
    if (weekGroups[thisMonday] && !expandedWeek) {
      setExpandedWeek(thisMonday);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiel]);

  function getSurahStatus(surahNr: number): "voltooid" | "bezig" | "open" {
    if (!profiel) return "open";
    if (profiel.startSurahNr >= surahNr && surahNr > profiel.huidigeSurahNr) return "voltooid";
    if (surahNr === profiel.huidigeSurahNr) return "bezig";
    return "open";
  }

  const totalTaken = profiel?.taken.length ?? 0;
  const voltooide = profiel?.taken.filter((t) => t.voltooid).length ?? 0;
  const niuweTaken = profiel?.taken.filter((t) => t.type === "NIEUW") ?? [];
  const herhalingTaken = profiel?.taken.filter((t) => t.type === "HERHALING") ?? [];

  if (isFetching) {
    return (
      <div className="p-6 flex items-center gap-2 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("laden")}
      </div>
    );
  }

  if (!profiel) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{t("hifdh_titel")}</h1>
          <p className="text-gray-500 mt-1 text-sm">{t("hifdh_subtitel")}</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">{t("hifdh_geen_profiel")}</p>
            <p className="text-gray-400 text-sm mt-1">{t("hifdh_geen_profiel_sub")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const startSurah = getSurah(profiel.startSurahNr);
  const huidigeSurah = getSurah(profiel.huidigeSurahNr);

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("hifdh_titel")}</h1>
        <p className="text-gray-500 mt-1 text-sm">{t("hifdh_subtitel")}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{voltooide}</p>
          <p className="text-xs text-green-600 mt-0.5">{t("hifdh_taken_voltooid")}</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{totalTaken - voltooide}</p>
          <p className="text-xs text-amber-600 mt-0.5">{t("hifdh_openstaand")}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{niuweTaken.length}</p>
          <p className="text-xs text-blue-600 mt-0.5">{t("hifdh_nieuw")}</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-purple-700">{herhalingTaken.length}</p>
          <p className="text-xs text-purple-600 mt-0.5">{t("hifdh_herhaling")}</p>
        </div>
      </div>

      {/* Current position */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-gray-900">{t("hifdh_huidige_positie")}</CardTitle>
            <button
              onClick={() => setShowProgress((v) => !v)}
              className="text-xs text-green-700 hover:underline flex items-center gap-1"
            >
              {showProgress ? t("hifdh_verberg") : t("hifdh_toon_surahs")}
              {showProgress ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500">{t("hifdh_start")}</p>
              <p className="font-medium text-gray-800">{startSurah?.naamAr} ({startSurah?.naam})</p>
            </div>
            <div className="flex-1 border-t-2 border-dashed border-gray-200" />
            <div className="text-right">
              <p className="text-xs text-gray-500">{t("hifdh_huidig")}</p>
              <p className="font-medium text-green-700">{huidigeSurah?.naamAr} ({huidigeSurah?.naam})</p>
              <p className="text-xs text-gray-500">{t("hifdh_ayah")} {profiel.huidigeAyahNr}</p>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {t("hifdh_doel")}: {profiel.ayaatPerWeek} {t("hifdh_ayaat_week")}
            {profiel.opmerkingen && <span className="ml-2 text-amber-600 italic">· {profiel.opmerkingen}</span>}
          </div>

          {showProgress && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-600 mb-2">{t("hifdh_juz30")}</p>
              <div className="flex flex-wrap gap-1.5">
                {SURAHS.filter((s) => s.juz === 30).reverse().map((surah) => {
                  const status = getSurahStatus(surah.nr);
                  return (
                    <div
                      key={surah.nr}
                      title={`${surah.naamAr} (${surah.naam}) — ${surah.ayaat} ayaat`}
                      className={`rounded px-2 py-1 text-xs font-medium border cursor-default ${
                        status === "voltooid"
                          ? "bg-green-100 border-green-300 text-green-800"
                          : status === "bezig"
                          ? "bg-amber-100 border-amber-300 text-amber-800 ring-1 ring-amber-400"
                          : "bg-gray-50 border-gray-200 text-gray-500"
                      }`}
                    >
                      {status === "voltooid" && <Star className="h-2.5 w-2.5 inline mr-0.5 text-green-600" />}
                      {surah.naam.split("-")[1] ?? surah.naam}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly tasks — read-only */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t("hifdh_weekelijkse_taken")}</h2>
          <p className="text-xs text-gray-400 italic">{t("hifdh_docent_afvinkt")}</p>
        </div>

        {Object.keys(weekGroups).length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-400 text-sm">
              {t("hifdh_geen_taken")}
            </CardContent>
          </Card>
        ) : (
          Object.entries(weekGroups).sort(([a], [b]) => a.localeCompare(b)).map(([weekKey, taken]) => {
            const isExpanded = expandedWeek === weekKey;
            const isHuidigeWeek = weekKey === thisMonday;
            const allDone = taken.every((t) => t.voltooid);
            const doneCount = taken.filter((t) => t.voltooid).length;

            return (
              <Card
                key={weekKey}
                className={`${isHuidigeWeek ? "ring-2 ring-green-400" : ""} ${allDone ? "opacity-80" : ""}`}
              >
                <CardContent className="py-3 px-4">
                  <button
                    className="w-full flex items-center justify-between gap-3 text-left"
                    onClick={() => setExpandedWeek(isExpanded ? null : weekKey)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {allDone
                        ? <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                        : <Circle className="h-4 w-4 text-gray-300 shrink-0" />
                      }
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{weekLabel(weekKey)}</p>
                        {isHuidigeWeek && (
                          <span className="text-xs bg-green-100 text-green-700 rounded-full px-1.5 py-0.5">
                            {t("hifdh_deze_week")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-medium ${allDone ? "text-green-600" : "text-amber-600"}`}>
                        {doneCount}/{taken.length}
                      </span>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                      {taken.map((taak) => {
                        const surah = getSurah(taak.surahNr);
                        return (
                          <div
                            key={taak.id}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border ${
                              taak.voltooid ? "bg-green-50 border-green-200" : "bg-white border-gray-200"
                            }`}
                          >
                            {taak.voltooid
                              ? <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                              : <Circle className="h-5 w-5 text-gray-300 shrink-0" />
                            }
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs rounded px-1.5 py-0.5 font-medium ${
                                  taak.type === "NIEUW" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                                }`}>
                                  {taak.type === "NIEUW" ? t("hifdh_nieuw_label") : t("hifdh_herhaling_label")}
                                </span>
                                <p className={`text-sm font-medium ${taak.voltooid ? "text-green-700 line-through" : "text-gray-900"}`}>
                                  {surah?.naamAr} ({surah?.naam})
                                </p>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {t("hifdh_ayah")} {taak.vanAyah} – {taak.totAyah} · {taak.totAyah - taak.vanAyah + 1} {t("hifdh_ayaat_week").split("/")[0]}
                              </p>
                            </div>
                            {taak.voltooid && taak.voltooidOp && (
                              <p className="text-xs text-green-600 shrink-0">
                                ✓ {new Date(taak.voltooidOp).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
