"use client";

import { useState, useEffect, useRef } from "react";
import { Search, User, TrendingUp, CalendarCheck, BookOpen, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface LeerlingStats {
  id: string;
  name: string;
  email: string;
  klasNamen: string[];
  avgCijfer: number | null;
  aanwezigheidsPercentage: number | null;
  huiswerkPercentage: number | null;
}

export function LeerlingZoekbalk() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LeerlingStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search/leerling?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setSearched(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [query]);

  return (
    <div className="space-y-2">
      <div className="relative">
        {loading ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        )}
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zoek leerling op naam…"
          className="pl-9"
        />
      </div>

      {searched && results.length === 0 && !loading && (
        <p className="text-sm text-gray-400 px-1">Geen leerlingen gevonden voor &ldquo;{query}&rdquo;.</p>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((l) => (
            <Card key={l.id} className="border-gray-200 shadow-sm">
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-green-50 text-green-700 shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{l.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {l.klasNamen.length > 0 ? l.klasNamen.join(", ") : "Geen klas"} · {l.email}
                    </p>
                    <div className="flex flex-wrap gap-3 mt-2">
                      <span className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 rounded px-2 py-0.5">
                        <TrendingUp className="h-3 w-3" />
                        {l.avgCijfer !== null
                          ? `Gem. cijfer: ${l.avgCijfer.toFixed(1)}`
                          : "Geen cijfers"}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 rounded px-2 py-0.5">
                        <CalendarCheck className="h-3 w-3" />
                        {l.aanwezigheidsPercentage !== null
                          ? `Aanwezig: ${l.aanwezigheidsPercentage}%`
                          : "Geen aanwezigheid"}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 rounded px-2 py-0.5">
                        <BookOpen className="h-3 w-3" />
                        {l.huiswerkPercentage !== null
                          ? `Huiswerk: ${l.huiswerkPercentage}%`
                          : "Geen huiswerk"}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
