import "dotenv/config";
import { spawnSync } from "node:child_process";
const url = process.env.TEST_DATABASE_URL;
if (!url || url === process.env.DATABASE_URL || !new URL(url).pathname.endsWith("_test")) {
  throw new Error("TEST_DATABASE_URL deve apontar para um banco separado terminado em _test.");
}
const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
  stdio: "inherit", env: { ...process.env, DATABASE_URL: url, NODE_ENV: "test" },
});
process.exit(result.status ?? 1);
