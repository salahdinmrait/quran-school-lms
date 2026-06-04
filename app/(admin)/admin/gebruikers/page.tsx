import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import GebruikersClient from "./GebruikersClient";

export default async function GebruikersPage() {
  const gebruikers = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, role: true, actief: true, createdAt: true },
  });

  return (
    <div className="p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gebruikers</h1>
          <p className="text-gray-500 mt-1 text-sm">Beheer alle gebruikers van de school.</p>
        </div>
        <Button asChild className="bg-green-700 hover:bg-green-800 text-white">
          <Link href="/admin/gebruikers/nieuw">
            <Plus className="h-4 w-4 mr-1" />
            Nieuwe gebruiker
          </Link>
        </Button>
      </div>
      <GebruikersClient
        gebruikers={gebruikers.map((g) => ({ ...g, createdAt: g.createdAt.toISOString() }))}
      />
    </div>
  );
}
