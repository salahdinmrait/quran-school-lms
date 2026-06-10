"use client";

import { useEffect, useState } from "react";
import { Inbox, ChevronDown, ChevronUp, Loader2, MessageSquare, Send, CornerDownLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { useLang } from "@/contexts/LanguageContext";
import { toast } from "sonner";

interface ThreadMessage {
  id: string;
  onderwerp: string;
  inhoud: string;
  createdAt: string;
  verzender: { id: string; name: string; role: string };
}

interface Bericht {
  id: string;
  onderwerp: string;
  inhoud: string;
  gelezen: boolean;
  createdAt: string;
  verzender: { id: string; name: string; role: string };
  // Messages the leerling sent as replies to this bericht
  replies: ThreadMessage[];
  // The original message this bericht is a reply to (if any)
  replyTo: ThreadMessage | null;
}

export default function BerichtenPage() {
  const { t } = useLang();
  const [inbox, setInbox] = useState<Bericht[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Reply state
  const [replyTo, setReplyTo] = useState<{ berichtId: string; verzenderId: string; naam: string; onderwerp: string } | null>(null);
  const [replyOnderwerp, setReplyOnderwerp] = useState("");
  const [replyInhoud, setReplyInhoud] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch("/api/berichten")
      .then((r) => r.json())
      .then((data) => {
        setInbox(data.inbox ?? []);
        setIsFetching(false);
      })
      .catch(() => setIsFetching(false));
  }, []);

  async function markRead(id: string) {
    try {
      await fetch(`/api/berichten/${id}`, { method: "PUT" });
      setInbox((prev) => prev.map((b) => b.id === id ? { ...b, gelezen: true } : b));
    } catch { /* silent */ }
  }

  function openReply(b: Bericht) {
    setReplyTo({
      berichtId: b.id,
      verzenderId: b.verzender.id,
      naam: b.verzender.name,
      onderwerp: b.onderwerp,
    });
    setReplyOnderwerp(`Re: ${b.onderwerp}`);
    setReplyInhoud("");
    setExpandedId(b.id);
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyTo || !replyOnderwerp || !replyInhoud) return;
    setSending(true);
    try {
      const res = await fetch("/api/berichten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doelType: "GEBRUIKERS",
          doelIds: [replyTo.verzenderId],
          onderwerp: replyOnderwerp,
          inhoud: replyInhoud,
          replyToId: replyTo.berichtId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Antwoord verstuurd.");

      // Optimistically add reply to the thread so leerling sees it immediately
      const newReply: ThreadMessage = {
        id: `temp-${Date.now()}`,
        onderwerp: replyOnderwerp,
        inhoud: replyInhoud,
        createdAt: new Date().toISOString(),
        verzender: { id: replyTo.verzenderId, name: "U", role: "LEERLING" },
      };
      setInbox((prev) =>
        prev.map((b) =>
          b.id === replyTo.berichtId
            ? { ...b, replies: [...b.replies, newReply] }
            : b
        )
      );

      setReplyTo(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Versturen mislukt.");
    } finally {
      setSending(false);
    }
  }

  const ongelezen = inbox.filter((b) => !b.gelezen).length;

  if (isFetching) {
    return (
      <div className="p-6 flex items-center gap-2 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("laden")}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("berichten_titel")}</h1>
        <p className="text-gray-500 mt-1 text-sm">
          {ongelezen > 0
            ? `${ongelezen} ${t("berichten_ongelezen")}`
            : t("berichten_alle_gelezen")}
        </p>
      </div>

      <div className="flex items-center gap-2 mb-4 text-sm font-medium text-gray-700">
        <Inbox className="h-4 w-4" />
        {t("berichten_inbox")} ({inbox.length})
      </div>

      {inbox.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-400 text-sm">
            <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
            {t("berichten_geen_ontvangen")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {inbox.map((b) => {
            const isExpanded = expandedId === b.id;
            const hasReplies = b.replies.length > 0;

            return (
              <Card key={b.id} className={b.gelezen ? "opacity-80" : ""}>
                <CardContent className="py-3 px-4">
                  {/* Header row — click to expand */}
                  <button
                    className="w-full text-left"
                    onClick={() => {
                      setExpandedId(isExpanded ? null : b.id);
                      if (!b.gelezen) markRead(b.id);
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {!b.gelezen && <span className="w-2 h-2 rounded-full bg-green-600 shrink-0" />}
                        <p className={`text-sm truncate ${!b.gelezen ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                          {b.onderwerp}
                        </p>
                        {hasReplies && !isExpanded && (
                          <span className="shrink-0 text-xs bg-green-100 text-green-700 rounded-full px-1.5 py-0.5 font-medium">
                            {b.replies.length} antwoord{b.replies.length !== 1 ? "en" : ""}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-400">{formatDate(b.createdAt)}</span>
                        <span className="text-xs text-gray-500">{b.verzender.name}</span>
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4 text-gray-400" />
                          : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded: full conversation thread */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-4">

                      {/* Original message (this bericht) */}
                      <div>
                        <p className="text-xs text-gray-400 mb-1.5">
                          <span className="font-medium text-gray-600">{b.verzender.name}</span>
                          {" · "}{formatDate(b.createdAt)}
                        </p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{b.inhoud}</p>
                      </div>

                      {/* Replies already sent */}
                      {b.replies.map((reply, idx) => (
                        <div key={reply.id} className={`ml-4 pl-3 border-l-2 ${idx === b.replies.length - 1 ? "border-green-300" : "border-gray-200"}`}>
                          <p className="text-xs text-gray-400 mb-1.5">
                            <span className="font-medium text-green-700">U</span>
                            {" · "}{formatDate(reply.createdAt)}
                          </p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{reply.inhoud}</p>
                        </div>
                      ))}

                      {/* Reply button — only for DOCENT/ADMIN senders */}
                      {(b.verzender.role === "DOCENT" || b.verzender.role === "ADMIN") && (
                        <>
                          {replyTo?.berichtId === b.id ? (
                            /* Inline reply form */
                            <div className="ml-4 pl-3 border-l-2 border-green-300">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium text-green-700 flex items-center gap-1">
                                  <CornerDownLeft className="h-3.5 w-3.5" />
                                  Antwoord aan {replyTo.naam}
                                </p>
                                <button
                                  onClick={() => setReplyTo(null)}
                                  className="text-xs text-gray-400 hover:text-gray-600"
                                >
                                  Annuleren
                                </button>
                              </div>
                              <form onSubmit={handleReply} className="space-y-2">
                                <Input
                                  value={replyOnderwerp}
                                  onChange={(e) => setReplyOnderwerp(e.target.value)}
                                  placeholder="Onderwerp"
                                  required
                                  className="bg-white text-sm"
                                />
                                <Textarea
                                  value={replyInhoud}
                                  onChange={(e) => setReplyInhoud(e.target.value)}
                                  placeholder="Schrijf uw antwoord hier…"
                                  rows={3}
                                  required
                                  className="bg-white text-sm"
                                />
                                <Button
                                  type="submit"
                                  disabled={sending}
                                  size="sm"
                                  className="bg-green-700 hover:bg-green-800 text-white"
                                >
                                  {sending
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                    : <Send className="h-3.5 w-3.5 mr-1" />}
                                  Versturen
                                </Button>
                              </form>
                            </div>
                          ) : (
                            <button
                              onClick={() => openReply(b)}
                              className="ml-4 flex items-center gap-1.5 text-xs text-green-700 hover:text-green-900 font-medium border border-green-200 bg-green-50 rounded px-2.5 py-1 transition-colors"
                            >
                              <CornerDownLeft className="h-3.5 w-3.5" />
                              Beantwoorden
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
