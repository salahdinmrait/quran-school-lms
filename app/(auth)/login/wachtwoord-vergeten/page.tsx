import Link from "next/link";
import { ChevronLeft, ShieldCheck } from "lucide-react";

export default function WachtwoordVergetenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100">
          <ShieldCheck className="h-7 w-7 text-green-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Wachtwoord vergeten?</h1>
          <p className="text-gray-500 text-sm mt-2">
            Neem contact op met de school-admin. De admin kan uw wachtwoord handmatig aanpassen.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-green-700 hover:underline"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Terug naar inloggen
        </Link>
      </div>
    </div>
  );
}
