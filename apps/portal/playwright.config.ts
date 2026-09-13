import "dotenv/config";
import path from "node:path";
import { defineConfig } from "@playwright/test";
const database = process.env.TEST_DATABASE_URL;
if (!database || database === process.env.DATABASE_URL || !new URL(database).pathname.endsWith("_test")) {
  throw new Error("Configure TEST_DATABASE_URL com um banco separado terminado em _test.");
}
export default defineConfig({
  testDir: "./tests", testIgnore: "**/*.unit.test.ts", fullyParallel: false, workers: 1, reporter: "list",
  timeout: 60000, expect: { timeout: 10000 }, outputDir: "artifacts/test-results",
  use: { baseURL: "http://127.0.0.1:3001", browserName: "chromium", viewport: { width: 1584, height: 993 }, trace: "retain-on-failure" },
  webServer: {
    command: "npm run start -- --port 3001", url: "http://127.0.0.1:3001/login",
    reuseExistingServer: false, timeout: 120000,
    env: { ...process.env, DATABASE_URL: database, BETTER_AUTH_URL: "http://127.0.0.1:3001",
      UPLOAD_DIR: path.resolve(".local/test-uploads"), MEDIA_DIR: path.resolve(".local/test-media"), MOCK_EMAIL_CODE: "A1B2C3" },
  },
});
