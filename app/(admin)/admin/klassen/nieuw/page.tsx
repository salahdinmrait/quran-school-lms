"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { klasSchema, type KlasFormData } from "@/lib/validations";

export default function NieuweKlasPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<KlasFormData>({
    resolver: zodResolver(klasSchema),
  });

  const onSubmit = async (data: KlasFormData) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/klassen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Onbekende fout");
      }

      toast.success("Klas aangemaakt");
      router.push("/admin/klassen");
      router.refresh();
    } catch (err) {
      toast.error(`Fout: ${err instanceof Error ? err.message : "Probeer opnieuw"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <Link
        href="/admin/klassen"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ChevronLeft className="h-4 w-4" />
        Terug naar klassen
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Nieuwe klas aanmaken</CardTitle>
          <CardDescription>
            Maak een nieuwe klas aan. Docenten, leerlingen en vakken koppel je daarna via de klasdetailpagina.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="naam">Naam <span className="text-red-500">*</span></Label>
              <Input id="naam" placeholder="bijv. Klas 1A, Gevorderd Tajweed" {...register("naam")} />
              {errors.naam && <p className="text-xs text-red-600">{errors.naam.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="beschrijving">Beschrijving (optioneel)</Label>
              <Textarea id="beschrijving" placeholder="Korte beschrijving van de klas..." {...register("beschrijving")} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Klas aanmaken
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/admin/klassen")}>
                Annuleren
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
