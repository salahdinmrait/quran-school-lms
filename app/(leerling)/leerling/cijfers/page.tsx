import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VakBadge } from "@/components/vakken/VakBadge";
import { formatDate } from "@/lib/utils";

export default async function CijfersPage() {
  const session = await auth();
  const leerlingId = session!.user.id;

  const cijfers = await prisma.cijfer.findMany({
    where: { leerlingId },
    orderBy: { datum: "desc" },
    include: { vak: true },
  });

  // Groepeer per vak
  const perVak: Record<string, typeof cijfers> = {};
  for (const c of cijfers) {
    if (!perVak[c.vakId]) perVak[c.vakId] = [];
    perVak[c.vakId].push(c);
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cijfers & voortgang</h1>
        <p className="text-gray-500 mt-1 text-sm">Overzicht van al uw beoordelingen per vak.</p>
      </div>

      {cijfers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-400 text-sm">
            Nog geen beoordelingen ingevoerd.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(perVak).map(([, vakCijfers]) => {
            const vak = vakCijfers[0].vak;
            const gem = vakCijfers.reduce((s, c) => s + c.waarde, 0) / vakCijfers.length;
            return (
              <Card key={vak.id}>
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{vak.naam}</CardTitle>
                    <VakBadge categorie={vak.categorie as "HIFZ" | "TAJWEED" | "ARABISCH" | "FIQH" | "SIRA" | "OVERIG"} />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Gemiddelde</p>
                    <p className={`text-lg font-bold ${gem >= 5.5 ? "text-green-700" : "text-red-600"}`}>
                      {gem.toFixed(1)}
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-1 text-xs text-gray-400 font-medium">Datum</th>
                        <th className="text-left py-1 text-xs text-gray-400 font-medium">Omschrijving</th>
                        <th className="text-right py-1 text-xs text-gray-400 font-medium">Cijfer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vakCijfers.map((c) => (
                        <tr key={c.id} className="border-b border-gray-50">
                          <td className="py-1.5 text-gray-500 text-xs">{formatDate(c.datum)}</td>
                          <td className="py-1.5 text-gray-700">{c.omschrijving ?? "—"}</td>
                          <td className={`py-1.5 text-right font-semibold ${c.waarde >= 5.5 ? "text-green-700" : "text-red-600"}`}>
                            {c.waarde.toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
