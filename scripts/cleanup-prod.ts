/* eslint-disable no-console */
/**
 * scripts/cleanup-prod.ts
 *
 * DESTRUCTIVE: truncates every table in the `public` schema (except
 * `_prisma_migrations`) and optionally re-runs the Prisma seed.
 *
 * Usage:
 *   node --env-file=.env.prod --loader ts-node/esm scripts/cleanup-prod.ts
 *     # ^ defaults to --dry-run, prints DB host + per-table row counts
 *
 *   node --env-file=.env.prod --loader ts-node/esm scripts/cleanup-prod.ts \
 *     --apply --confirm-database <db_name>
 *     # actually wipes; --confirm-database must match the connected DB
 *
 *   ... --reseed   # after wiping, runs `prisma db seed`
 *
 * Why a separate script (vs. `prisma migrate reset`):
 *   `migrate reset` drops & re-applies migrations. This script keeps the
 *   schema as-is and just clears data, which is faster and survives
 *   partial-migration prod environments.
 */

import { execSync } from "node:child_process";
import dotenv from "dotenv";

// Load .env.prod first so DATABASE_URL is set before we instantiate Prisma.
dotenv.config({ path: ".env.prod", override: true });

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
  max: 5,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  statement_timeout: 60_000,
});
const prisma = new PrismaClient({ adapter });

type Args = {
  dryRun: boolean;
  apply: boolean;
  confirmDatabase: string | null;
  reseed: boolean;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = {
    dryRun: true,
    apply: false,
    confirmDatabase: null,
    reseed: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") {
      // Some package managers forward the literal "--" separator.
      continue;
    }
    if (arg === "--apply") {
      args.apply = true;
      args.dryRun = false;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
      args.apply = false;
    } else if (arg === "--reseed") {
      args.reseed = true;
    } else if (arg === "--confirm-database") {
      args.confirmDatabase = argv[i + 1] ?? null;
      i += 1;
    } else {
      console.error(`Unknown arg: ${arg}`);
      process.exit(2);
    }
  }
  return args;
}

function bail(msg: string): never {
  console.error(`\n  [cleanup-prod] ABORT: ${msg}\n`);
  process.exit(1);
}

function maskUrl(url: string): string {
  // Keep host/db visible; mask user:password.
  return url.replace(/\/\/[^@]+@/, "//<credentials>@");
}

async function main() {
  const args = parseArgs();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    bail("DATABASE_URL is not set. Run with `node --env-file=.env.prod ...`.");
  }

  const parsedUrl = new URL(databaseUrl);
  const dbName = parsedUrl.pathname.replace(/^\//, "");
  const host = parsedUrl.host;

  console.log("──────────────────────────────────────────────────────");
  console.log("  Test Manager — production data cleanup");
  console.log("──────────────────────────────────────────────────────");
  console.log(`  DB host: ${host}`);
  console.log(`  DB name: ${dbName}`);
  console.log(`  URL:     ${maskUrl(databaseUrl)}`);
  console.log(`  Mode:    ${args.dryRun ? "DRY-RUN (no changes)" : "APPLY (will truncate)"}`);
  console.log(`  Reseed:  ${args.reseed ? "yes" : "no"}`);
  console.log("──────────────────────────────────────────────────────\n");

  try {
    // 1. List tables in the public schema (skip Prisma's bookkeeping table).
    const rows = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename <> '_prisma_migrations'
      ORDER BY tablename
    `;
    const tables = rows.map((r) => r.tablename);

    if (tables.length === 0) {
      bail("No user tables found in the public schema. Aborting to be safe.");
    }

    // 2. Show row counts per table.
    console.log("  Row counts:");
    let total = 0;
    for (const table of tables) {
      const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*)::bigint AS count FROM "${table}"`,
      );
      const count = Number(result[0]?.count ?? 0);
      total += count;
      console.log(`    ${table.padEnd(36)} ${count.toLocaleString()}`);
    }
    console.log(`    ${"TOTAL".padEnd(36)} ${total.toLocaleString()}\n`);

    if (args.dryRun) {
      console.log("  Dry-run complete. No changes made.");
      console.log("  To actually wipe: re-run with --apply --confirm-database <name>");
      console.log("  (and optionally --reseed)\n");
      return;
    }

    // 3. Apply mode: require --confirm-database to match the connected DB.
    if (!args.confirmDatabase) {
      bail("--apply requires --confirm-database <name> matching the connected DB.");
    }
    if (args.confirmDatabase !== dbName) {
      bail(
        `--confirm-database "${args.confirmDatabase}" does not match the connected DB "${dbName}".`,
      );
    }

    // 4. Truncate everything inside one transaction.
    console.log("  Truncating tables (CASCADE, RESTART IDENTITY)…");
    const quoted = tables.map((t) => `"${t}"`).join(", ");
    await prisma.$transaction([
      prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`),
    ]);
    console.log(`  Truncated ${tables.length} tables.\n`);

    // 5. Optional reseed.
    if (args.reseed) {
      console.log("  Re-running Prisma seed…");
      // Inherit the same env vars so the seed hits the same DATABASE_URL.
      execSync("pnpm exec prisma db seed", { stdio: "inherit" });
      console.log("  Reseed complete.\n");
    }

    console.log("  Done.\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("\n  [cleanup-prod] ERROR:", err);
  process.exit(1);
});
