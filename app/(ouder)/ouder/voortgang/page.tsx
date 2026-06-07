"use client";

import { useEffect, useState } from "react";
import { Loader2, Star, UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VakBadge } from "@/components/vakken/VakBadge";
import { formatDate } from "@/lib/utils";
import { useLang } from "@/contexts/LanguageContext";

type VakCat = "HIFZ" | "TAJWEED" | "ARABISCH" | "FIQH" | "SIRA" | "OVERIG";

interface Cijfer { id: string; waarde: number; omschrijving: string | null; datum: string; vak: { naam: string; categorie: string }; }
interface Aanwezigheid { id: string; status: string; les: { datum: string; klas: { naam: string }; vak: { naam: string } | null }; }
interface Leerling { id: string; name: string; cijfers: Cijfer[]; aanwezigheid: Aanwezigheid[]; }

const statusKleur: Record<string, string> = {
  AANWEZIG: "bg-green-100 text-green-700",
  AFWEZIG: "bg-red-100 text-red-700",
  TE_LAAT: "bg-amber-100 text-amber-700",
  GEOORLOOFD: "bg-blue-100 text-blue-700",
};

export default function OuderVoortgangPage() {
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

  const statusKeys: Record<string, Parameters<typeof t>[0]> = {
    AANWEZIG: "status_aanwezig",
    AFWEZIG: "status_afwezig",
    TE_LAAT: "status_te_laat",
    GEOORLOOFD: "status_geoorloofd",
  };

  return (
    <div className="p-6 max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("voortgang_titel")}</h1>
        <p className="text-gray-500 mt-1 text-sm">{t("voortgang_subtitel")}</p>
      </div>

      {kinderen.map((kind) => {
        const gem = kind.cijfers.length
          ? (kind.cijfers.reduce((s, c) => s + c.waarde, 0) / kind.cijfers.length).toFixed(1)
          : "—";
        const aanwezig = kind.aanwezigheid.filter((a) => a.status === "AANWEZIG").length;
        const totaal = kind.aanwezigheid.length;

        return (
          <div key={kind.id} className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">{kind.name}</h2>

            {/* Cijfers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Star className="h-4 w-4 text-green-700" />
                  {t("nav_cijfers")}
                  <span className="ml-auto text-sm font-normal text-gray-500">{t("gemiddelde")}: {gem}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {kind.cijfers.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">{t("voortgang_geen_cijfers")}</p>
                ) : (
                  <div className="space-y-2">
                    {kind.cijfers.map((c) => (
                      <div key={c.id} className="flex items-center gap-3">
                        <VakBadge categorie={c.vak.categorie as VakCat} />
                        <span className="text-sm text-gray-700 flex-1">{c.vak.naam}</span>
                        {c.omschrijving && <span className="text-xs text-gray-500">{c.omschrijving}</span>}
                        <span className="text-sm text-gray-400">{formatDate(c.datum)}</span>
                        <span className={`text-base font-bold w-8 text-right ${
                          c.waarde >= 7 ? "text-green-600" : c.waarde >= 5.5 ? "text-amber-600" : "text-red-600"
                        }`}>{c.waarde}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Aanwezigheid */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserCheck className="h-4 w-4 text-green-700" />
                  {t("dashboard_aanwezigheid")}
                  <span className="ml-auto text-sm font-normal text-gray-500">{aanwezig}/{totaal} {t("status_aanwezig")}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {kind.aanwezigheid.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">{t("voortgang_geen_aanwezigheid")}</p>
                ) : (
                  <div className="space-y-1.5">
                    {kind.aanwezigheid.map((a) => (
                      <div key={a.id} className="flex items-center gap-3 text-sm">
                        <span className="text-gray-500 w-24 shrink-0">{formatDate(a.les.datum)}</span>
                        <span className="text-gray-700 flex-1">{a.les.klas.naam}{a.les.vak && ` — ${a.les.vak.naam}`}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusKleur[a.status] ?? "bg-gray-100 text-gray-700"}`}>
                          {t(statusKeys[a.status] ?? "status_aanwezig")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
