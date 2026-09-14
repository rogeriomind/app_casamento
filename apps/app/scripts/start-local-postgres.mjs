import fs from "node:fs/promises";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const root = process.cwd();
const databaseDir = path.join(root, "prisma", "pgdata");
const databaseName = "album_casamento";

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: "postgres",
  port: 5432,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: (message) => process.stdout.write(String(message)),
  onError: (message) => process.stderr.write(String(message)),
});

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDatabase() {
  const client = pg.getPgClient("postgres");
  await client.connect();
  try {
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [databaseName],
    );

    if (result.rowCount === 0) {
      await client.query(`CREATE DATABASE ${client.escapeIdentifier(databaseName)}`);
      console.log(`Database ${databaseName} criada.`);
    }
  } finally {
    await client.end();
  }
}

async function main() {
  if (!(await fileExists(path.join(databaseDir, "PG_VERSION")))) {
    console.log(`Inicializando Postgres local em ${databaseDir}...`);
    await pg.initialise();
  }

  await pg.start();
  await ensureDatabase();
  console.log("Postgres local pronto em localhost:5432.");
  await new Promise(() => undefined);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
