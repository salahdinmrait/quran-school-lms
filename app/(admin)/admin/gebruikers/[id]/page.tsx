"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft, Loader2, KeyRound, Eye, EyeOff, Link2, Unlink, UserPlus } from "lucide-react";
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
  role: z.enum(["ADMIN", "DOCENT", "LEERLING", "OUDER"]),
  actief: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface Leerling { id: string; name: string; email: string; }

export default function BewerkGebruikerPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [userName, setUserName] = useState("");

  // Password change state
  const [nieuwWachtwoord, setNieuwWachtwoord] = useState("");
  const [bevestigWachtwoord, setBevestigWachtwoord] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  // Ouder-leerling koppeling state
  const [gekoppeld, setGekoppeld] = useState<Leerling[]>([]);
  const [alleLeerlingen, setAlleLeerlingen] = useState<Leerling[]>([]);
  const [koppelZoek, setKoppelZoek] = useState("");
  const [koppelIds, setKoppelIds] = useState<string[]>([]);
  const [koppeling, setKoppeling] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const selectedRole = watch("role");
  const isActief = watch("actief");

  // Load user info
  useEffect(() => {
    fetch(`/api/gebruikers/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setValue("name", data.name);
        setValue("email", data.email);
        setValue("role", data.role);
        setValue("actief", data.actief);
        setUserName(data.name);
        setIsFetching(false);
      })
      .catch(() => {
        toast.error("Kon gebruiker niet laden");
        setIsFetching(false);
      });
  }, [id, setValue]);

  // Load ouder koppeling data when role is OUDER
  useEffect(() => {
    if (selectedRole !== "OUDER") return;

    Promise.all([
      fetch(`/api/ouder/koppeling?ouderId=${id}`).then((r) => r.json()),
      fetch("/api/gebruikers?role=LEERLING").then((r) => r.json()),
    ]).then(([linked, alle]) => {
      setGekoppeld(Array.isArray(linked) ? linked : []);
      const linkedIds = new Set(Array.isArray(linked) ? linked.map((l: Leerling) => l.id) : []);
      const leerlingen = (Array.isArray(alle) ? alle : []).filter(
        (u: { id: string; role: string }) => u.role === "LEERLING" && !linkedIds.has(u.id)
      );
      setAlleLeerlingen(leerlingen);
    }).catch(() => {
      // silently fail — non-critical
    });
  }, [id, selectedRole]);

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/gebruikers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Onbekende fout");
      }
      toast.success("Gebruiker bijgewerkt");
      router.push("/admin/gebruikers");
      router.refresh();
    } catch (err) {
      toast.error(`Fout: ${err instanceof Error ? err.message : "Probeer opnieuw"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!nieuwWachtwoord) { toast.error("Vul een nieuw wachtwoord in."); return; }
    if (nieuwWachtwoord.length < 8) { toast.error("Wachtwoord moet minimaal 8 tekens hebben."); return; }
    if (nieuwWachtwoord !== bevestigWachtwoord) { toast.error("Wachtwoorden komen niet overeen."); return; }
    setSavingPw(true);
    try {
      const infoRes = await fetch(`/api/gebruikers/${id}`);
      const info = await infoRes.json();
      const res = await fetch(`/api/gebruikers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: info.name, email: info.email, role: info.role, actief: info.actief,
          nieuwWachtwoord,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Onbekende fout");
      }
      toast.success("Wachtwoord gewijzigd.");
      setNieuwWachtwoord("");
      setBevestigWachtwoord("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Wachtwoord wijzigen mislukt.");
    } finally {
      setSavingPw(false);
    }
  };

  // Met 100+ leerlingen tonen we ze niet allemaal: pas na het typen van een
  // zoekterm verschijnt er een korte trefferlijst.
  const koppelQ = koppelZoek.trim().toLowerCase();
  const kandidaten = alleLeerlingen.filter((l) => !koppelIds.includes(l.id));
  const alleTreffers = koppelQ
    ? kandidaten.filter(
        (l) => l.name.toLowerCase().includes(koppelQ) || l.email.toLowerCase().includes(koppelQ)
      )
    : [];
  const treffers = alleTreffers.slice(0, 8);
  const restTreffers = alleTreffers.length - treffers.length;
  const geselecteerd = koppelIds
    .map((kid) => alleLeerlingen.find((l) => l.id === kid))
    .filter((l): l is Leerling => !!l);

  const handleKoppel = async () => {
    if (koppelIds.length === 0) return;
    setKoppeling(true);

    // Per kind apart: één kind kan al aan een andere ouder hangen (409) en dat
    // mag de rest van de selectie niet blokkeren.
    const gelukt: Leerling[] = [];
    const mislukt: string[] = [];
    for (const kind of geselecteerd) {
      try {
        const res = await fetch("/api/ouder/koppeling", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ouderId: id, leerlingId: kind.id }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        gelukt.push(kind);
      } catch (err) {
        mislukt.push(`${kind.name}: ${err instanceof Error ? err.message : "koppelen mislukt"}`);
      }
    }

    if (gelukt.length > 0) {
      const geluktIds = new Set(gelukt.map((g) => g.id));
      setGekoppeld((prev) => [...prev, ...gelukt].sort((a, b) => a.name.localeCompare(b.name)));
      setAlleLeerlingen((prev) => prev.filter((l) => !geluktIds.has(l.id)));
      setKoppelIds((prev) => prev.filter((kid) => !geluktIds.has(kid)));
      toast.success(gelukt.length === 1 ? "Kind gekoppeld." : `${gelukt.length} kinderen gekoppeld.`);
    }
    setKoppelZoek("");
    for (const m of mislukt) toast.error(m);
    setKoppeling(false);
  };

  const handleOntkoppel = async (leerlingId: string) => {
    try {
      const res = await fetch("/api/ouder/koppeling", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ouderId: id, leerlingId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const verwijderd = gekoppeld.find((l) => l.id === leerlingId);
      if (verwijderd) {
        setGekoppeld((prev) => prev.filter((l) => l.id !== leerlingId));
        setAlleLeerlingen((prev) => [...prev, verwijderd].sort((a, b) => a.name.localeCompare(b.name)));
      }
      toast.success("Koppeling verwijderd.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ontkoppelen mislukt.");
    }
  };

  if (isFetching) {
    return (
      <div className="p-6 flex items-center gap-2 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Laden...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <Link
        href="/admin/gebruikers"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ChevronLeft className="h-4 w-4" />
        Terug naar gebruikers
      </Link>

      {/* ── Gegevens ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Gebruiker bewerken</CardTitle>
          <CardDescription>Pas de gegevens van <strong>{userName}</strong> aan.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Volledige naam <span className="text-red-500">*</span></Label>
              <Input id="name" {...register("name")} />
              {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mailadres <span className="text-red-500">*</span></Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={selectedRole} onValueChange={(val) => setValue("role", val as FormData["role"])}>
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

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={isActief ? "actief" : "inactief"}
                onValueChange={(val) => setValue("actief", val === "actief")}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="actief">Actief</SelectItem>
                  <SelectItem value="inactief">Inactief (gedeactiveerd)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Wijzigingen opslaan
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/admin/gebruikers")}>
                Annuleren
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Wachtwoord wijzigen ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-green-700" />
            Wachtwoord wijzigen
          </CardTitle>
          <CardDescription>
            Stel een nieuw wachtwoord in voor {userName}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nieuwWachtwoord">Nieuw wachtwoord</Label>
              <div className="relative">
                <Input
                  id="nieuwWachtwoord"
                  type={showPw ? "text" : "password"}
                  value={nieuwWachtwoord}
                  onChange={(e) => setNieuwWachtwoord(e.target.value)}
                  placeholder="Minimaal 8 tekens"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bevestigWachtwoord">Bevestig wachtwoord</Label>
              <Input
                id="bevestigWachtwoord"
                type={showPw ? "text" : "password"}
                value={bevestigWachtwoord}
                onChange={(e) => setBevestigWachtwoord(e.target.value)}
                placeholder="Herhaal het nieuwe wachtwoord"
              />
              {bevestigWachtwoord && nieuwWachtwoord !== bevestigWachtwoord && (
                <p className="text-xs text-red-600">Wachtwoorden komen niet overeen.</p>
              )}
            </div>
            <Button
              type="button"
              onClick={handlePasswordReset}
              disabled={savingPw || !nieuwWachtwoord || nieuwWachtwoord !== bevestigWachtwoord}
              className="bg-green-700 hover:bg-green-800 text-white"
            >
              {savingPw && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Wachtwoord opslaan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Ouder: gekoppelde kinderen ─────────────────────────────── */}
      {selectedRole === "OUDER" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-green-700" />
              Gekoppelde kinderen
            </CardTitle>
            <CardDescription>
              Koppel leerlingen aan dit ouder-account zodat de ouder hun voortgang kan inzien.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current links */}
            {gekoppeld.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Nog geen kinderen gekoppeld.</p>
            ) : (
              <ul className="space-y-2">
                {gekoppeld.map((kind) => (
                  <li key={kind.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{kind.name}</p>
                      <p className="text-xs text-gray-500">{kind.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOntkoppel(kind.id)}
                      className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                      Ontkoppelen
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Add new link */}
            {alleLeerlingen.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <Label htmlFor="koppelZoek">Kind koppelen</Label>
                <Input
                  id="koppelZoek"
                  value={koppelZoek}
                  onChange={(e) => setKoppelZoek(e.target.value)}
                  placeholder="Zoek op naam of e-mail…"
                  autoComplete="off"
                />

                {koppelQ.length > 0 && (
                  treffers.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Geen leerling gevonden.</p>
                  ) : (
                    <ul className="rounded-md border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                      {treffers.map((l) => (
                        <li key={l.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setKoppelIds((prev) => [...prev, l.id]);
                              setKoppelZoek("");
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-green-50 focus:bg-green-50 focus:outline-none"
                          >
                            <span className="block text-sm text-gray-900">{l.name}</span>
                            <span className="block text-xs text-gray-500">{l.email}</span>
                          </button>
                        </li>
                      ))}
                      {restTreffers > 0 && (
                        <li className="px-3 py-2 text-xs text-gray-400">
                          Nog {restTreffers} andere{restTreffers === 1 ? "" : "n"} — typ verder om te verfijnen.
                        </li>
                      )}
                    </ul>
                  )
                )}

                {geselecteerd.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {geselecteerd.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setKoppelIds((prev) => prev.filter((kid) => kid !== l.id))}
                        className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800 hover:bg-green-100"
                      >
                        {l.name} ✕
                      </button>
                    ))}
                  </div>
                )}

                <Button
                  type="button"
                  onClick={handleKoppel}
                  disabled={geselecteerd.length === 0 || koppeling}
                  className="bg-green-700 hover:bg-green-800 text-white"
                >
                  {koppeling
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <UserPlus className="h-4 w-4" />
                  }
                  {geselecteerd.length > 1 ? `${geselecteerd.length} kinderen koppelen` : "Koppelen"}
                </Button>
              </div>
            )}

            {alleLeerlingen.length === 0 && gekoppeld.length > 0 && (
              <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
                Alle leerlingen zijn al gekoppeld.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
