"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Mail, Loader2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function WachtwoordVergetenPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Always show success (anti-enumeration)
      setSent(true);
    } catch {
      toast.error("Er is een fout opgetreden. Probeer opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
            <Mail className="h-6 w-6 text-green-700" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Wachtwoord vergeten</h1>
          <p className="text-gray-500 text-sm mt-1">
            Voer uw e-mailadres in en we sturen een herstelLink.
          </p>
        </div>

        {sent ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-5 text-center space-y-3">
            <p className="text-green-800 font-medium">E-mail verstuurd</p>
            <p className="text-green-700 text-sm">
              Als dit e-mailadres bekend is, ontvangt u een link om uw wachtwoord opnieuw in te stellen.
              Controleer ook uw spam-map.
            </p>
            <Link href="/login" className="text-sm text-green-700 hover:underline font-medium">
              Terug naar inloggen →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mailadres</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="uw@email.nl"
                required
                autoFocus
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-green-700 hover:bg-green-800 text-white">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Herstellink versturen
            </Button>
            <div className="text-center">
              <Link href="/login" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                <ChevronLeft className="h-3.5 w-3.5" />
                Terug naar inloggen
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
