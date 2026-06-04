"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { VakBadge } from "@/components/vakken/VakBadge";
import { formatDate } from "@/lib/utils";

type VakCategorie = "HIFZ" | "TAJWEED" | "ARABISCH" | "FIQH" | "SIRA" | "OVERIG";

interface Vak {
  id: string;
  naam: string;
  categorie: string;
  beschrijving: string | null;
  createdAt: string;
  _count: { klassen: number };
}

interface VakkenTabelProps {
  vakken: Vak[];
}

const CATEGORIE_LABELS: Record<string, string> = {
  HIFZ: "Hifz",
  TAJWEED: "Tajweed",
  ARABISCH: "Arabisch",
  FIQH: "Fiqh",
  SIRA: "Sira",
  OVERIG: "Overig",
};

export function VakkenTabel({ vakken }: VakkenTabelProps) {
  const router = useRouter();
  const [zoekterm, setZoekterm] = useState("");
  const [categorieFilter, setCategorieFilter] = useState<string>("ALLE");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const gefilterd = vakken.filter((vak) => {
    const zoekMatch =
      zoekterm === "" ||
      vak.naam.toLowerCase().includes(zoekterm.toLowerCase());
    const categorieMatch =
      categorieFilter === "ALLE" || vak.categorie === categorieFilter;
    return zoekMatch && categorieMatch;
  });

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/vakken/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Verwijderen mislukt");
      } else {
        toast.success("Vak verwijderd");
        router.refresh();
      }
    } catch {
      toast.error("Fout bij verwijderen");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Zoek op vaknaam..."
            value={zoekterm}
            onChange={(e) => setZoekterm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categorieFilter} onValueChange={setCategorieFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Alle categorieën" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALLE">Alle categorieën</SelectItem>
            {Object.entries(CATEGORIE_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vaknaam
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Categorie
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                Klassen
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                Aangemaakt
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acties
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {gefilterd.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                  {vakken.length === 0
                    ? "Nog geen vakken aangemaakt. Klik op 'Nieuw vak aanmaken' om te beginnen."
                    : "Geen vakken gevonden voor de geselecteerde filters."}
                </td>
              </tr>
            ) : (
              gefilterd.map((vak) => (
                <tr key={vak.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{vak.naam}</p>
                      {vak.beschrijving && (
                        <p className="text-xs text-gray-400 truncate max-w-xs mt-0.5">
                          {vak.beschrijving}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <VakBadge categorie={vak.categorie as VakCategorie} />
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-sm text-gray-600">
                      {vak._count.klassen} klas{vak._count.klassen !== 1 ? "sen" : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-sm text-gray-500">
                      {formatDate(vak.createdAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/vakken/${vak.id}`}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Bewerken</span>
                        </Link>
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            disabled={deletingId === vak.id}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Verwijderen</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Vak verwijderen?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Weet u zeker dat u <strong>{vak.naam}</strong> wilt verwijderen?
                              {vak._count.klassen > 0 && (
                                <span className="block mt-2 text-amber-600">
                                  Let op: dit vak is gekoppeld aan {vak._count.klassen} klas{vak._count.klassen !== 1 ? "sen" : ""}.
                                  Verwijder eerst de klassenkoppelingen.
                                </span>
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuleren</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(vak.id)}
                              className="bg-red-600 hover:bg-red-700"
                              disabled={vak._count.klassen > 0}
                            >
                              Verwijderen
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        {gefilterd.length} van {vakken.length} vakken weergegeven
      </p>
    </div>
  );
}
