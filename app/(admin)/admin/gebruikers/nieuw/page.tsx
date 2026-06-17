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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2, "Naam moet minimaal 2 tekens bevatten"),
  email: z.string().email("Ongeldig e-mailadres"),
  password: z.string().min(8, "Wachtwoord moet minimaal 8 tekens bevatten"),
  role: z.enum(["ADMIN", "DOCENT", "LEERLING", "OUDER"]),
  isVolwassen: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NieuweGebruikerPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: "LEERLING" },
  });

  const selectedRole = watch("role");
  const isVolwassen = watch("isVolwassen");

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/gebruikers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Onbekende fout");
      }

      toast.success("Gebruiker aangemaakt");
      router.push("/admin/gebruikers");
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
        href="/admin/gebruikers"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ChevronLeft className="h-4 w-4" />
        Terug naar gebruikers
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Nieuwe gebruiker aanmaken</CardTitle>
          <CardDescription>
            Maak een nieuw account aan voor een leerling, docent of beheerder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Volledige naam <span className="text-red-500">*</span></Label>
              <Input id="name" placeholder="bijv. Ahmed Al-Rashid" {...register("name")} />
              {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mailadres <span className="text-red-500">*</span></Label>
              <Input id="email" type="email" placeholder="naam@school.nl" {...register("email")} />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Wachtwoord <span className="text-red-500">*</span></Label>
              <Input id="password" type="password" placeholder="Minimaal 8 tekens" {...register("password")} />
              {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Rol <span className="text-red-500">*</span></Label>
              <Select
                value={selectedRole}
                onValueChange={(val) => setValue("role", val as FormData["role"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LEERLING">Leerling</SelectItem>
                  <SelectItem value="OUDER">Ouder</SelectItem>
                  <SelectItem value="DOCENT">Docent</SelectItem>
                  <SelectItem value="ADMIN">Beheerder</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedRole === "LEERLING" && (
              <label className="flex items-start gap-2 rounded-md border border-gray-200 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!isVolwassen}
                  onChange={(e) => setValue("isVolwassen", e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-green-700 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">
                  <span className="font-medium">18+ zonder ouder-account</span>
                  <br />
                  <span className="text-xs text-gray-500">
                    Een zelfstandige leerling van 18 jaar of ouder mag zelf gesprekken starten met docenten en het beheer.
                  </span>
                </span>
              </label>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Gebruiker aanmaken
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/admin/gebruikers")}>
                Annuleren
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
