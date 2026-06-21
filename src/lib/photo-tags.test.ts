import { describe, expect, it } from "vitest";
import {
  MAX_PHOTO_TAGS,
  normalizePhotoTags,
  normalizeTag,
  parsePhotoTagsInput,
} from "@/lib/photo-tags";

describe("photo tags", () => {
  it("normalizes tag text", () => {
    expect(normalizeTag(" #Família Feliz ")).toBe("familia-feliz");
  });

  it("deduplicates and limits selected tags", () => {
    expect(
      normalizePhotoTags([
        "noivos",
        "#noivos",
        "festa",
        "pista",
        "amor",
        "familia",
        "amigos",
      ]),
    ).toEqual(["noivos", "festa", "pista", "amor", "familia"]);
    expect(MAX_PHOTO_TAGS).toBe(5);
  });

  it("parses JSON form input", () => {
    expect(parsePhotoTagsInput(JSON.stringify(["#noivos", "festa"]))).toEqual([
      "noivos",
      "festa",
    ]);
  });

  it("parses comma-separated fallback input", () => {
    expect(parsePhotoTagsInput("#pista, #amor")).toEqual(["pista", "amor"]);
  });
});
