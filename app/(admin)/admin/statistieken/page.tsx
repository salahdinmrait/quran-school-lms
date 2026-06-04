import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, School, BookOpen, GraduationCap, BarChart3 } from "lucide-react";
import { VakBadge } from "@/components/vakken/VakBadge";

export default async function StatistiekenPage() {
  const [
    totalLeerlingen,
    totalDocenten,
    totalKlassen,
    totalVakken,
    vakkenPerCategorie,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "LEERLING", actief: true } }),
    prisma.user.count({ where: { role: "DOCENT", actief: true } }),
    prisma.klas.count(),
    prisma.vak.count(),
    prisma.vak.groupBy({ by: ["categorie"], _count: { id: true } }),
  ]);

  const stats = [
    { title: "Actieve leerlingen", value: totalLeerlingen, icon: GraduationCap, color: "text-blue-600 bg-blue-50" },
    { title: "Actieve docenten", value: totalDocenten, icon: Users, color: "text-purple-600 bg-purple-50" },
    { title: "Klassen", value: totalKlassen, icon: School, color: "text-amber-600 bg-amber-50" },
    { title: "Vakken", value: totalVakken, icon: BookOpen, color: "text-green-600 bg-green-50" },
  ];

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Statistieken</h1>
        <p className="text-gray-500 mt-1 text-sm">Overzicht van de school.</p>
      </div>

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
