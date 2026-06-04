import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, School, BookOpen, GraduationCap } from "lucide-react";

export default async function AdminDashboard() {
  const session = await auth();

  const [totalLeerlingen, totalDocenten, totalKlassen, totalVakken] = await Promise.all([
    prisma.user.count({ where: { role: "LEERLING", actief: true } }),
    prisma.user.count({ where: { role: "DOCENT", actief: true } }),
    prisma.klas.count(),
    prisma.vak.count(),
  ]);

  const stats = [
    {
      title: "Leerlingen",
      value: totalLeerlingen,
      icon: GraduationCap,
      color: "bg-blue-50 text-blue-700",
    },
    {
      title: "Docenten",
      value: totalDocenten,
      icon: Users,
      color: "bg-purple-50 text-purple-700",
    },
    {
      title: "Klassen",
      value: totalKlassen,
      icon: School,
      color: "bg-amber-50 text-amber-700",
    },
    {
      title: "Vakken",
      value: totalVakken,
      icon: BookOpen,
      color: "bg-green-50 text-green-700",
    },
  ];

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Welkom terug, {session?.user?.name}. Overzicht van de school.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
                <p className="text-xs text-gray-500 mt-1">actief geregistreerd</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Snel navigeren</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="/admin/vakken/nieuw"
              className="block w-full text-sm text-center py-2 px-4 bg-green-700 text-white rounded-md hover:bg-green-800 transition-colors"
            >
              Nieuw vak aanmaken
            </a>
            <a
              href="/admin/gebruikers/nieuw"
              className="block w-full text-sm text-center py-2 px-4 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Nieuwe gebruiker aanmaken
            </a>
            <a
              href="/admin/klassen/nieuw"
              className="block w-full text-sm text-center py-2 px-4 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Nieuwe klas aanmaken
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Info</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              Dit is een verse installatie. Maak klassen, vakken en gebruikers aan
              via het beheerpaneel om te beginnen.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
