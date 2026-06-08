"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VakBadge } from "@/components/vakken/VakBadge";
import { formatDate } from "@/lib/utils";
import { Loader2, CheckCircle, Clock, Trophy, MessageSquare, Download } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";

type VakCategorie = "HIFZ" | "TAJWEED" | "ARABISCH" | "FIQH" | "SIRA" | "OVERIG";

interface HuiswerkItem {
  id: string;
  titel: string;
  beschrijving: string | null;
  deadline: string | null;
  bijlageNaam: string | null;
  hasBijlage: boolean;
  vak: { naam: string; categorie: VakCategorie };
  ingeLeverd: boolean;
  inlevering?: {
    inhoud: string;
    createdAt: string;
    opmerking: string | null;
    opmerkingOp: string | null;
  };
}

interface RankingItem {
  positie: number;
  leerling: { id: string; name: string };
  aantalIngeleverd: number;
  totaal: number;
  percentage: number;
}
interface KlasRanking {
  klasId: string;
  klasNaam: string;
  top3: RankingItem[];
  totaalHw: number;
  eigenPositie: number | null;
  eigenPercentage: number;
  aantalLeerlingen: number;
}

const MEDAL = ["🥇", "🥈", "🥉"];

export default function HuiswerkPage() {
  const { t } = useLang();
  const [huiswerk, setHuiswerk] = useState<HuiswerkItem[]>([]);
  const [rankings, setRankings] = useState<KlasRanking[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/leerling/huiswerk").then((r) => r.json()),
      fetch("/api/leerling/ranking").then((r) => r.json()),
    ]).then(([hwData, rankingData]) => {
      setHuiswerk(Array.isArray(hwData) ? hwData : []);
      setRankings(Array.isArray(rankingData) ? rankingData : []);
      setIsFetching(false);
    }).catch(() => setIsFetching(false));
  }, []);

  if (isFetching) {
    return (
      <div className="p-6 flex items-center gap-2 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("laden")}
      </div>
    );
  }

  const open = huiswerk.filter((h) => !h.ingeLeverd);
  const ingeleverd = huiswerk.filter((h) => h.ingeLeverd);

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("huiswerk_titel")}</h1>
        <p className="text-gray-500 mt-1 text-sm">
          {open.length} {t("openstaand")} · {ingeleverd.length} {t("afgevinkt")}
        </p>
      </div>

      {/* ── Klassement ─────────────────────────────────────────────── */}
      {rankings.map((r) => (
        <Card key={r.klasId} className="border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-gray-900">
              <Trophy className="h-4 w-4 text-amber-500" />
              {t("huiswerk_klassement")} — {r.klasNaam}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {r.totaalHw === 0 ? (
              <p className="text-sm text-gray-400 italic">Nog geen huiswerk aangemaakt voor deze klas.</p>
            ) : r.top3.length === 0 ? (
              <p className="text-sm text-gray-400 italic">{t("huiswerk_geen_inleveringen")}</p>
            ) : (
              <div className="space-y-2">
                {r.top3.map((item) => (
                  <div
                    key={item.leerling.id}
                    className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2"
                  >
                    <span className="text-xl w-8 text-center">{MEDAL[item.positie - 1] ?? `#${item.positie}`}</span>
                    <span className="flex-1 text-sm font-medium text-gray-900">{item.leerling.name}</span>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-green-700">{item.percentage}%</p>
                      <p className="text-xs text-gray-400">{item.aantalIngeleverd}/{item.totaal}</p>
                    </div>
                  </div>
                ))}
                {r.eigenPositie !== null && r.eigenPositie > 3 && (
                  <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 mt-1">
                    <span className="text-sm font-bold text-gray-500 w-8 text-center">#{r.eigenPositie}</span>
                    <span className="flex-1 text-sm font-medium text-green-800">Jouw positie</span>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-green-700">{r.eigenPercentage}%</p>
                      <p className="text-xs text-gray-400">van {r.aantalLeerlingen}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* ── Openstaand ─────────────────────────────────────────────── */}
      {open.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            {t("openstaand")} ({open.length})
          </h2>
          <div className="space-y-3">
            {open.map((hw) => (
              <Card key={hw.id} className="border-amber-100">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{hw.titel}</p>
                      <VakBadge categorie={hw.vak.categorie} className="mt-1" />
                    </div>
                    {hw.deadline && (
                      <p className="text-xs text-red-500 whitespace-nowrap shrink-0">
                        Deadline: {new Date(hw.deadline).toLocaleDateString("nl-NL")}
                      </p>
                    )}
                  </div>
                  {hw.beschrijving && (
                    <p className="text-sm text-gray-500 mt-2">{hw.beschrijving}</p>
                  )}
                  {hw.hasBijlage && hw.bijlageNaam && (
                    <a
                      href={`/api/bijlage/${hw.id}`}
                      download={hw.bijlageNaam}
                      className="inline-flex items-center gap-1.5 text-xs text-green-700 hover:text-green-900 bg-green-50 border border-green-200 rounded px-2 py-1 mt-2 transition-colors"
                    >
                      <Download className="h-3 w-3" />
                      {hw.bijlageNaam}
                    </a>
                  )}
                  <p className="text-xs text-gray-400 mt-3 italic">
                    {t("huiswerk_docent_afvinkt")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Afgevinkt ──────────────────────────────────────────────── */}
      {ingeleverd.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            {t("afgevinkt")} ({ingeleverd.length})
          </h2>
          <div className="space-y-3">
            {ingeleverd.map((hw) => (
              <Card key={hw.id} className="border-green-100 bg-green-50/30">
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-800">{hw.titel}</p>
                    <VakBadge categorie={hw.vak.categorie} />
                  </div>

                  {/* Docent opmerking */}
                  {hw.inlevering?.opmerking && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {t("huiswerk_opmerking_docent")}
                        {hw.inlevering.opmerkingOp && (
                          <span className="font-normal text-blue-500">
                            · {formatDate(hw.inlevering.opmerkingOp)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-blue-900 whitespace-pre-wrap">{hw.inlevering.opmerking}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {huiswerk.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-gray-400 text-sm">
            {t("huiswerk_geen")}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
