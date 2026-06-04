"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Star, Plus, Trash2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VakBadge } from "@/components/vakken/VakBadge";
import { formatDate } from "@/lib/utils";

type VakCategorie = "HIFZ" | "TAJWEED" | "ARABISCH" | "FIQH" | "SIRA" | "OVERIG";

interface Vak {
  id: string;
  naam: string;
  categorie: string;
}

interface Klas {
  id: string;
  naam: string;
  vakken: { vak: Vak }[];
  leerlingen: { leerling: { id: string; name: string } }[];
}

interface Les {
  id: string;
  klas: Klas;
}

interface Cijfer {
  id: string;
  waarde: number;
  omschrijving: string | null;
  datum: string;
  leerling: { id: string; name: string };
  vak: Vak;
}

export default function CijfersPage() {
  const [lessen, setLessen] = useState<Les[]>([]);
  const [cijfers, setCijfers] = useState<Cijfer[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    selectedKlasId: "",
    vakId: "",
    leerlingId: "",
    waarde: "",
    omschrijving: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/docent/lessen").then((r) => r.json()),
      fetch("/api/docent/cijfers").then((r) => r.json()),
    ]).then(([lesData, cijferData]) => {
      setLessen(Array.isArray(lesData) ? lesData : []);
      setCijfers(Array.isArray(cijferData) ? cijferData : []);
      setIsFetching(false);
    }).catch(() => setIsFetching(false));
  }, []);

  // Derive unique klassen
  const klassenMap = new Map<string, Klas>();
  for (const les of lessen) {
    if (!klassenMap.has(les.klas.id)) klassenMap.set(les.klas.id, les.klas);
  }
  const klassen = Array.from(klassenMap.values());

  const selectedKlas = klassen.find((k) => k.id === form.selectedKlasId);
  const vakkenForKlas = selectedKlas?.vakken.map((kv) => kv.vak) ?? [];
  const leerlingenForKlas = selectedKlas?.leerlingen.map((kl) => kl.leerling) ?? [];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "selectedKlasId") {
        next.vakId = "";
        next.leerlingId = "";
      }
      return next;
    });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(form.waarde);
    if (!form.vakId || !form.leerlingId || isNaN(num)) {
      toast.error("Vul alle verplichte velden correct in.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/docent/cijfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leerlingId: form.leerlingId,
          vakId: form.vakId,
          waarde: num,
          omschrijving: form.omschrijving || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Cijfer opgeslagen.");
      setCijfers((prev) => [data, ...prev]);
      setForm({ selectedKlasId: form.selectedKlasId, vakId: "", leerlingId: "", waarde: "", omschrijving: "" });
      setShowForm(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Opslaan mislukt.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Cijfer verwijderen?")) return;
    try {
      const res = await fetch(`/api/docent/cijfers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Verwijderd.");
      setCijfers((prev) => prev.filter((c) => c.id !== id));
    } catch {
      toast.error("Verwijderen mislukt.");
    }
  }

  if (isFetching) {
    return (
      <div className="p-6 flex items-center gap-2 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Laden…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cijfers invoeren</h1>
          <p className="text-gray-500 mt-1 text-sm">Beoordelingen registreren per leerling en vak.</p>
        </div>
        <Button
          onClick={() => setShowForm((v) => !v)}
          className="bg-green-700 hover:bg-green-800 text-white"
        >
          {showForm ? <ChevronUp className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          {showForm ? "Sluiten" : "Cijfer toevoegen"}
        </Button>
      </div>

      {/* Formulier */}
      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base text-gray-900">Nieuw cijfer</CardTitle>
          </CardHeader>
          <CardContent>
            {klassen.length === 0 ? (
              <p className="text-sm text-gray-500">
                U bent nog niet aan een klas gekoppeld.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Klas */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Klas</label>
                  <select
                    name="selectedKlasId"
                    value={form.selectedKlasId}
                    onChange={handleChange}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">— Selecteer klas —</option>
                    {klassen.map((k) => (
                      <option key={k.id} value={k.id}>{k.naam}</option>
                    ))}
                  </select>
                </div>

                {form.selectedKlasId && (
                  <>
                    {/* Vak */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Vak <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="vakId"
                        value={form.vakId}
                        onChange={handleChange}
                        required
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">— Selecteer vak —</option>
                        {vakkenForKlas.map((v) => (
                          <option key={v.id} value={v.id}>{v.naam}</option>
                        ))}
                      </select>
                    </div>

                    {/* Leerling */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Leerling <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="leerlingId"
                        value={form.leerlingId}
                        onChange={handleChange}
                        required
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">— Selecteer leerling —</option>
                        {leerlingenForKlas.map((l) => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Cijfer */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cijfer (1–10) <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="number"
                        name="waarde"
                        value={form.waarde}
                        onChange={handleChange}
                        min="1"
                        max="10"
                        step="0.1"
                        placeholder="bijv. 7.5"
                        required
                      />
                    </div>

                    {/* Omschrijving */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Omschrijving
                      </label>
                      <Input
                        name="omschrijving"
                        value={form.omschrijving}
                        onChange={handleChange}
                        placeholder="bijv. Toets recitatie"
                      />
                    </div>

                    <div className="sm:col-span-2 flex gap-3 pt-2">
                      <Button
                        type="submit"
                        disabled={saving}
                        className="bg-green-700 hover:bg-green-800 text-white"
                      >
                        {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                        Opslaan
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                        Annuleren
                      </Button>
                    </div>
                  </>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* Overzicht */}
      {cijfers.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-400 text-sm">
            <Star className="h-10 w-10 mx-auto mb-2 opacity-30" />
            Nog geen cijfers ingevoerd.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-gray-900">
              Ingevoerde cijfers ({cijfers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Leerling</th>
                  <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Vak</th>
                  <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Omschrijving</th>
                  <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Datum</th>
                  <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Cijfer</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {cijfers.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 text-gray-800 font-medium">{c.leerling.name}</td>
                    <td className="px-4 py-2.5">
                      <VakBadge categorie={c.vak.categorie as VakCategorie} />
                      <span className="ml-2 text-xs text-gray-500">{c.vak.naam}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{c.omschrijving ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{formatDate(c.datum)}</td>
                    <td className={`px-4 py-2.5 text-right font-bold ${c.waarde >= 5.5 ? "text-green-700" : "text-red-600"}`}>
                      {c.waarde.toFixed(1)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
