import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "ChangeMe123!";

const PLATFORM_ADMINS = [
  {
    email: "global.admin@talentbridge.example",
    name: "Global Admin",
    role: "global_admin" as const,
  },
  {
    email: "manager@talentbridge.example",
    name: "Priya Manager",
    role: "manager" as const,
  },
  {
    email: "support@talentbridge.example",
    name: "Alex Support",
    role: "support" as const,
  },
];

async function main() {
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS talentbridge`);

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const admin of PLATFORM_ADMINS) {
    await prisma.platformAdmin.upsert({
      where: { email: admin.email },
      create: {
        email: admin.email,
        name: admin.name,
        role: admin.role,
        passwordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
        enabled: true,
      },
      update: {
        name: admin.name,
        role: admin.role,
        passwordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
        enabled: true,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
  }

  console.log("Seeded platform admins only (no tenants / demo CRM data).");
  console.log("Create tenants from Admin-Talent-Bridge.");
  console.log("");
  console.log("Platform users (password for all):", DEMO_PASSWORD);
  for (const admin of PLATFORM_ADMINS) {
    console.log(`  ${admin.role.padEnd(12)} ${admin.email}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
