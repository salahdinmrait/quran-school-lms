"use client";

import { useEffect, useState } from "react";
import { Loader2, UserCheck, Star, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { useLang } from "@/contexts/LanguageContext";

interface Aanwezigheid {
  id: string; status: string;
  les: { datum: string; klas: { naam: string } };
}

interface Cijfer {
  id: string; waarde: number; vak: { naam: string };
}

interface Leerling {
  id: string; name: string; email: string;
  aanwezigheid: Aanwezigheid[];
  cijfers: Cijfer[];
  leerlingKlassen: { klas: { naam: string } }[];
}

export default function OuderDashboardPage() {
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

  if (kinderen.length === 0) {
    return (
      <div className="p-6 max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("ouder_welkom")}</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">{t("ouder_niet_gekoppeld")}</p>
            <p className="text-gray-400 text-sm mt-1">{t("ouder_niet_gekoppeld_sub")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("nav_dashboard")}</h1>
        <p className="text-gray-500 mt-1 text-sm">{t("ouder_dashboard_sub")}.</p>
      </div>

      {kinderen.map((kind) => {
        const klassen = kind.leerlingKlassen.map((kl) => kl.klas.naam).join(", ") || t("ouder_geen_klas");
        const aanwezig = kind.aanwezigheid.filter((a) => a.status === "AANWEZIG").length;
        const totaal = kind.aanwezigheid.length;
        const afwezig = kind.aanwezigheid.filter((a) => a.status === "AFWEZIG").length;
        const gemiddeld = kind.cijfers.length > 0
          ? (kind.cijfers.reduce((s, c) => s + c.waarde, 0) / kind.cijfers.length).toFixed(1)
          : "—";

        return (
          <div key={kind.id} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 text-lg">
                {kind.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-lg">{kind.name}</p>
                <p className="text-xs text-gray-500">{klassen}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Card className="border-green-200">
                <CardContent className="p-4 text-center">
                  <UserCheck className="h-6 w-6 text-green-600 mx-auto mb-1" />
                  <p className="text-xl font-bold text-green-700">{aanwezig}/{totaal}</p>
                  <p className="text-xs text-gray-500">{t("dashboard_aanwezigheid")}</p>
                  {afwezig > 0 && <p className="text-xs text-red-500 mt-0.5">{afwezig} {t("status_afwezig")}</p>}
                </CardContent>
              </Card>

              <Card className="border-blue-200">
                <CardContent className="p-4 text-center">
                  <Star className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                  <p className="text-xl font-bold text-blue-700">{gemiddeld}</p>
                  <p className="text-xs text-gray-500">{t("ouder_gemiddeld_cijfer")}</p>
                </CardContent>
              </Card>

              <Card className="border-purple-200">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-6 w-6 text-purple-600 mx-auto mb-1" />
                  <p className="text-xl font-bold text-purple-700">{kind.cijfers.length}</p>
                  <p className="text-xs text-gray-500">{t("nav_cijfers")}</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent absentie */}
            {kind.aanwezigheid.filter((a) => a.status !== "AANWEZIG").length > 0 && (
              <Card className="border-red-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-700">{t("ouder_recente_absentie")}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-1">
                    {kind.aanwezigheid
                      .filter((a) => a.status !== "AANWEZIG")
                      .slice(0, 3)
                      .map((a) => (
                        <li key={a.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">{a.les.klas.naam}</span>
                          <span className="text-gray-500">{formatDate(a.les.datum)}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            a.status === "AFWEZIG" ? "bg-red-100 text-red-700" :
                            a.status === "TE_LAAT" ? "bg-amber-100 text-amber-700" :
                            "bg-blue-100 text-blue-700"
                          }`}>{t(a.status === "AFWEZIG" ? "status_afwezig" : a.status === "TE_LAAT" ? "status_te_laat" : "status_geoorloofd")}</span>
                        </li>
                      ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Quick links */}
            <div className="flex flex-wrap gap-2">
              <Link href="/ouder/voortgang" className="text-xs text-green-700 hover:underline px-3 py-1.5 bg-green-50 rounded-full border border-green-200">
                → {t("ouder_voortgang")}
              </Link>
              <Link href="/ouder/rooster" className="text-xs text-purple-700 hover:underline px-3 py-1.5 bg-purple-50 rounded-full border border-purple-200">
                → {t("ouder_aankomende_lessen")}
              </Link>
              <Link href="/ouder/berichten" className="text-xs text-gray-700 hover:underline px-3 py-1.5 bg-gray-50 rounded-full border border-gray-200">
                → {t("nav_berichten")}
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
