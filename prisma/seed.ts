import { hash } from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from '@prisma/adapter-pg'
import dotenv from 'dotenv';

// Allow `SEED_ENV_FILE=.env.prod pnpm seed` to target a non-default env file.
// Falls back to `.env` (existing behavior) when the override is unset.
const envFile = process.env.SEED_ENV_FILE;
if (envFile) {
  dotenv.config({ path: envFile, override: true });
} else {
  dotenv.config();
}

const DATABASE_URL = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: DATABASE_URL })
const prisma = new PrismaClient({ adapter });

async function main() {
  const qaEmail = process.env.SEED_QA_EMAIL?.trim() || "";
  const qaPassword = process.env.SEED_QA_PASSWORD ?? "";

  if (qaEmail && qaPassword) {
    const passwordHash = await hash(qaPassword, 12);
    const user = await prisma.user.upsert({
      where: { email: qaEmail },
      update: { fullName: "QA Lead", passwordHash, isActive: true },
      create: { email: qaEmail, fullName: "QA Lead", passwordHash, isActive: true },
    });

    await prisma.userGlobalRole.upsert({
      where: { userId_role: { userId: user.id, role: "super_admin" } },
      update: {},
      create: { userId: user.id, role: "super_admin" },
    });

    console.log("Seeded user:", { email: user.email, password: qaPassword });
  } else {
    console.log("Skipping QA user: SEED_QA_EMAIL / SEED_QA_PASSWORD not set.");
  }

  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL?.trim() || "";
  const superAdminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "";

  if (superAdminEmail && superAdminPassword) {
    const superAdminHash = await hash(superAdminPassword, 12);
    const superAdmin = await prisma.user.upsert({
      where: { email: superAdminEmail },
      update: { fullName: "Super Admin", passwordHash: superAdminHash, isActive: true },
      create: { email: superAdminEmail, fullName: "Super Admin", passwordHash: superAdminHash, isActive: true },
    });

    await prisma.userGlobalRole.upsert({
      where: { userId_role: { userId: superAdmin.id, role: "super_admin" } },
      update: {},
      create: { userId: superAdmin.id, role: "super_admin" },
    });

    console.log("Seeded super admin:", { email: superAdmin.email, password: superAdminPassword });
  } else {
    console.log("Skipping super admin: SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD not set.");
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
