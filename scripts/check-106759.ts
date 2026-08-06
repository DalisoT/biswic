import { prisma } from '../src/lib/db';

async function main() {
  const u = await prisma.user.findUnique({
    where: { serviceNumber: '106759' },
    select: {
      id: true,
      serviceNumber: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      rank: true,
      isFoundingMember: true,
      isActive: true,
      lastPasswordChangedAt: true,
      createdAt: true,
    },
  });

  console.log(JSON.stringify(u, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
