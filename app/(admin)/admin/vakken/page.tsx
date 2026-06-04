import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VakkenTabel } from "@/components/vakken/VakkenTabel";

export default async function VakkenPage() {
  const vakken = await prisma.vak.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { klassen: true } },
    },
  });

  // Serialise dates to strings for client component
  const vakkenData = vakken.map((v) => ({
    id: v.id,
    naam: v.naam,
    categorie: v.categorie,
    beschrijving: v.beschrijving,
    createdAt: v.createdAt.toISOString(),
    _count: v._count,
  }));

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vakken</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Beheer alle vakken van de school.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/vakken/nieuw">
            <Plus className="h-4 w-4" />
            Nieuw vak aanmaken
          </Link>
        </Button>
      </div>

      {/* Tabel */}
      <VakkenTabel vakken={vakkenData} />
    </div>
  );
}
