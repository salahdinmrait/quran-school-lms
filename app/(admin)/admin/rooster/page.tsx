import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import RoosterClient from "./RoosterClient";

export default async function RoosterPage() {
  const session = await auth();
  const schoolId = session?.user?.schoolId ?? null;

  const [lessen, klassen] = await Promise.all([
    prisma.les.findMany({
      where: { klas: { schoolId } },
      orderBy: [{ datum: "asc" }, { begintijd: "asc" }],
      include: { klas: true },
    }),
    prisma.klas.findMany({ where: { schoolId }, orderBy: { naam: "asc" } }),
  ]);

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Rooster</h1>
        <p className="text-gray-500 mt-1 text-sm">Lessen aanmaken en beheren per klas.</p>
      </div>
      <RoosterClient
        lessen={lessen.map((l) => ({
          id: l.id,
          datum: l.datum.toISOString(),
          begintijd: l.begintijd,
          eindtijd: l.eindtijd,
          lokaal: l.lokaal,
          klasId: l.klasId,
          klasNaam: l.klas.naam,
        }))}
        klassen={klassen.map((k) => ({ id: k.id, naam: k.naam }))}
      />
    </div>
  );
}
