import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create initial map state record
  await prisma.mapState.upsert({
    where: { epoch: 1 },
    update: {},
    create: {
      epoch: 1,
      seed: "genesis",
      isActive: true,
    },
  });
  console.log("Database seeded");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
