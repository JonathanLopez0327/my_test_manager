import { hash } from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from '@prisma/adapter-pg'
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: DATABASE_URL })
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.SEED_QA_EMAIL ?? "";
  const password = process.env.SEED_QA_PASSWORD ?? "";
  const passwordHash = await hash(password, 10);

  const superAdminEmail =
    process.env.SEED_SUPER_ADMIN_EMAIL ?? "";
  const superAdminPassword =
    process.env.SEED_SUPER_ADMIN_PASSWORD ?? "";
  const superAdminHash = await hash(superAdminPassword, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      fullName: "QA Lead",
      passwordHash,
      isActive: true,
    },
    create: {
      email,
      fullName: "QA Lead",
      passwordHash,
      isActive: true,
    },
  });

  await prisma.userGlobalRole.upsert({
    where: {
      userId_role: {
        userId: user.id,
        role: "super_admin",
      },
    },
    update: {},
    create: {
      userId: user.id,
      role: "super_admin",
    },
  });

  console.log("Seeded user:", {
    email: user.email,
    password,
  });

  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {
      fullName: "Super Admin",
      passwordHash: superAdminHash,
      isActive: true,
    },
    create: {
      email: superAdminEmail,
      fullName: "Super Admin",
      passwordHash: superAdminHash,
      isActive: true,
    },
  });

  await prisma.userGlobalRole.upsert({
    where: {
      userId_role: {
        userId: superAdmin.id,
        role: "super_admin",
      },
    },
    update: {},
    create: {
      userId: superAdmin.id,
      role: "super_admin",
    },
  });

  console.log("Seeded super admin:", {
    email: superAdmin.email,
    password: superAdminPassword,
  });
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
