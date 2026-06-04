"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { KeyRound, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [form, setForm] = useState({ nieuwWachtwoord: "", bevestig: "" });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error("Ongeldige link.");
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.nieuwWachtwoord !== form.bevestig) {
      toast.error("Wachtwoorden komen niet overeen.");
      return;
    }
    if (form.nieuwWachtwoord.length < 8) {
      toast.error("Wachtwoord moet minimaal 8 tekens hebben.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, nieuwWachtwoord: form.nieuwWachtwoord }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Mislukt. Probeer opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-5 text-center">
        <p className="text-red-700 font-medium">Ongeldige of verlopen link.</p>
        <Link href="/login/wachtwoord-vergeten" className="text-sm text-red-600 hover:underline mt-2 block">
          Vraag een nieuwe link aan →
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-5 text-center">
        <p className="text-green-800 font-medium">Wachtwoord gewijzigd!</p>
        <p className="text-green-700 text-sm mt-1">U wordt doorgestuurd naar de inlogpagina…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nieuw wachtwoord</label>
        <div className="relative">
          <Input
            type={showPw ? "text" : "password"}
            value={form.nieuwWachtwoord}
            onChange={(e) => setForm((p) => ({ ...p, nieuwWachtwoord: e.target.value }))}
            placeholder="Minimaal 8 tekens"
            required
            minLength={8}
            className="pr-10"
          />
          <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Bevestig wachtwoord</label>
        <Input
          type={showPw ? "text" : "password"}
          value={form.bevestig}
          onChange={(e) => setForm((p) => ({ ...p, bevestig: e.target.value }))}
          placeholder="Herhaal wachtwoord"
          required
        />
      </div>
      <Button type="submit" disabled={loading} className="w-full bg-green-700 hover:bg-green-800 text-white">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
        Wachtwoord opslaan
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
            <KeyRound className="h-6 w-6 text-green-700" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Nieuw wachtwoord</h1>
          <p className="text-gray-500 text-sm mt-1">Kies een sterk wachtwoord van minimaal 8 tekens.</p>
        </div>
        <Suspense fallback={<div className="text-center text-gray-400 text-sm">Laden…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
