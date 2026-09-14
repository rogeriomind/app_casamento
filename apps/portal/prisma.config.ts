import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.NODE_ENV === "test" && process.env.TEST_DATABASE_URL
      ? process.env.TEST_DATABASE_URL
      : env("DATABASE_URL"),
  },
});
