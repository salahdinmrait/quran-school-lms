"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calendar, Plus, Trash2, Clock, RepeatIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

interface Les {
  id: string;
  datum: string;
  begintijd: string;
  eindtijd: string;
  lokaal: string | null;
  klasId: string;
  klasNaam: string;
}

interface Klas {
  id: string;
  naam: string;
}

interface Props {
  lessen: Les[];
  klassen: Klas[];
}

export default function RoosterClient({ lessen, klassen }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    klasId: "",
    datum: "",
    begintijd: "",
    eindtijd: "",
    lokaal: "",
    beschrijving: "",
    herhalen: false,
    totDatum: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.klasId || !form.datum || !form.begintijd || !form.eindtijd) {
      toast.error("Vul alle verplichte velden in.");
      return;
    }
    if (form.herhalen && !form.totDatum) {
      toast.error("Geef een einddatum op voor de herhaling.");
      return;
    }
    if (form.herhalen && new Date(form.totDatum) <= new Date(form.datum)) {
      toast.error("Einddatum moet na de startdatum liggen.");
      return;
    }
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        klasId: form.klasId,
        datum: form.datum,
        begintijd: form.begintijd,
        eindtijd: form.eindtijd,
        lokaal: form.lokaal || null,
        beschrijving: form.beschrijving || null,
      };
      if (form.herhalen && form.totDatum) {
        body.herhalen = { totDatum: form.totDatum };
      }
      const res = await fetch("/api/lessen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(
        data.count === 1
          ? "Les aangemaakt."
          : `${data.count} herhalende lessen aangemaakt.`
      );
      setForm({ klasId: "", datum: "", begintijd: "", eindtijd: "", lokaal: "", beschrijving: "", herhalen: false, totDatum: "" });
      setShowForm(false);
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Aanmaken mislukt.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Les verwijderen?")) return;
    try {
      const res = await fetch(`/api/lessen/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Les verwijderd.");
      router.refresh();
    } catch {
      toast.error("Verwijderen mislukt.");
    }
  }

  // Group by date
  const grouped: Record<string, Les[]> = {};
  for (const les of lessen) {
    const key = les.datum.slice(0, 10);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(les);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          onClick={() => setShowForm((v) => !v)}
          className="bg-green-700 hover:bg-green-800 text-white"
        >
          <Plus className="h-4 w-4 mr-1" />
          Nieuwe les
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-gray-900">Les toevoegen</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Klas <span className="text-red-500">*</span>
                </label>
                <select
                  name="klasId"
                  value={form.klasId}
                  onChange={handleChange}
                  required
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">— Selecteer een klas —</option>
                  {klassen.map((k) => (
                    <option key={k.id} value={k.id}>{k.naam}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Datum <span className="text-red-500">*</span>
                </label>
                <Input type="date" name="datum" value={form.datum} onChange={handleChange} required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lokaal</label>
                <Input type="text" name="lokaal" placeholder="bijv. A101" value={form.lokaal} onChange={handleChange} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Begintijd <span className="text-red-500">*</span>
                </label>
                <Input type="time" name="begintijd" value={form.begintijd} onChange={handleChange} required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Eindtijd <span className="text-red-500">*</span>
                </label>
                <Input type="time" name="eindtijd" value={form.eindtijd} onChange={handleChange} required />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Omschrijving / opmerking</label>
                <textarea
                  name="beschrijving"
                  value={form.beschrijving}
                  onChange={handleChange}
                  rows={2}
                  placeholder="bijv. Neem soera Al-Mulk door voor deze les"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Repeating toggle */}
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="herhalen"
                    checked={form.herhalen}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-green-700 focus:ring-green-500"
                  />
                  <RepeatIcon className="h-4 w-4 text-green-700" />
                  <span className="text-sm font-medium text-gray-700">
                    Wekelijks herhalen
                  </span>
                </label>
                {form.herhalen && (
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    Elke week op dezelfde dag als &ldquo;{form.datum
                      ? new Date(form.datum + "T00:00:00").toLocaleDateString("nl-NL", { weekday: "long" })
                      : "geselecteerde dag"}&rdquo;, tot en met de einddatum hieronder.
                  </p>
                )}
              </div>

              {form.herhalen && (
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Herhalen tot en met <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    name="totDatum"
                    value={form.totDatum}
                    onChange={handleChange}
                    min={form.datum}
                    required={form.herhalen}
                  />
                </div>
              )}

              <div className="sm:col-span-2 flex gap-3">
                <Button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
                  {loading ? "Opslaan…" : form.herhalen ? "Herhalende lessen aanmaken" : "Les aanmaken"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Annuleren
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {lessen.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-400 text-sm">
            <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
            Nog geen lessen gepland.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([date, dagLessen]) => (
            <div key={date}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {formatDate(date)}
              </h2>
              <div className="space-y-2">
                {dagLessen.map((les) => (
                  <Card key={les.id}>
                    <CardContent className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                          <Clock className="h-4 w-4 text-green-700" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{les.klasNaam}</p>
                          <p className="text-xs text-gray-500">
                            {les.begintijd} – {les.eindtijd}
                            {les.lokaal && ` · Lokaal ${les.lokaal}`}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(les.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
