import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

const statusLabel: Record<string, string> = {
  AANWEZIG: "Aanwezig",
  AFWEZIG: "Afwezig",
  TE_LAAT: "Te laat",
  GEOORLOOFD: "Geoorloofd afwezig",
};

const statusKleur: Record<string, string> = {
  AANWEZIG: "bg-green-100 text-green-700",
  AFWEZIG: "bg-red-100 text-red-700",
  TE_LAAT: "bg-amber-100 text-amber-700",
  GEOORLOOFD: "bg-blue-100 text-blue-700",
};

export default async function AbsentiePage() {
  const session = await auth();
  const leerlingId = session!.user.id;

  const aanwezigheid = await prisma.aanwezigheid.findMany({
    where: { leerlingId },
    orderBy: { les: { datum: "desc" } },
    include: { les: { include: { klas: true } } },
    take: 30,
  });

  const stats = aanwezigheid.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const totaal = aanwezigheid.length;

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Absentie</h1>
        <p className="text-gray-500 mt-1 text-sm">Aanwezigheidsoverzicht.</p>
      </div>

      {/* Summary */}
      {totaal > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Object.entries(statusLabel).map(([status, label]) => (
            <Card key={status}>
              <CardContent className="py-4 text-center">
                <div className="text-2xl font-bold">{stats[status] ?? 0}</div>
                <span className={`inline-block text-xs rounded-full px-2 py-0.5 mt-1 ${statusKleur[status]}`}>
                  {label}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {aanwezigheid.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-400 text-sm">
            Nog geen aanwezigheid geregistreerd.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registraties (laatste 30)</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs text-gray-400 font-medium">Datum</th>
                  <th className="text-left py-2 text-xs text-gray-400 font-medium">Klas</th>
                  <th className="text-left py-2 text-xs text-gray-400 font-medium">Tijd</th>
                  <th className="text-left py-2 text-xs text-gray-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {aanwezigheid.map((a) => (
                  <tr key={a.id} className="border-b border-gray-50">
                    <td className="py-2 text-gray-700">{formatDate(a.les.datum)}</td>
                    <td className="py-2 text-gray-700">{a.les.klas.naam}</td>
                    <td className="py-2 text-gray-500 text-xs">{a.les.begintijd}–{a.les.eindtijd}</td>
                    <td className="py-2">
                      <span className={`inline-block text-xs rounded-full px-2 py-0.5 ${statusKleur[a.status]}`}>
                        {statusLabel[a.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
