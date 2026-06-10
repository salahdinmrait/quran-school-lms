import Link from "next/link";

export const metadata = { title: "Developer Console — QuranMagister" };

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/dev" className="font-semibold tracking-tight">
            <span className="text-emerald-400">●</span> QuranMagister{" "}
            <span className="text-slate-400 font-normal">Developer Console</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dev" className="text-slate-300 hover:text-white">
              Scholen
            </Link>
            <Link
              href="/dev/scholen/nieuw"
              className="rounded-md bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-500"
            >
              + Nieuwe school
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
