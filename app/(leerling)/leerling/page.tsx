"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, UserCheck, BookOpen, MessageSquare, Loader2 } from "lucide-react";
import Link from "next/link";
import { VakBadge } from "@/components/vakken/VakBadge";
import { formatDate } from "@/lib/utils";
import { useLang } from "@/contexts/LanguageContext";

type VakCategorie = "HIFZ" | "TAJWEED" | "ARABISCH" | "FIQH" | "SIRA" | "OVERIG";

interface DashboardData {
  name: string;
  recenteCijfers: { id: string; waarde: number; datum: string; omschrijving: string | null; vak: { naam: string; categorie: VakCategorie } }[];
  openHuiswerk: { id: string; titel: string; vak: { naam: string; categorie: VakCategorie } }[];
  klassen: { klas: { id: string; naam: string; vakken: { id: string; vak: { categorie: VakCategorie } }[] } }[];
  aanwezigPct: number | null;
  totaalLessen: number;
  ongelezen: number;
}

export default function LeerlingDashboard() {
  const { t } = useLang();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetch("/api/leerling/dashboard")
      .then((r) => r.json())
      .then((d) => { setData(d); setIsFetching(false); })
      .catch(() => setIsFetching(false));
  }, []);

  if (isFetching || !data) {
    return (
      <div className="p-6 flex items-center gap-2 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("laden")}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("nav_dashboard")}</h1>
        <p className="text-gray-500 mt-1">{t("dashboard_welkom")}, {data.name}. {t("dashboard_overzicht")}</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Link href="/leerling/cijfers">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs text-gray-500">{t("dashboard_vakken")}</CardTitle>
              <Star className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.recenteCijfers.length > 0 ? data.recenteCijfers[0].waarde.toFixed(1) : "—"}
              </div>
              <p className="text-xs text-gray-400">{t("dashboard_laatste_cijfer")}</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/leerling/absentie">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs text-gray-500">{t("dashboard_aanwezigheid")}</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.aanwezigPct !== null ? `${data.aanwezigPct}%` : "—"}
              </div>
              <p className="text-xs text-gray-400">{data.totaalLessen} {t("dashboard_lessen_geregistreerd")}</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/leerling/huiswerk">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs text-gray-500">{t("nav_huiswerk")}</CardTitle>
              <BookOpen className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.openHuiswerk.length}</div>
              <p className="text-xs text-gray-400">{t("openstaand")}</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/leerling/berichten">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs text-gray-500">{t("nav_berichten")}</CardTitle>
              <MessageSquare className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.ongelezen}</div>
              <p className="text-xs text-gray-400">{t("dashboard_ongelezen")}</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recente cijfers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard_recente_beoordelingen")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recenteCijfers.length === 0 ? (
              <p className="text-sm text-gray-400">{t("dashboard_geen_cijfers")}</p>
            ) : (
              <ul className="space-y-3">
                {data.recenteCijfers.map((cijfer) => (
                  <li key={cijfer.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{cijfer.vak.naam}</p>
                      <p className="text-xs text-gray-400">{formatDate(cijfer.datum)}</p>
                      {cijfer.omschrijving && (
                        <p className="text-xs text-gray-500 truncate max-w-[180px]">{cijfer.omschrijving}</p>
                      )}
                    </div>
                    <span className={`text-lg font-bold ${cijfer.waarde >= 5.5 ? "text-green-700" : "text-red-600"}`}>
                      {cijfer.waarde.toFixed(1)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Open huiswerk */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard_huiswerk_openstaand")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.openHuiswerk.length === 0 ? (
              <p className="text-sm text-gray-400">{t("dashboard_geen_huiswerk")}</p>
            ) : (
              <ul className="space-y-3">
                {data.openHuiswerk.map((hw) => (
                  <li key={hw.id} className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{hw.titel}</p>
                      <VakBadge categorie={hw.vak.categorie} className="mt-1" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Mijn klassen */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard_mijn_klassen")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.klassen.length === 0 ? (
              <p className="text-sm text-gray-400">{t("dashboard_geen_klas")}</p>
            ) : (
              <ul className="space-y-3">
                {data.klassen.map(({ klas }) => (
                  <li key={klas.id}>
                    <p className="text-sm font-medium text-gray-800">{klas.naam}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {klas.vakken.map((kv) => (
                        <VakBadge key={kv.id} categorie={kv.vak.categorie} />
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
