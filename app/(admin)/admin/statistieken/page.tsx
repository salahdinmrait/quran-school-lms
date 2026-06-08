import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, School, BookOpen, GraduationCap, BarChart3, CalendarCheck, TrendingUp, ClipboardList } from "lucide-react";
import { VakBadge } from "@/components/vakken/VakBadge";

export default async function StatistiekenPage() {
  const [
    totalLeerlingen,
    totalDocenten,
    totalKlassen,
    totalVakken,
    vakkenPerCategorie,
    klassen,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "LEERLING", actief: true } }),
    prisma.user.count({ where: { role: "DOCENT", actief: true } }),
    prisma.klas.count(),
    prisma.vak.count(),
    prisma.vak.groupBy({ by: ["categorie"], _count: { id: true } }),
    prisma.klas.findMany({
      orderBy: { naam: "asc" },
      include: {
        leerlingen: { select: { leerlingId: true } },
        vakken: { select: { vakId: true } },
      },
    }),
  ]);

  const stats = [
    { title: "Actieve leerlingen", value: totalLeerlingen, icon: GraduationCap, color: "text-blue-600 bg-blue-50" },
    { title: "Actieve docenten", value: totalDocenten, icon: Users, color: "text-purple-600 bg-purple-50" },
    { title: "Klassen", value: totalKlassen, icon: School, color: "text-amber-600 bg-amber-50" },
    { title: "Vakken", value: totalVakken, icon: BookOpen, color: "text-green-600 bg-green-50" },
  ];

  // Per-class stats
  const klasStats = await Promise.all(klassen.map(async (klas) => {
    const leerlingIds = klas.leerlingen.map((kl) => kl.leerlingId);
    const vakIds = klas.vakken.map((kv) => kv.vakId);

    if (leerlingIds.length === 0) {
      return {
        id: klas.id, naam: klas.naam, leerlingenCount: 0,
        aanwezigheid: null, avgCijfer: null, hwPercent: null,
      };
    }

    const [aanwAanwezig, aanwTotaal, cijferAgg, totalHw, totalInleveringen] = await Promise.all([
      prisma.aanwezigheid.count({
        where: { leerlingId: { in: leerlingIds }, status: "AANWEZIG", les: { klasId: klas.id } },
      }),
      prisma.aanwezigheid.count({
        where: { leerlingId: { in: leerlingIds }, les: { klasId: klas.id } },
      }),
      prisma.cijfer.aggregate({
        where: { leerlingId: { in: leerlingIds } },
        _avg: { waarde: true },
      }),
      vakIds.length > 0
        ? prisma.huiswerk.count({ where: { vakId: { in: vakIds } } })
        : Promise.resolve(0),
      vakIds.length > 0
        ? prisma.inlevering.count({
            where: {
              leerlingId: { in: leerlingIds },
              huiswerk: { vakId: { in: vakIds } },
            },
          })
        : Promise.resolve(0),
    ]);

    const maxPossibleInleveringen = totalHw * leerlingIds.length;

    return {
      id: klas.id,
      naam: klas.naam,
      leerlingenCount: leerlingIds.length,
      aanwezigheid: aanwTotaal > 0 ? Math.round((aanwAanwezig / aanwTotaal) * 100) : null,
      avgCijfer: cijferAgg._avg.waarde !== null
        ? Math.round(cijferAgg._avg.waarde * 10) / 10
        : null,
      hwPercent: maxPossibleInleveringen > 0
        ? Math.round((totalInleveringen / maxPossibleInleveringen) * 100)
        : null,
    };
  }));

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Statistieken</h1>
        <p className="text-gray-500 mt-1 text-sm">Overzicht van de school.</p>
      </div>

      {/* Overall counts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">{s.title}</CardTitle>
                <div className={`p-2 rounded-lg ${s.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{s.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Per-class stats */}
      {klasStats.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-green-700" />
              Statistieken per klas
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-4 font-medium text-gray-500">Klas</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">
                    <span className="flex items-center justify-center gap-1">
                      <Users className="h-3.5 w-3.5" /> Leerlingen
                    </span>
                  </th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">
                    <span className="flex items-center justify-center gap-1">
                      <CalendarCheck className="h-3.5 w-3.5" /> Aanwezigheid
                    </span>
                  </th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">
                    <span className="flex items-center justify-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" /> Gem. cijfer
                    </span>
                  </th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">
                    <span className="flex items-center justify-center gap-1">
                      <ClipboardList className="h-3.5 w-3.5" /> Huiswerk
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {klasStats.map((k) => (
                  <tr key={k.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 pr-4 font-medium text-gray-900">{k.naam}</td>
                    <td className="py-3 px-3 text-center text-gray-600">{k.leerlingenCount}</td>
                    <td className="py-3 px-3 text-center">
                      {k.aanwezigheid !== null ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          k.aanwezigheid >= 80 ? "bg-green-100 text-green-700"
                          : k.aanwezigheid >= 60 ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                        }`}>
                          {k.aanwezigheid}%
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {k.avgCijfer !== null ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          k.avgCijfer >= 5.5 ? "bg-green-100 text-green-700"
                          : k.avgCijfer >= 4 ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                        }`}>
                          {k.avgCijfer.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {k.hwPercent !== null ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          k.hwPercent >= 70 ? "bg-green-100 text-green-700"
                          : k.hwPercent >= 40 ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                        }`}>
                          {k.hwPercent}%
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Vakken per categorie */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-green-700" />
            Vakken per categorie
          </CardTitle>
        </CardHeader>
        <CardContent>
          {vakkenPerCategorie.length === 0 ? (
            <p className="text-sm text-gray-400">Nog geen vakken aangemaakt.</p>
          ) : (
            <div className="space-y-3">
              {vakkenPerCategorie.map((cat) => (
                <div key={cat.categorie} className="flex items-center justify-between">
                  <VakBadge categorie={cat.categorie as "HIFZ" | "TAJWEED" | "ARABISCH" | "FIQH" | "SIRA" | "OVERIG"} />
                  <span className="text-sm font-medium text-gray-700">{cat._count.id} vak{cat._count.id !== 1 ? "ken" : ""}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
