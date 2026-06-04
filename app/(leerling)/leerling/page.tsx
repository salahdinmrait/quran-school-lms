import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, UserCheck, BookOpen, Calendar } from "lucide-react";
import Link from "next/link";
import { VakBadge } from "@/components/vakken/VakBadge";
import { formatDate } from "@/lib/utils";

export default async function LeerlingDashboard() {
  const session = await auth();
  const leerlingId = session!.user.id;

  const [klassen, recenteCijfers, openHuiswerk, ongelezen] = await Promise.all([
    prisma.klasLeerling.findMany({
      where: { leerlingId },
      include: {
        klas: {
          include: {
            vakken: { include: { vak: true }, take: 4 },
          },
        },
      },
    }),
    prisma.cijfer.findMany({
      where: { leerlingId },
      orderBy: { datum: "desc" },
      take: 5,
      include: { vak: true },
    }),
    prisma.huiswerk.findMany({
      where: {
        vak: {
          klassen: {
            some: {
              klas: { leerlingen: { some: { leerlingId } } },
            },
          },
        },
        inleveringen: { none: { leerlingId } },
      },
      take: 5,
      include: { vak: true },
    }),
    prisma.bericht.count({
      where: { ontvangerId: leerlingId, gelezen: false },
    }),
  ]);

  const aanwezigheidStats = await prisma.aanwezigheid.groupBy({
    by: ["status"],
    where: { leerlingId },
    _count: { id: true },
  });

  const totaalLessen = aanwezigheidStats.reduce((sum, s) => sum + s._count.id, 0);
  const aanwezig = aanwezigheidStats.find((s) => s.status === "AANWEZIG")?._count.id ?? 0;
  const aanwezigPct = totaalLessen > 0 ? Math.round((aanwezig / totaalLessen) * 100) : null;

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welkom, {session?.user?.name}. Hier is uw overzicht.</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Link href="/leerling/cijfers">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs text-gray-500">Vakken</CardTitle>
              <Star className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{recenteCijfers.length > 0 ? recenteCijfers[0].waarde.toFixed(1) : "—"}</div>
              <p className="text-xs text-gray-400">Laatste cijfer</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/leerling/absentie">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs text-gray-500">Aanwezigheid</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{aanwezigPct !== null ? `${aanwezigPct}%` : "—"}</div>
              <p className="text-xs text-gray-400">{totaalLessen} lessen geregistreerd</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/leerling/huiswerk">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs text-gray-500">Huiswerk</CardTitle>
              <BookOpen className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{openHuiswerk.length}</div>
              <p className="text-xs text-gray-400">Openstaand</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/leerling/berichten">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs text-gray-500">Berichten</CardTitle>
              <Calendar className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{ongelezen}</div>
              <p className="text-xs text-gray-400">Ongelezen</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recente cijfers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recente beoordelingen</CardTitle>
          </CardHeader>
          <CardContent>
            {recenteCijfers.length === 0 ? (
              <p className="text-sm text-gray-400">Nog geen cijfers ingevoerd.</p>
            ) : (
              <ul className="space-y-3">
                {recenteCijfers.map((cijfer) => (
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
            <CardTitle className="text-base">Openstaand huiswerk</CardTitle>
          </CardHeader>
          <CardContent>
            {openHuiswerk.length === 0 ? (
              <p className="text-sm text-gray-400">Geen openstaand huiswerk. Goed bezig!</p>
            ) : (
              <ul className="space-y-3">
                {openHuiswerk.map((hw) => (
                  <li key={hw.id} className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{hw.titel}</p>
                      <VakBadge
                        categorie={hw.vak.categorie as "HIFZ" | "TAJWEED" | "ARABISCH" | "FIQH" | "SIRA" | "OVERIG"}
                        className="mt-1"
                      />
                    </div>
                    {hw.deadline && (
                      <p className="text-xs text-red-500 whitespace-nowrap">{formatDate(hw.deadline)}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Mijn klassen */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mijn klassen</CardTitle>
          </CardHeader>
          <CardContent>
            {klassen.length === 0 ? (
              <p className="text-sm text-gray-400">Nog niet aan een klas gekoppeld.</p>
            ) : (
              <ul className="space-y-3">
                {klassen.map(({ klas }) => (
                  <li key={klas.id}>
                    <p className="text-sm font-medium text-gray-800">{klas.naam}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {klas.vakken.map((kv) => (
                        <VakBadge
                          key={kv.id}
                          categorie={kv.vak.categorie as "HIFZ" | "TAJWEED" | "ARABISCH" | "FIQH" | "SIRA" | "OVERIG"}
                        />
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
