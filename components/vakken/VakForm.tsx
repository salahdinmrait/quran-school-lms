"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { vakSchema, type VakFormData } from "@/lib/validations";

const categorieOpties = [
  { value: "HIFZ", label: "Hifz — Quran memorisatie" },
  { value: "TAJWEED", label: "Tajweed — Recitatieregels" },
  { value: "ARABISCH", label: "Arabisch — Arabische taal" },
  { value: "FIQH", label: "Fiqh — Islamitische jurisprudentie" },
  { value: "SIRA", label: "Sira — Profetbiografie" },
  { value: "OVERIG", label: "Overig" },
];

interface VakFormProps {
  defaultValues?: Partial<VakFormData>;
  vakId?: string;
  mode: "nieuw" | "bewerken";
}

export function VakForm({ defaultValues, vakId, mode }: VakFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VakFormData>({
    resolver: zodResolver(vakSchema),
    defaultValues: {
      naam: defaultValues?.naam ?? "",
      categorie: defaultValues?.categorie,
      beschrijving: defaultValues?.beschrijving ?? "",
    },
  });

  const selectedCategorie = watch("categorie");

  const onSubmit = async (data: VakFormData) => {
    setIsLoading(true);
    try {
      const url = mode === "nieuw" ? "/api/vakken" : `/api/vakken/${vakId}`;
      const method = mode === "nieuw" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Onbekende fout");
      }

      toast.success(mode === "nieuw" ? "Vak aangemaakt" : "Vak bijgewerkt");
      router.push("/admin/vakken");
      router.refresh();
    } catch (err) {
      toast.error(`Fout: ${err instanceof Error ? err.message : "Probeer opnieuw"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Naam */}
      <div className="space-y-2">
        <Label htmlFor="naam">
          Vaknaam <span className="text-red-500">*</span>
        </Label>
        <Input
          id="naam"
          placeholder="bijv. Hifz Juz 3, Tajweed Intermediair"
          {...register("naam")}
        />
        {errors.naam && (
          <p className="text-xs text-red-600">{errors.naam.message}</p>
        )}
      </div>

      {/* Categorie */}
      <div className="space-y-2">
        <Label htmlFor="categorie">
          Categorie <span className="text-red-500">*</span>
        </Label>
        <Select
          value={selectedCategorie}
          onValueChange={(val) => setValue("categorie", val as VakFormData["categorie"], { shouldValidate: true })}
        >
          <SelectTrigger id="categorie">
            <SelectValue placeholder="Selecteer een categorie" />
          </SelectTrigger>
          <SelectContent>
            {categorieOpties.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.categorie && (
          <p className="text-xs text-red-600">{errors.categorie.message}</p>
        )}
      </div>

      {/* Beschrijving */}
      <div className="space-y-2">
        <Label htmlFor="beschrijving">Beschrijving (optioneel)</Label>
        <Textarea
          id="beschrijving"
          placeholder="Voeg een korte beschrijving toe..."
          rows={3}
          {...register("beschrijving")}
        />
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "nieuw" ? "Vak aanmaken" : "Wijzigingen opslaan"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/vakken")}
          disabled={isLoading}
        >
          Annuleren
        </Button>
      </div>
    </form>
  );
}
