"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

interface Klas {
  id: string; naam: string; beschrijving: string | null;
  createdAt: string;
  _count: { leerlingen: number; docenten: number; vakken: number };
}

export default function KlassenClient({ klassen: init }: { klassen: Klas[] }) {
  const router = useRouter();
  const [klassen, setKlassen] = useState(init);

  async function handleDelete(id: string, naam: string) {
    if (!confirm(`Klas "${naam}" verwijderen? Dit verwijdert ook alle gekoppelde lessen, huiswerk en aanwezigheid.`)) return;
    try {
      const res = await fetch(`/api/klassen/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Klas verwijderd.");
      setKlassen((prev) => prev.filter((k) => k.id !== id));
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Verwijderen mislukt.");
    }
  }

  return (
    <div className="rounded-md border border-gray-200 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Naam</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Leerlingen</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Docenten</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Vakken</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Aangemaakt</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acties</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {klassen.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                Nog geen klassen aangemaakt.
              </td>
            </tr>
          ) : (
            klassen.map((klas) => (
              <tr key={klas.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{klas.naam}</p>
                    {klas.beschrijving && (
                      <p className="text-xs text-gray-400 truncate max-w-xs mt-0.5">{klas.beschrijving}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className="text-sm text-gray-600">{klas._count.leerlingen}</span>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className="text-sm text-gray-600">{klas._count.docenten}</span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-sm text-gray-600">{klas._count.vakken}</span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-sm text-gray-500">{formatDate(klas.createdAt)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/klassen/${klas.id}`}>Beheren</Link>
                    </Button>
                    <button
                      onClick={() => handleDelete(klas.id, klas.naam)}
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                      title="Verwijderen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
