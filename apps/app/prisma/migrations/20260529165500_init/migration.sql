-- CreateEnum
CREATE TYPE "PhotoStatus" AS ENUM ('published', 'processing', 'rejected');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientNumber" TEXT NOT NULL,
    "clientHash" TEXT NOT NULL,
    "storagePrefix" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coupleName" TEXT NOT NULL,
    "monogram" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestSession" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "deviceId" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "guestSessionId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "imageObjectPath" TEXT,
    "thumbnailObjectPath" TEXT,
    "status" "PhotoStatus" NOT NULL DEFAULT 'published',
    "originalFileName" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeInBytes" INTEGER NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoLike" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "guestSessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Event_clientNumber_key" ON "Event"("clientNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Event_clientHash_key" ON "Event"("clientHash");

-- CreateIndex
CREATE INDEX "GuestSession_eventId_idx" ON "GuestSession"("eventId");

-- CreateIndex
CREATE INDEX "GuestSession_eventId_lastSeenAt_idx" ON "GuestSession"("eventId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "GuestSession_eventId_deviceId_key" ON "GuestSession"("eventId", "deviceId");

-- CreateIndex
CREATE INDEX "Photo_eventId_status_createdAt_idx" ON "Photo"("eventId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Photo_guestSessionId_idx" ON "Photo"("guestSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoLike_photoId_guestSessionId_key" ON "PhotoLike"("photoId", "guestSessionId");

-- CreateIndex
CREATE INDEX "PhotoLike_guestSessionId_idx" ON "PhotoLike"("guestSessionId");

-- AddForeignKey
ALTER TABLE "GuestSession" ADD CONSTRAINT "GuestSession_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoLike" ADD CONSTRAINT "PhotoLike_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoLike" ADD CONSTRAINT "PhotoLike_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
