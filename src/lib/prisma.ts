import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from '@prisma/adapter-pg'
import dotenv from 'dotenv';

dotenv.config();
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const DATABASE_URL = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: DATABASE_URL })
const cachedPrisma = globalForPrisma.prisma;
const cachedPrismaHasAiConversations = Boolean(
  cachedPrisma &&
    (cachedPrisma as unknown as { aiConversation?: unknown }).aiConversation,
);

export const prisma =
  cachedPrisma && cachedPrismaHasAiConversations
    ? cachedPrisma
    : new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
