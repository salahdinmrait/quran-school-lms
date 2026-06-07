"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { useLang } from "@/contexts/LanguageContext";

interface Aanwezigheid {
  id: string;
  status: string;
  les: {
    datum: string;
    begintijd: string;
    eindtijd: string;
    klas: { naam: string };
    vak: { naam: string } | null;
  };
}

const statusKleur: Record<string, string> = {
  AANWEZIG:   "bg-green-100 text-green-700",
  AFWEZIG:    "bg-red-100 text-red-700",
  TE_LAAT:    "bg-amber-100 text-amber-700",
  GEOORLOOFD: "bg-blue-100 text-blue-700",
};

export default function AbsentiePage() {
  const { t } = useLang();
  const [aanwezigheid, setAanwezigheid] = useState<Aanwezigheid[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetch("/api/leerling/absentie")
      .then((r) => r.json())
      .then((d) => { setAanwezigheid(Array.isArray(d) ? d : []); setIsFetching(false); })
      .catch(() => setIsFetching(false));
  }, []);

  if (isFetching) {
    return (
      <div className="p-6 flex items-center gap-2 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("laden")}
      </div>
    );
  }

  const statusKeys: Record<string, Parameters<typeof t>[0]> = {
    AANWEZIG:   "status_aanwezig",
    AFWEZIG:    "status_afwezig",
    TE_LAAT:    "status_te_laat",
    GEOORLOOFD: "status_geoorloofd",
  };

  const stats = aanwezigheid.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("absentie_titel")}</h1>
        <p className="text-gray-500 mt-1 text-sm">{t("absentie_subtitel")}</p>
      </div>

      {/* Summary */}
      {aanwezigheid.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Object.entries(statusKeys).map(([status, labelKey]) => (
            <Card key={status}>
              <CardContent className="py-4 text-center">
                <div className="text-2xl font-bold">{stats[status] ?? 0}</div>
                <span className={`inline-block text-xs rounded-full px-2 py-0.5 mt-1 ${statusKleur[status]}`}>
                  {t(labelKey)}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {aanwezigheid.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-400 text-sm">
            {t("absentie_geen")}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("absentie_registraties")} ({aanwezigheid.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs text-gray-400 font-medium">{t("datum")}</th>
                  <th className="text-left py-2 text-xs text-gray-400 font-medium">{t("absentie_klas")}</th>
                  <th className="text-left py-2 text-xs text-gray-400 font-medium">{t("absentie_tijd")}</th>
                  <th className="text-left py-2 text-xs text-gray-400 font-medium">{t("status_aanwezig").replace("Aanwezig", "Status").replace("حاضر", "الحالة")}</th>
                </tr>
              </thead>
              <tbody>
                {aanwezigheid.map((a) => (
                  <tr key={a.id} className="border-b border-gray-50">
                    <td className="py-2 text-gray-700">{formatDate(a.les.datum)}</td>
                    <td className="py-2 text-gray-700">{a.les.klas.naam}</td>
                    <td className="py-2 text-gray-500 text-xs">{a.les.begintijd}–{a.les.eindtijd}</td>
                    <td className="py-2">
                      <span className={`inline-block text-xs rounded-full px-2 py-0.5 ${statusKleur[a.status] ?? ""}`}>
                        {t(statusKeys[a.status] ?? "status_aanwezig")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
