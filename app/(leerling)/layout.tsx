import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LeerlingaSidebar } from "@/components/layout/LeerlingaSidebar";

export default async function LeerlingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user || session.user.role !== "LEERLING") {
    redirect("/login");
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <LeerlingaSidebar />
      <main className="flex-1 ml-0 md:ml-60 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
