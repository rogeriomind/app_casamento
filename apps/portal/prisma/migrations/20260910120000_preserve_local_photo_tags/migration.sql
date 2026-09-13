-- Preserve the album's curatorial tags when the capture source synchronizes.
ALTER TABLE "Photo" ADD COLUMN "sourceTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
