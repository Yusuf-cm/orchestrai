import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Sessions are created on demand by the API, so seeding only needs to confirm
 * the database is reachable and migrated.
 */
async function main() {
  const users = await prisma.user.count();
  console.log(`Database ready. ${users} user(s) present.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
