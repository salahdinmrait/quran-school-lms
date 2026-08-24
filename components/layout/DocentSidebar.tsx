"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  School,
  Star,
  BookOpen,
  MessageSquare,
  LogOut,
  GraduationCap,
  Menu,
  X,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLang } from "@/contexts/LanguageContext";

const navItemDefs = [
  { href: "/docent", key: "nav_dashboard" as const, icon: LayoutDashboard, exact: true },
  { href: "/docent/mijn-klassen", key: "nav_klassen" as const, icon: School },
  { href: "/docent/rooster", key: "nav_rooster" as const, icon: Calendar },
  { href: "/docent/cijfers", key: "nav_cijfers" as const, icon: Star },
  { href: "/docent/huiswerk", key: "nav_huiswerk" as const, icon: BookOpen },
  { href: "/docent/berichten", key: "nav_berichten" as const, icon: MessageSquare },
];

export function DocentSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useLang();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-5 border-b border-green-900">
        <GraduationCap className="h-7 w-7 text-white" />
        <div>
          <p className="text-white font-bold text-sm leading-tight">Jadwal</p>
          <p className="text-green-300 text-xs">Docent</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItemDefs.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-green-100 text-green-800 font-medium"
                  : "text-green-100 hover:bg-green-700 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4 space-y-3">
        <div className="flex justify-center">
          <LanguageToggle />
        </div>
        <Separator className="bg-green-700" />
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-green-100 hover:bg-green-700 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {t("nav_uitloggen")}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 md:hidden bg-green-800 text-white hover:bg-green-700"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-full w-60 bg-green-800 transition-transform md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>

      <aside className="hidden md:flex h-screen w-60 flex-shrink-0 flex-col bg-green-800 fixed top-0 left-0">
        <SidebarContent />
      </aside>
    </>
  );
}
