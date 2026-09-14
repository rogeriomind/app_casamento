-- CreateEnum
CREATE TYPE "AlbumStyle" AS ENUM ('MINIMALIST', 'ROMANTIC', 'MODERN', 'CLASSIC');

-- AlterTable
ALTER TABLE "Event"
  ADD COLUMN "displayNames" VARCHAR(120),
  ADD COLUMN "eventTime" VARCHAR(5),
  ADD COLUMN "venue" VARCHAR(120),
  ADD COLUMN "albumStyle" "AlbumStyle" NOT NULL DEFAULT 'MINIMALIST',
  ADD COLUMN "welcomeMessage" VARCHAR(300),
  ADD COLUMN "logoPath" TEXT,
  ADD COLUMN "logoMime" TEXT;
