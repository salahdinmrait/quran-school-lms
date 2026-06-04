import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VakBadge } from "@/components/vakken/VakBadge";

export default async function MijnKlassenPage() {
  const session = await auth();
  const docentId = session!.user.id;

  const klassen = await prisma.klasDocent.findMany({
    where: { docentId },
    include: {
      klas: {
        include: {
          leerlingen: { include: { leerling: { select: { id: true, name: true } } } },
          vakken: { include: { vak: true } },
        },
      },
    },
  });

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mijn klassen</h1>
        <p className="text-gray-500 mt-1 text-sm">Overzicht van uw toegewezen klassen.</p>
      </div>

      {klassen.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-400 text-sm">
            U bent nog niet aan een klas gekoppeld. Neem contact op met de beheerder.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {klassen.map(({ klas }) => (
            <Card key={klas.id}>
              <CardHeader>
                <CardTitle>{klas.naam}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Leerlingen ({klas.leerlingen.length})
                    </p>
                    {klas.leerlingen.length === 0 ? (
                      <p className="text-sm text-gray-400">Nog geen leerlingen.</p>
                    ) : (
                      <ul className="space-y-1">
                        {klas.leerlingen.map((kl) => (
                          <li key={kl.id} className="text-sm text-gray-600">{kl.leerling.name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Vakken ({klas.vakken.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {klas.vakken.map((kv) => (
                        <VakBadge
                          key={kv.id}
                          categorie={kv.vak.categorie as "HIFZ" | "TAJWEED" | "ARABISCH" | "FIQH" | "SIRA" | "OVERIG"}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
