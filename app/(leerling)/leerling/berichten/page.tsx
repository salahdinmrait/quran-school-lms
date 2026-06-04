"use client";

import { useEffect, useState } from "react";
import { Inbox, ChevronDown, ChevronUp, Loader2, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

interface Bericht {
  id: string;
  onderwerp: string;
  inhoud: string;
  gelezen: boolean;
  createdAt: string;
  verzender: { id: string; name: string; role: string };
}

export default function BerichtenPage() {
  const [inbox, setInbox] = useState<Bericht[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    } catch {
      // silent
    }
  }

  const ongelezen = inbox.filter((b) => !b.gelezen).length;

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Berichten</h1>
        <p className="text-gray-500 mt-1 text-sm">
          {ongelezen > 0
            ? `${ongelezen} ongelezen bericht${ongelezen !== 1 ? "en" : ""}`
            : "Alle berichten gelezen"}
        </p>
      </div>

      <div className="flex items-center gap-2 mb-4 text-sm font-medium text-gray-700">
        <Inbox className="h-4 w-4" />
        Inbox ({inbox.length})
      </div>

      {inbox.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-400 text-sm">
            <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
            Geen berichten ontvangen.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {inbox.map((b) => (
            <Card key={b.id} className={b.gelezen ? "opacity-80" : ""}>
              <CardContent className="py-3 px-4">
                <button
                  className="w-full text-left"
                  onClick={() => {
                    setExpandedId(expandedId === b.id ? null : b.id);
                    if (!b.gelezen) markRead(b.id);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {!b.gelezen && (
                        <span className="w-2 h-2 rounded-full bg-green-600 shrink-0" />
                      )}
                      <p className={`text-sm truncate ${!b.gelezen ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                        {b.onderwerp}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-400">{formatDate(b.createdAt)}</span>
                      <span className="text-xs text-gray-500">{b.verzender.name}</span>
                      {expandedId === b.id
                        ? <ChevronUp className="h-4 w-4 text-gray-400" />
                        : <ChevronDown className="h-4 w-4 text-gray-400" />
                      }
                    </div>
                  </div>
                </button>
                {expandedId === b.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-2">
                      Van: <span className="font-medium">{b.verzender.name}</span> · {formatDate(b.createdAt)}
                    </p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{b.inhoud}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
