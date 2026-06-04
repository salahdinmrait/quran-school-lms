"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

const rolLabel: Record<string, string> = {
  ADMIN: "Beheerder", DOCENT: "Docent", LEERLING: "Leerling", OUDER: "Ouder",
};
const rolKleur: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-800",
  DOCENT: "bg-blue-100 text-blue-800",
  LEERLING: "bg-green-100 text-green-800",
  OUDER: "bg-amber-100 text-amber-800",
};

interface Gebruiker {
  id: string; name: string; email: string;
  role: string; actief: boolean; createdAt: string;
}

export default function GebruikersClient({ gebruikers: init }: { gebruikers: Gebruiker[] }) {
  const router = useRouter();
  const [gebruikers, setGebruikers] = useState(init);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Gebruiker "${name}" definitief verwijderen?`)) return;
    try {
      const res = await fetch(`/api/gebruikers/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Gebruiker verwijderd.");
      setGebruikers((prev) => prev.filter((g) => g.id !== id));
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
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">E-mail</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Aangemaakt</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acties</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {gebruikers.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                Nog geen gebruikers aangemaakt.
              </td>
            </tr>
          ) : (
            gebruikers.map((g) => (
              <tr key={g.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-gray-900">{g.name}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-gray-600">{g.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${rolKleur[g.role] ?? "bg-gray-100 text-gray-700"}`}>
                    {rolLabel[g.role] ?? g.role}
                  </span>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${g.actief ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {g.actief ? "Actief" : "Inactief"}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-sm text-gray-500">{formatDate(g.createdAt)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/gebruikers/${g.id}`}>Bewerken</Link>
                    </Button>
                    <button
                      onClick={() => handleDelete(g.id, g.name)}
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
