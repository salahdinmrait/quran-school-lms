"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  MessageSquare, Send, Inbox, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";
import { useLang } from "@/contexts/LanguageContext";

interface BerichtIn {
  id: string; onderwerp: string; inhoud: string; gelezen: boolean; createdAt: string;
  verzender: { id: string; name: string; role: string };
}
interface BerichtUit {
  id: string; onderwerp: string; inhoud: string; createdAt: string;
  ontvanger: { id: string; name: string; role: string };
}
interface Docent { id: string; name: string; }
interface Leerling {
  leerlingKlassen: { klas: { docenten: { docent: Docent }[] } }[];
}

export default function OuderBerichtenPage() {
  const { t } = useLang();
  const [inbox, setInbox] = useState<BerichtIn[]>([]);
  const [verzonden, setVerzonden] = useState<BerichtUit[]>([]);
  const [docenten, setDocenten] = useState<Docent[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [tab, setTab] = useState<"inbox" | "verzonden" | "nieuw">("inbox");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const [form, setForm] = useState({ ontvangerId: "", onderwerp: "", inhoud: "" });

  useEffect(() => {
    Promise.all([
      fetch("/api/ouder/berichten").then((r) => r.json()),
      fetch("/api/ouder/kind").then((r) => r.json()),
    ]).then(([berichtData, kinderData]) => {
      setInbox(berichtData.inbox ?? []);
      setVerzonden(berichtData.verzonden ?? []);
      // Extract docents from children's klassen
      const docentMap = new Map<string, Docent>();
      if (Array.isArray(kinderData)) {
        for (const kind of kinderData as Leerling[]) {
          for (const { klas } of kind.leerlingKlassen ?? []) {
            for (const { docent } of klas.docenten ?? []) {
              docentMap.set(docent.id, docent);
            }
          }
        }
      }
      setDocenten(Array.from(docentMap.values()));
      setIsFetching(false);
    }).catch(() => setIsFetching(false));
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!form.ontvangerId || !form.onderwerp || !form.inhoud) {
      toast.error(t("berichten_vul_in"));
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/ouder/berichten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(t("berichten_verstuurd"));
      setForm({ ontvangerId: "", onderwerp: "", inhoud: "" });
      setTab("inbox");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("berichten_mislukt"));
    } finally {
      setSending(false);
    }
  }

  const ongelezen = inbox.filter((b) => !b.gelezen).length;

  if (isFetching) {
    return (
      <div className="p-6 flex items-center gap-2 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("laden")}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("berichten_titel")}</h1>
        <p className="text-gray-500 mt-1 text-sm">{t("berichten_sub")}</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { key: "inbox", label: ongelezen > 0 ? `${t("berichten_inbox")} (${ongelezen})` : t("berichten_inbox"), icon: Inbox },
          { key: "verzonden", label: t("berichten_verzonden"), icon: Send },
          { key: "nieuw", label: t("berichten_nieuw"), icon: MessageSquare },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? "border-green-700 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "inbox" && (
        <div className="space-y-2">
          {inbox.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-gray-400 text-sm">{t("berichten_geen_inbox")}</CardContent></Card>
          ) : (
            inbox.map((b) => (
              <Card key={b.id} className={b.gelezen ? "opacity-70" : ""}>
                <CardContent className="py-3 px-4">
                  <button className="w-full text-left" onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {!b.gelezen && <span className="w-2 h-2 rounded-full bg-green-600 shrink-0" />}
                        <p className={`text-sm truncate ${!b.gelezen ? "font-semibold text-gray-900" : "text-gray-700"}`}>{b.onderwerp}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-400">{formatDate(b.createdAt)}</span>
                        <span className="text-xs text-gray-500">{b.verzender.name}</span>
                        {expandedId === b.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </div>
                    </div>
                  </button>
                  {expandedId === b.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{b.inhoud}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === "verzonden" && (
        <div className="space-y-2">
          {verzonden.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-gray-400 text-sm">{t("berichten_geen_verzonden")}</CardContent></Card>
          ) : (
            verzonden.map((b) => (
              <Card key={b.id}>
                <CardContent className="py-3 px-4">
                  <button className="w-full text-left" onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-700 truncate">{b.onderwerp}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-400">{formatDate(b.createdAt)}</span>
                        <span className="text-xs text-gray-500">→ {b.ontvanger.name}</span>
                        {expandedId === b.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </div>
                    </div>
                  </button>
                  {expandedId === b.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{b.inhoud}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === "nieuw" && (
        <Card>
          <CardHeader><CardTitle className="text-base text-gray-900">{t("berichten_aan_docent")}</CardTitle></CardHeader>
          <CardContent>
            {docenten.length === 0 ? (
              <p className="text-sm text-gray-500">{t("berichten_geen_docenten")}</p>
            ) : (
              <form onSubmit={handleSend} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("berichten_aan")} <span className="text-red-500">*</span></label>
                  <select value={form.ontvangerId} onChange={(e) => setForm((p) => ({ ...p, ontvangerId: e.target.value }))} required className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">{t("berichten_selecteer_docent")}</option>
                    {docenten.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("berichten_onderwerp")} <span className="text-red-500">*</span></label>
                  <Input value={form.onderwerp} onChange={(e) => setForm((p) => ({ ...p, onderwerp: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("berichten_bericht")} <span className="text-red-500">*</span></label>
                  <Textarea value={form.inhoud} onChange={(e) => setForm((p) => ({ ...p, inhoud: e.target.value }))} rows={5} required />
                </div>
                <Button type="submit" disabled={sending} className="bg-green-700 hover:bg-green-800 text-white">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                  {t("versturen")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
