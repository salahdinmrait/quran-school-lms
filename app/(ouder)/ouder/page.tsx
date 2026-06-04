"use client";

import { useEffect, useState } from "react";
import { Loader2, BookOpen, UserCheck, Star, TrendingUp, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

interface Aanwezigheid {
  id: string; status: string;
  les: { datum: string; klas: { naam: string } };
}

interface Cijfer {
  id: string; waarde: number; vak: { naam: string };
}

interface HifdhProfiel {
  huidigeSurahNr: number; huidigeAyahNr: number; ayaatPerWeek: number;
  taken: { voltooid: boolean }[];
}

interface Leerling {
  id: string; name: string; email: string;
  aanwezigheid: Aanwezigheid[];
  cijfers: Cijfer[];
  hifdhProfiel: HifdhProfiel | null;
  leerlingKlassen: { klas: { naam: string } }[];
}

export default function OuderDashboardPage() {
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
        <Loader2 className="h-4 w-4 animate-spin" /> Laden…
      </div>
    );
  }

  if (kinderen.length === 0) {
    return (
      <div className="p-6 max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welkom</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">Uw account is nog niet gekoppeld aan een kind.</p>
            <p className="text-gray-400 text-sm mt-1">Neem contact op met de school om uw account te koppelen.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1 text-sm">Overzicht van uw kind{kinderen.length > 1 ? "eren" : ""}.</p>
      </div>

      {kinderen.map((kind) => {
        const klassen = kind.leerlingKlassen.map((kl) => kl.klas.naam).join(", ");
        const aanwezig = kind.aanwezigheid.filter((a) => a.status === "AANWEZIG").length;
        const totaal = kind.aanwezigheid.length;
        const afwezig = kind.aanwezigheid.filter((a) => a.status === "AFWEZIG").length;
        const gemiddeld = kind.cijfers.length > 0
          ? (kind.cijfers.reduce((s, c) => s + c.waarde, 0) / kind.cijfers.length).toFixed(1)
          : "—";
        const hifdhTaken = kind.hifdhProfiel?.taken ?? [];
        const hifdhVoltooide = hifdhTaken.filter((t) => t.voltooid).length;

        return (
          <div key={kind.id} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 text-lg">
                {kind.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-lg">{kind.name}</p>
                <p className="text-xs text-gray-500">{klassen || "Geen klas"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="border-green-200">
                <CardContent className="p-4 text-center">
                  <UserCheck className="h-6 w-6 text-green-600 mx-auto mb-1" />
                  <p className="text-xl font-bold text-green-700">{aanwezig}/{totaal}</p>
                  <p className="text-xs text-gray-500">Aanwezig</p>
                  {afwezig > 0 && <p className="text-xs text-red-500 mt-0.5">{afwezig} afwezig</p>}
                </CardContent>
              </Card>

              <Card className="border-blue-200">
                <CardContent className="p-4 text-center">
                  <Star className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                  <p className="text-xl font-bold text-blue-700">{gemiddeld}</p>
                  <p className="text-xs text-gray-500">Gemiddeld cijfer</p>
                </CardContent>
              </Card>

              <Card className="border-amber-200">
                <CardContent className="p-4 text-center">
                  <BookOpen className="h-6 w-6 text-amber-600 mx-auto mb-1" />
                  <p className="text-xl font-bold text-amber-700">{hifdhVoltooide}/{hifdhTaken.length}</p>
                  <p className="text-xs text-gray-500">Hifdh taken</p>
                </CardContent>
              </Card>

              <Card className="border-purple-200">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-6 w-6 text-purple-600 mx-auto mb-1" />
                  <p className="text-xl font-bold text-purple-700">{kind.cijfers.length}</p>
                  <p className="text-xs text-gray-500">Cijfers</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent absentie */}
            {kind.aanwezigheid.filter((a) => a.status !== "AANWEZIG").length > 0 && (
              <Card className="border-red-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-700">Recente absentie</CardTitle>
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
                          }`}>{a.status.replace("_", " ")}</span>
                        </li>
                      ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Quick links */}
            <div className="flex flex-wrap gap-2">
              <Link href="/ouder/voortgang" className="text-xs text-green-700 hover:underline px-3 py-1.5 bg-green-50 rounded-full border border-green-200">
                → Volledige voortgang
              </Link>
              <Link href="/ouder/hifdh" className="text-xs text-blue-700 hover:underline px-3 py-1.5 bg-blue-50 rounded-full border border-blue-200">
                → Hifdh tracker
              </Link>
              <Link href="/ouder/rooster" className="text-xs text-purple-700 hover:underline px-3 py-1.5 bg-purple-50 rounded-full border border-purple-200">
                → Aankomende lessen
              </Link>
              <Link href="/ouder/berichten" className="text-xs text-gray-700 hover:underline px-3 py-1.5 bg-gray-50 rounded-full border border-gray-200">
                → Berichten
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
