import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DocentSidebar } from "@/components/layout/DocentSidebar";

export default async function DocentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user || session.user.role !== "DOCENT") {
    redirect("/login");
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <DocentSidebar />
      <main className="flex-1 ml-0 md:ml-60 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
