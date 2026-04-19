import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const host = (() => {
  try {
    return new URL(connectionString).host;
  } catch {
    return "unknown";
  }
})();

if (!/localhost|127\.0\.0\.1/.test(host)) {
  console.error(
    `Refusing to truncate non-local database (host: ${host}). Abort.`,
  );
  process.exit(1);
}

const client = new Client({ connectionString });
await client.connect();

const { rows } = await client.query(`
  SELECT tablename
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename <> '_prisma_migrations'
  ORDER BY tablename
`);

if (rows.length === 0) {
  console.log("No tables found.");
  await client.end();
  process.exit(0);
}

const tableList = rows.map((r) => `"${r.tablename}"`).join(", ");
console.log(`Truncating ${rows.length} tables on ${host}...`);

await client.query("BEGIN");
try {
  await client.query(
    `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`,
  );
  await client.query("COMMIT");
  console.log("Done.");
  console.log(rows.map((r) => `  - ${r.tablename}`).join("\n"));
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Truncate failed:", err);
  process.exit(1);
}

await client.end();
