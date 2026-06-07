"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VakBadge } from "@/components/vakken/VakBadge";
import { formatDate } from "@/lib/utils";
import { useLang } from "@/contexts/LanguageContext";

type VakCategorie = "HIFZ" | "TAJWEED" | "ARABISCH" | "FIQH" | "SIRA" | "OVERIG";

interface Cijfer {
  id: string;
  waarde: number;
  omschrijving: string | null;
  datum: string;
  vakId: string;
  vak: { id: string; naam: string; categorie: VakCategorie };
}

export default function CijfersPage() {
  const { t } = useLang();
  const [cijfers, setCijfers] = useState<Cijfer[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetch("/api/leerling/cijfers")
      .then((r) => r.json())
      .then((d) => { setCijfers(Array.isArray(d) ? d : []); setIsFetching(false); })
      .catch(() => setIsFetching(false));
  }, []);

  if (isFetching) {
    return (
      <div className="p-6 flex items-center gap-2 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("laden")}
      </div>
    );
  }

  // Group by vak
  const perVak: Record<string, Cijfer[]> = {};
  for (const c of cijfers) {
    if (!perVak[c.vakId]) perVak[c.vakId] = [];
    perVak[c.vakId].push(c);
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("cijfers_titel")}</h1>
        <p className="text-gray-500 mt-1 text-sm">{t("cijfers_subtitel")}</p>
      </div>

      {cijfers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-400 text-sm">
            {t("cijfers_geen")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(perVak).map(([, vakCijfers]) => {
            const vak = vakCijfers[0].vak;
            const gem = vakCijfers.reduce((s, c) => s + c.waarde, 0) / vakCijfers.length;
            return (
              <Card key={vak.id}>
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{vak.naam}</CardTitle>
                    <VakBadge categorie={vak.categorie} />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">{t("gemiddelde")}</p>
                    <p className={`text-lg font-bold ${gem >= 5.5 ? "text-green-700" : "text-red-600"}`}>
                      {gem.toFixed(1)}
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-1 text-xs text-gray-400 font-medium">{t("cijfers_datum")}</th>
                        <th className="text-left py-1 text-xs text-gray-400 font-medium">{t("cijfers_omschrijving")}</th>
                        <th className="text-right py-1 text-xs text-gray-400 font-medium">{t("cijfers_cijfer")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vakCijfers.map((c) => (
                        <tr key={c.id} className="border-b border-gray-50">
                          <td className="py-1.5 text-gray-500 text-xs">{formatDate(c.datum)}</td>
                          <td className="py-1.5 text-gray-700">{c.omschrijving ?? "—"}</td>
                          <td className={`py-1.5 text-right font-semibold ${c.waarde >= 5.5 ? "text-green-700" : "text-red-600"}`}>
                            {c.waarde.toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
