-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('image', 'video');

-- AlterEnum
ALTER TYPE "PhotoStatus" ADD VALUE IF NOT EXISTS 'uploading';
ALTER TYPE "PhotoStatus" ADD VALUE IF NOT EXISTS 'failed';

-- AlterTable
ALTER TABLE "Photo"
  ADD COLUMN "mediaType" "MediaType" NOT NULL DEFAULT 'image',
  ALTER COLUMN "imageUrl" DROP NOT NULL,
  ADD COLUMN "streamVideoId" TEXT,
  ADD COLUMN "streamLibraryId" TEXT,
  ADD COLUMN "videoEmbedUrl" TEXT,
  ADD COLUMN "playbackUrl" TEXT,
  ADD COLUMN "durationSeconds" INTEGER,
  ADD COLUMN "width" INTEGER,
  ADD COLUMN "height" INTEGER;

-- CreateIndex
CREATE INDEX "Photo_eventId_mediaType_status_createdAt_id_idx"
  ON "Photo"("eventId", "mediaType", "status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Photo_streamLibraryId_streamVideoId_idx"
  ON "Photo"("streamLibraryId", "streamVideoId");

-- CreateIndex
CREATE UNIQUE INDEX "Photo_streamLibraryId_streamVideoId_key"
  ON "Photo"("streamLibraryId", "streamVideoId");
