import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { School, BookOpen, Users } from "lucide-react";

export default async function DocentDashboard() {
  const session = await auth();
  const docentId = session!.user.id;

  const [klassenCount, leerlingenCount] = await Promise.all([
    prisma.klasDocent.count({ where: { docentId } }),
    prisma.klasLeerling.count({
      where: {
        klas: { docenten: { some: { docentId } } },
      },
    }),
  ]);

  const klassen = await prisma.klasDocent.findMany({
    where: { docentId },
    include: {
      klas: {
        include: {
          _count: { select: { leerlingen: true } },
          vakken: { include: { vak: true }, take: 3 },
        },
      },
    },
    take: 3,
  });

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welkom terug, {session?.user?.name}.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Mijn klassen</CardTitle>
            <div className="p-2 rounded-lg bg-green-50 text-green-700">
              <School className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{klassenCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Leerlingen</CardTitle>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{leerlingenCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent klassen */}
      {klassen.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">Mijn klassen</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {klassen.map(({ klas }) => (
              <Card key={klas.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{klas.naam}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-gray-500">{klas._count.leerlingen} leerlingen</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {klas.vakken.map((kv) => (
                      <span key={kv.id} className="text-xs bg-green-50 text-green-700 rounded px-1.5 py-0.5">
                        {kv.vak.naam}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
