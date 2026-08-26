import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const scholen = await p.school.findMany({ select: { id: true, naam: true, slug: true, actief: true } });
  console.log("SCHOLEN:", JSON.stringify(scholen, null, 2));
  const perRol = await p.user.groupBy({ by: ["role"], _count: true });
  console.log("USERS PER ROL:", JSON.stringify(perRol));
  console.log("totalen:", {
    klas: await p.klas.count(),
    vak: await p.vak.count(),
    les: await p.les.count(),
    huiswerk: await p.huiswerk.count(),
    cijfer: await p.cijfer.count(),
    bericht: await p.bericht.count(),
  });
}
main().finally(() => p.$disconnect());
