import assert from "node:assert/strict";
import test from "node:test";
import { buildParticipations, matchingAuthorVariants } from "../src/features/dashboard/lib/participations";

test("agrupa variações editoriais e conserva o nome do registro mais recente", () => {
  const rows = buildParticipations([
    { authorName: " ana ", mediaType: "IMAGE", tags: ["familia"], likeCount: 1, createdAt: new Date("2026-09-01T10:00:00Z") },
    { authorName: "Ａｎａ", mediaType: "VIDEO", tags: ["familia", "festa"], likeCount: 2, createdAt: new Date("2026-09-02T10:00:00Z") },
    { authorName: "Ana", mediaType: "IMAGE", tags: ["festa"], likeCount: 3, createdAt: new Date("2026-09-03T10:00:00Z") },
    { authorName: "   ", mediaType: "IMAGE", tags: [], likeCount: 9, createdAt: new Date("2026-09-04T10:00:00Z") },
  ]);

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    name: "Ana",
    mediaCount: 3,
    photoCount: 2,
    videoCount: 1,
    likeCount: 6,
    latestAt: "2026-09-03T10:00:00.000Z",
    tags: ["familia", "festa"],
  });
});

test("resolve todas as variantes do nome usado no filtro da galeria", () => {
  assert.deepEqual(
    matchingAuthorVariants(["Ana", " ana ", "Ａｎａ", "Bruno", null, "Ana"], "Ana"),
    ["Ana", " ana ", "Ａｎａ"],
  );
});
