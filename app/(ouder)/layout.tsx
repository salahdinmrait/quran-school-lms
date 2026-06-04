import { OuderSidebar } from "@/components/layout/OuderSidebar";

export default function OuderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <OuderSidebar />
      <main className="flex-1 overflow-y-auto md:ml-60">
        {children}
      </main>
    </div>
  );
}
