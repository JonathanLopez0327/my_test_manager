import { hash } from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from '@prisma/adapter-pg'
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: DATABASE_URL })
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "qa.lead@product.io";
  const password = "Qa123456!";
  const passwordHash = await hash(password, 10);

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

  console.log("Seeded user:", {
    email: user.email,
    password,
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
