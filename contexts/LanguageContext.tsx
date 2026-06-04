"use client";

import {
  createContext, useContext, useEffect, useState, ReactNode,
} from "react";
import { type Lang, type TranslationKey, translations } from "@/lib/i18n";

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "nl",
  setLang: () => {},
  t: (key) => translations.nl[key],
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("nl");

  useEffect(() => {
    const stored = localStorage.getItem("jadwal-lang") as Lang | null;
    if (stored === "ar" || stored === "nl") setLangState(stored);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    html.setAttribute("lang", lang);
    // Arabic font class
    if (lang === "ar") {
      html.classList.add("font-arabic");
    } else {
      html.classList.remove("font-arabic");
    }
  }, [lang]);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem("jadwal-lang", l);
  }

  function t(key: TranslationKey): string {
    return translations[lang][key] ?? translations.nl[key];
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
