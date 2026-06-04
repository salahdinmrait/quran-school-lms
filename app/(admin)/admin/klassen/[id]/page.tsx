import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import KlasBeheerClient from "./KlasBeheerClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function KlasDetailPage({ params }: Props) {
  const { id } = await params;

  const [klas, alleLeerlingen, alleDocenten, alleVakken] = await Promise.all([
    prisma.klas.findUnique({
      where: { id },
      include: {
        docenten: { include: { docent: { select: { id: true, name: true, email: true } } } },
        leerlingen: { include: { leerling: { select: { id: true, name: true, email: true } } } },
        vakken: { include: { vak: true } },
      },
    }),
    prisma.user.findMany({ where: { role: "LEERLING", actief: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: "DOCENT", actief: true }, orderBy: { name: "asc" } }),
    prisma.vak.findMany({ orderBy: { naam: "asc" } }),
  ]);

  if (!klas) notFound();

  return (
    <div className="p-6 max-w-5xl">
      <Link
        href="/admin/klassen"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ChevronLeft className="h-4 w-4" />
        Terug naar klassen
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{klas.naam}</h1>
        {klas.beschrijving && <p className="text-gray-500 mt-1">{klas.beschrijving}</p>}
      </div>

      <KlasBeheerClient
        klasId={id}
        gekoppeldeLeerlingen={klas.leerlingen.map((kl) => ({
          id: kl.id,
          leerlingId: kl.leerlingId,
          name: kl.leerling.name,
          email: kl.leerling.email,
        }))}
        gekoppeldeDocenten={klas.docenten.map((kd) => ({
          id: kd.id,
          docentId: kd.docentId,
          name: kd.docent.name,
          email: kd.docent.email,
        }))}
        gekoppeldeVakken={klas.vakken.map((kv) => ({
          id: kv.id,
          vakId: kv.vakId,
          naam: kv.vak.naam,
          categorie: kv.vak.categorie,
        }))}
        alleLeerlingen={alleLeerlingen.map((l) => ({ id: l.id, name: l.name, email: l.email }))}
        alleDocenten={alleDocenten.map((d) => ({ id: d.id, name: d.name, email: d.email }))}
        alleVakken={alleVakken.map((v) => ({ id: v.id, naam: v.naam, categorie: v.categorie }))}
      />
    </div>
  );
}
