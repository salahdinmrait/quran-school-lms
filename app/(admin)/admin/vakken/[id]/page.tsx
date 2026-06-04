import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { VakForm } from "@/components/vakken/VakForm";
import VakVerwijderenKnop from "./VakVerwijderenKnop";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BewerkVakPage({ params }: Props) {
  const { id } = await params;

  const vak = await prisma.vak.findUnique({
    where: { id },
    include: { _count: { select: { klassen: true } } },
  });

  if (!vak) notFound();

  return (
    <div className="p-6 max-w-2xl">
      {/* Breadcrumb */}
      <Link
        href="/admin/vakken"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ChevronLeft className="h-4 w-4" />
        Terug naar vakken
      </Link>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Vak bewerken</CardTitle>
          <CardDescription>
            Pas de gegevens van <strong>{vak.naam}</strong> aan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VakForm
            mode="bewerken"
            vakId={vak.id}
            defaultValues={{
              naam: vak.naam,
              categorie: vak.categorie as "HIFZ" | "TAJWEED" | "ARABISCH" | "FIQH" | "SIRA" | "OVERIG",
              beschrijving: vak.beschrijving ?? "",
            }}
          />
        </CardContent>
      </Card>

      {/* Verwijderen sectie */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-700 text-base">Gevarenzone</CardTitle>
          <CardDescription>
            {vak._count.klassen > 0
              ? `Dit vak is gekoppeld aan ${vak._count.klassen} klas${vak._count.klassen !== 1 ? "sen" : ""}. Verwijder eerst de klassenkoppelingen om dit vak te kunnen verwijderen.`
              : "Verwijder dit vak permanent. Dit kan niet ongedaan worden gemaakt."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VakVerwijderenKnop
            vakId={vak.id}
            vakNaam={vak.naam}
            heeftKlassen={vak._count.klassen > 0}
          />
        </CardContent>
      </Card>
    </div>
  );
}
