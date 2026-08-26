import { bouwFixture, prisma } from "./fixture";

bouwFixture()
  .then((f) => {
    console.log("Fixture gebouwd:");
    console.log(JSON.stringify(f, null, 2));
  })
  .catch((e) => {
    console.error("MISLUKT:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
