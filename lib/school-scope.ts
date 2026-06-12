import { prisma } from "@/lib/prisma";

// Multi-tenant guard: hoort deze klas bij de school van de ingelogde admin?
// (schoolId null = de "legacy" omgeving zonder school.)
export async function klasBehoortTotSchool(klasId: string, schoolId: string | null) {
  const klas = await prisma.klas.findUnique({
    where: { id: klasId },
    select: { schoolId: true },
  });
  return !!klas && klas.schoolId === schoolId;
}

export async function userBehoortTotSchool(userId: string, schoolId: string | null) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { schoolId: true },
  });
  return !!user && user.schoolId === schoolId;
}
