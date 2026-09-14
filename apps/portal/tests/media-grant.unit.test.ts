import assert from "node:assert/strict";
import test from "node:test";
import { createMediaGrant, verifyMediaGrant } from "../src/lib/media-grant";

process.env.BETTER_AUTH_SECRET = "unit-test-secret-with-more-than-32-characters";

test("autoriza somente a mídia e o evento presentes no acesso assinado", () => {
  const token = createMediaGrant("evento-1", "foto-1", 1_000_000);
  assert.equal(verifyMediaGrant(token, "evento-1", "foto-1", 1_100_000), true);
  assert.equal(verifyMediaGrant(token, "evento-2", "foto-1", 1_100_000), false);
  assert.equal(verifyMediaGrant(token, "evento-1", "foto-2", 1_100_000), false);
});

test("rejeita acesso adulterado ou expirado", () => {
  const token = createMediaGrant("evento-1", "foto-1", 1_000_000);
  const altered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
  assert.equal(verifyMediaGrant(altered, "evento-1", "foto-1", 1_100_000), false);
  assert.equal(verifyMediaGrant(token, "evento-1", "foto-1", 2_801_000), false);
});
