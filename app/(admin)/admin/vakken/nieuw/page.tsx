import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { VakForm } from "@/components/vakken/VakForm";

export default function NieuwVakPage() {
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

      <Card>
        <CardHeader>
          <CardTitle>Nieuw vak aanmaken</CardTitle>
          <CardDescription>
            Voeg een nieuw vak toe aan het curriculum. Vakken kunnen daarna aan klassen worden gekoppeld.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VakForm mode="nieuw" />
        </CardContent>
      </Card>
    </div>
  );
}
