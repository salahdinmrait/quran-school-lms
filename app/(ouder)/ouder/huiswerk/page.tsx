"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle, Clock, MessageSquare, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VakBadge } from "@/components/vakken/VakBadge";
import { formatDate } from "@/lib/utils";
import { useLang } from "@/contexts/LanguageContext";

type VakCategorie = "HIFZ" | "TAJWEED" | "ARABISCH" | "FIQH" | "SIRA" | "OVERIG";

interface HuiswerkItem {
  id: string;
  titel: string;
  beschrijving: string | null;
  deadline: string | null;
  vak: { naam: string; categorie: VakCategorie };
  ingeLeverd: boolean;
  inlevering: { inhoud: string; createdAt: string; opmerking: string | null } | null;
}

interface KindHuiswerk {
  kind: { id: string; name: string };
  huiswerk: HuiswerkItem[];
}

export default function OuderHuiswerkPage() {
  const { t } = useLang();
  const [data, setData] = useState<KindHuiswerk[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetch("/api/ouder/huiswerk")
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

  return (
    <div className="p-6 max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("huiswerk_kind")}</h1>
        <p className="text-gray-500 mt-1 text-sm">{t("huiswerk_kind_sub")}</p>
      </div>

      {data.map(({ kind, huiswerk }) => {
        const open = huiswerk.filter((h) => !h.ingeLeverd);
        const ingeLeverd = huiswerk.filter((h) => h.ingeLeverd);

        return (
          <div key={kind.id} className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">{kind.name}</h2>

            {huiswerk.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-400 text-sm">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  {t("huiswerk_geen")}
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Openstaand */}
                {open.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-500" />
                      {t("openstaand")} ({open.length})
                    </h3>
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
                                  {t("huiswerk_deadline")}: {formatDate(hw.deadline)}
                                </p>
                              )}
                            </div>
                            {hw.beschrijving && (
                              <p className="text-sm text-gray-500 mt-2">{hw.beschrijving}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-3 italic">{t("huiswerk_docent_afvinkt")}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Afgevinkt */}
                {ingeLeverd.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      {t("afgevinkt")} ({ingeLeverd.length})
                    </h3>
                    <div className="space-y-3">
                      {ingeLeverd.map((hw) => (
                        <Card key={hw.id} className="border-green-100 bg-green-50/30">
                          <CardContent className="py-4 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-gray-800">{hw.titel}</p>
                              <VakBadge categorie={hw.vak.categorie} />
                            </div>
                            {hw.inlevering?.opmerking && (
                              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 space-y-1">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  {t("huiswerk_opmerking_docent")}
                                </div>
                                <p className="text-sm text-blue-900 whitespace-pre-wrap">{hw.inlevering.opmerking}</p>
                              </div>
                            )}
                            {hw.inlevering && (
                              <p className="text-xs text-green-600">
                                ✓ {t("huiswerk_ingeleverd_op")} {formatDate(hw.inlevering.createdAt)}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
