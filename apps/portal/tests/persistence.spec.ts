import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("sessão e álbum permanecem após reiniciar o servidor", async ({ browser }) => {
  const saved = await readFile(".local/test-persisted-event.json", "utf8").catch(() => null);
  test.skip(!saved, "Execute a suíte journey para criar o álbum de teste.");
  const album = JSON.parse(saved!) as { id: string; name: string };
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:3001", storageState: ".local/test-session.json" });
  try {
    const page = await context.newPage();
    await page.goto("/eventos/" + album.id + "/criado");
    await expect(page.getByRole("heading", { name: album.name, exact: true })).toBeVisible();
    await expect(page.getByText("0 fotos", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Ir para meu álbum", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Olá, Ana/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: /Olá, Ana/ })).toBeVisible();
  } finally { await context.close(); }
});
