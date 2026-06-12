import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import KlassenClient from "./KlassenClient";

export default async function KlassenPage() {
  const session = await auth();
  const klassen = await prisma.klas.findMany({
    where: { schoolId: session?.user?.schoolId ?? null },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { leerlingen: true, docenten: true, vakken: true } },
    },
  });

  return (
    <div className="p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Klassen</h1>
          <p className="text-gray-500 mt-1 text-sm">Beheer alle klassen van de school.</p>
        </div>
        <Button asChild className="bg-green-700 hover:bg-green-800 text-white">
          <Link href="/admin/klassen/nieuw">
            <Plus className="h-4 w-4 mr-1" />
            Nieuwe klas
          </Link>
        </Button>
      </div>
      <KlassenClient
        klassen={klassen.map((k) => ({ ...k, createdAt: k.createdAt.toISOString() }))}
      />
    </div>
  );
}
