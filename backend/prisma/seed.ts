import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'demo@waypoint.app' },
    update: {},
    create: {
      id: 'demo-user',
      name: 'Alex Johnson',
      email: 'demo@waypoint.app',
    },
  });

  console.log('Seeded demo user:', user.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
