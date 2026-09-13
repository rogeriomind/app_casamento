-- CreateEnum
CREATE TYPE "PhotoOrigin" AS ENUM ('LOCAL', 'CAPTURE');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "CaptureSyncStatus" AS ENUM ('IDLE', 'SYNCING', 'READY', 'FAILED');

-- DropIndex
DROP INDEX "Photo_eventId_createdAt_idx";

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "authorName" TEXT,
ADD COLUMN     "durationSeconds" INTEGER,
ADD COLUMN     "isVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "likeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mediaType" "MediaType" NOT NULL DEFAULT 'IMAGE',
ADD COLUMN     "missingSyncCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "origin" "PhotoOrigin" NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "remoteEmbedUrl" TEXT,
ADD COLUMN     "remoteId" TEXT,
ADD COLUMN     "remoteImageUrl" TEXT,
ADD COLUMN     "remotePlaybackUrl" TEXT,
ADD COLUMN     "remoteThumbnailUrl" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "storageKey" DROP NOT NULL,
ALTER COLUMN "width" DROP NOT NULL,
ALTER COLUMN "height" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CaptureIntegration" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sourceBaseUrl" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "sourceClientHash" TEXT NOT NULL,
    "status" "CaptureSyncStatus" NOT NULL DEFAULT 'IDLE',
    "lastSyncAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "leaseToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "remoteGuestSessions" INTEGER,
    "remoteMetricsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaptureIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaptureIntegration_eventId_key" ON "CaptureIntegration"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "CaptureIntegration_sourceBaseUrl_sourceEventId_key" ON "CaptureIntegration"("sourceBaseUrl", "sourceEventId");

-- CreateIndex
CREATE INDEX "Photo_eventId_isVisible_createdAt_idx" ON "Photo"("eventId", "isVisible", "createdAt");

-- CreateIndex
CREATE INDEX "Photo_eventId_origin_remoteId_idx" ON "Photo"("eventId", "origin", "remoteId");

-- AddForeignKey
ALTER TABLE "CaptureIntegration" ADD CONSTRAINT "CaptureIntegration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
