"use client";

import { useLang } from "@/contexts/LanguageContext";

export function LanguageToggle() {
  const { lang, setLang } = useLang();

  return (
    <div className="flex items-center gap-1 rounded-full bg-green-900 p-0.5">
      <button
        onClick={() => setLang("nl")}
        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
          lang === "nl"
            ? "bg-white text-green-800"
            : "text-green-300 hover:text-white"
        }`}
      >
        NL
      </button>
      <button
        onClick={() => setLang("ar")}
        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
          lang === "ar"
            ? "bg-white text-green-800"
            : "text-green-300 hover:text-white"
        }`}
      >
        عربي
      </button>
    </div>
  );
}
