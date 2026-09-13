import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import sharp from "sharp";
const password = "senha-segura-123";
const uniqueEmail = () => "teste-" + randomUUID() + "@teste.local";
async function signup(request: APIRequestContext, email = uniqueEmail()) {
  const response = await request.post("/api/cadastro", { data: { name: "Ana Teste", email, password } });
  expect(response.status(), await response.text()).toBe(201);
  return email;
}
async function verify(request: APIRequestContext, email: string) {
  const response = await request.post("/api/auth/email-otp/verify-email", { headers: { Origin: "http://127.0.0.1:3001" }, data: { email, otp: "A1B2C3" } });
  expect(response.status(), await response.text()).toBe(200);
}
async function draft(request: APIRequestContext) {
  const response = await request.post("/api/eventos/rascunho");
  expect(response.status()).toBe(200);
  return (await response.json()).event;
}
async function patch(request: APIRequestContext, id: string, data: unknown) {
  const response = await request.patch("/api/eventos/" + id, { data });
  expect(response.status(), await response.text()).toBe(200);
}
async function screenshot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  expect(size.scroll, name).toBeLessThanOrEqual(size.width);
  await page.screenshot({ path: "artifacts/" + name + ".png", fullPage: true });
}
async function addPhotoToAlbum(eventId: string) {
  const id = randomUUID();
  const storageKey = id + ".webp";
  const mediaPath = ".local/test-media/" + storageKey;
  const original = await readFile("public/images/login/party.png");
  const photo = await sharp(original).webp({ quality: 88 }).toBuffer();
  await mkdir(".local/test-media", { recursive: true });
  await writeFile(mediaPath, photo);
  const db = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  try {
    await db.query(
      'INSERT INTO "Photo" ("id", "eventId", "storageKey", "mime", "width", "height", "altText", "collection", "sourceKey", "authorName", "tags", "likeCount") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
      [id, eventId, storageKey, "image/webp", 1254, 1254, "Pessoas celebrando ao ar livre no fim de tarde", "Celebração", "test-" + id, "Ana Teste", ["celebracao"], 2],
    );
  } finally { await db.end(); }
  return { id, storageKey };
}

test("cadastro: valida campos e falha de rede sem travar o formulário", async ({ page, request }) => {
  await page.goto("/cadastro");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page.getByText("Informe seu nome.")).toBeVisible();
  await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
  await expect(page.getByText("A senha precisa ter pelo menos 8 caracteres.")).toBeVisible();
  expect((await request.post("/api/cadastro", { data: { name: "", email: "invalido", password: "123" } })).status()).toBe(400);
  await page.getByLabel("Nome", { exact: true }).fill("Ana");
  await page.getByLabel("E-mail", { exact: true }).fill(uniqueEmail());
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Mostrar senha" }).click();
  await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute("type", "text");
  await page.route("**/api/cadastro", (route) => route.abort());
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Não foi possível conectar");
  await expect(page.getByRole("button", { name: "Criar minha conta" })).toBeEnabled();
});

test("jornada real: código colado, voltar, recarregar, capa, cor e login", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/cadastro");
  await page.getByLabel("Nome", { exact: true }).fill("Ana Teste");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page).toHaveURL(/confirmar-email$/);
  await page.reload();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await page.getByLabel("Caractere 1 do código").evaluate((el) => {
    const clipboardData = new DataTransfer(); clipboardData.setData("text/plain", "a1b2c3");
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true }));
  });
  await expect(page.getByLabel("Caractere 6 do código")).toHaveValue("3");
  await page.getByRole("button", { name: "Confirmar e-mail", exact: true }).click();
  await expect(page).toHaveURL(/concluido$/);
  await expect(page.getByRole("heading", { name: /Tudo certo, Ana/ })).toBeVisible();
  await page.getByRole("link", { name: "Criar meu primeiro evento" }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Escolha o tipo");
  await page.getByRole("button", { name: "Aniversário", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page).toHaveURL(/informacoes$/);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Informe o nome");
  await page.getByLabel("Nome do evento").fill("Aniversário da Ana");
  await page.reload();
  await expect(page.getByLabel("Nome do evento")).toHaveValue("Aniversário da Ana");
  await page.getByLabel("Data do evento").fill("2000-02-29");
  await page.getByLabel("Descrição", { exact: true }).fill("Um dia especial para guardar.");
  await page.getByRole("button", { name: "Voltar", exact: false }).click();
  await expect(page).toHaveURL(/tipo$/);
  await expect(page.getByRole("button", { name: "Aniversário", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByLabel("Data do evento")).toHaveValue("2000-02-29");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page).toHaveURL(/personalizacao$/);
  await page.getByLabel("Foto de capa", { exact: true }).setInputFiles({ name: "falso.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
  await expect(page.getByRole("main").getByRole("alert")).toContainText("imagem é inválida");
  await page.getByLabel("Foto de capa", { exact: true }).setInputFiles("public/images/login/party.png");
  await expect(page.getByAltText("Prévia da capa")).toBeVisible();
  await page.getByLabel("Selecionar cor #e46662").click();
  await expect(page.getByRole("status")).toContainText("Capa adicionada");
  await page.getByRole("button", { name: "Voltar", exact: false }).click();
  await expect(page).toHaveURL(/informacoes$/);
  await expect(page.getByLabel("Descrição", { exact: true })).toHaveValue("Um dia especial para guardar.");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Selecionar cor #e46662")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByAltText("Prévia da capa")).toBeVisible();
  await page.getByRole("button", { name: "Criar meu álbum", exact: true }).click();
  await expect(page).toHaveURL(/eventos\/.+\/criado$/);
  await expect(page.getByRole("heading", { name: "Seu momento já tem um lugar." })).toBeVisible();
  await expect(page.getByText("0 fotos", { exact: true })).toBeVisible();
  const albumUrl = page.url();
  const eventId = albumUrl.match(/\/eventos\/([^/]+)\/criado$/)?.[1];
  expect(eventId).toBeTruthy();
  const photo = await addPhotoToAlbum(eventId!);
  await page.getByRole("link", { name: "Ir para meu álbum", exact: true }).click();
  await expect(page).toHaveURL(/eventos\/.+$/);
  await expect(page.getByRole("heading", { name: "Olá, Ana!" })).toBeVisible();
  await expect(page.getByAltText("Pessoas celebrando ao ar livre no fim de tarde").first()).toBeVisible();
  await screenshot(page, "dashboard-with-photo-final");
  await page.getByRole("link", { name: "Configurações" }).click();
  await expect(page).toHaveURL(/eventos\/.+\/configuracoes$/);
  await expect(page.getByRole("heading", { name: "Configurações do evento" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar alterações" })).toHaveCount(1);
  await expect(page.getByText("Conta do álbum")).toBeVisible();
  await expect(page.getByRole("link", { name: "Configurações" })).toHaveAttribute("aria-current", "page");
  await page.getByLabel("Nomes em destaque").fill("Ana & seus convidados");
  await page.getByRole("textbox", { name: "Mensagem de boas-vindas" }).fill("Que bom ter você aqui para celebrar com a gente!");
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByLabel("Nomes em destaque")).toHaveValue("");
  await expect(page.getByRole("textbox", { name: "Mensagem de boas-vindas" })).toHaveValue("");
  await page.getByLabel("Nomes em destaque").fill("Ana & seus convidados");
  await page.getByRole("textbox", { name: "Mensagem de boas-vindas" }).fill("Que bom ter você aqui para celebrar com a gente!");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("status")).toContainText("Alterações salvas.");
  await page.reload();
  await expect(page.getByLabel("Nomes em destaque")).toHaveValue("Ana & seus convidados");
  await expect(page.getByRole("textbox", { name: "Mensagem de boas-vindas" })).toHaveValue("Que bom ter você aqui para celebrar com a gente!");
  await page.getByRole("tab", { name: "QR Code" }).click();
  await expect(page.getByText("A personalização do QR Code será liberada")).toBeVisible();
  await page.getByRole("tab", { name: "Informações" }).click();
  await page.setViewportSize({ width: 896, height: 703 });
  await expect(page.getByRole("link", { name: "Configurações" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sobre o evento" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  const mediumForm = await page.locator("#event-settings-form").boundingBox();
  const mediumPreview = await page.getByRole("complementary", { name: "Pré-visualização do álbum" }).boundingBox();
  expect(mediumForm).not.toBeNull();
  expect(mediumPreview).not.toBeNull();
  expect(mediumPreview!.y).toBeGreaterThan(mediumForm!.y + mediumForm!.height - 2);
  await screenshot(page, "settings-reference-final");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("link", { name: "Configurações" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar alterações" })).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  const mobileForm = await page.locator("#event-settings-form").boundingBox();
  const mobilePreview = await page.getByRole("complementary", { name: "Pré-visualização do álbum" }).boundingBox();
  expect(mobileForm).not.toBeNull();
  expect(mobilePreview).not.toBeNull();
  expect(mobilePreview!.y).toBeGreaterThan(mobileForm!.y + mobileForm!.height - 2);
  await screenshot(page, "settings-mobile-final");
  await page.setViewportSize({ width: 1584, height: 993 });
  const desktopForm = await page.locator("#event-settings-form").boundingBox();
  const desktopPreview = await page.getByRole("complementary", { name: "Pré-visualização do álbum" }).boundingBox();
  expect(desktopForm).not.toBeNull();
  expect(desktopPreview).not.toBeNull();
  expect(Math.abs(desktopPreview!.y - desktopForm!.y)).toBeLessThan(60);
  await screenshot(page, "settings-final");
  await page.goto("/eventos/" + eventId);
  await page.getByRole("link", { name: "Ver todas", exact: true }).first().click();
  await expect(page).toHaveURL(/eventos\/.+\/fotos$/);
  await expect(page.getByRole("heading", { name: "Todas as memórias" })).toBeVisible();
  await screenshot(page, "gallery-with-photo-final");
  await expect(page.getByRole("link", { name: "celebracao", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Visualizar em lista" }).click();
  await expect(page).toHaveURL(/visualizacao=lista/);
  await expect(page.getByText("Nome informado: Ana Teste")).toBeVisible();
  await expect(page.getByText("2 curtidas no evento")).toBeVisible();
  await page.getByRole("link", { name: "Visualizar em grade" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot(page, "gallery-with-photo-mobile-final");
  await page.setViewportSize({ width: 1584, height: 993 });
  const favorite = page.getByRole("button", { name: "Adicionar aos favoritos" }).first();
  await favorite.click();
  await expect(page.getByRole("button", { name: "Remover dos favoritos" }).first()).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: /Favoritos \(1\)/ }).click();
  await expect(page.getByAltText("Pessoas celebrando ao ar livre no fim de tarde")).toBeVisible();
  let galleryDocumentRequests = 0;
  const countGalleryDocuments = (request: import("@playwright/test").Request) => {
    if (request.resourceType() === "document") galleryDocumentRequests += 1;
  };
  page.on("request", countGalleryDocuments);
  await page.getByRole("link", { name: /Abrir foto/ }).click();
  await expect(page.getByRole("dialog", { name: "Mídia ampliada" })).toBeVisible();
  await expect(page).toHaveURL(/foto=/);
  expect(galleryDocumentRequests).toBe(0);
  await page.getByRole("button", { name: "Fechar detalhe" }).click();
  await expect(page.getByRole("dialog", { name: "Mídia ampliada" })).not.toBeVisible();
  await expect(page).not.toHaveURL(/foto=/);
  page.off("request", countGalleryDocuments);
  const mediaUrl = `/api/eventos/${eventId}/fotos/${photo.id}`;
  const mediaResponse = await page.request.get(mediaUrl);
  expect(mediaResponse.status()).toBe(200);
  expect(mediaResponse.headers()["cache-control"]).toBe("private, no-cache");
  const mediaEtag = mediaResponse.headers().etag;
  expect(mediaEtag).toBeTruthy();
  expect((await page.request.get(mediaUrl, { headers: { "If-None-Match": mediaEtag } })).status()).toBe(304);
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("senha-incorreta");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("E-mail ou senha inválidos");
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/eventos\/[^/]+$/);
  await page.goto(albumUrl);
  await expect(page.getByRole("heading", { name: "Aniversário da Ana" })).toBeVisible();
  await page.getByRole("link", { name: "Ir para meu álbum", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Olá, Ana!" })).toBeVisible();
  await page.getByRole("button", { name: "Sair da conta de Ana" }).click();
  await expect(page).toHaveURL(/login$/);
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/eventos\/[^/]+$/);
  await page.goto(albumUrl);
  await page.getByRole("link", { name: "Ir para meu álbum", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Olá, Ana!" })).toBeVisible();
  await page.goto("/login");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page).toHaveURL(/cadastro\?nova-conta=1$/);
  await expect(page.getByLabel("Nome", { exact: true })).toBeVisible();
  await page.goto(albumUrl);
  await expect(page).toHaveURL(albumUrl);
  await expect(page.getByRole("heading", { name: "Aniversário da Ana" })).toBeVisible();
});

test("código incorreto, reenvio, e-mail duplicado e correção com erro visível", async ({ page }) => {
  const original = await signup(page.request);
  expect((await page.request.post("/api/cadastro", { data: { name: "Outra", email: original, password } })).status()).toBe(409);
  await page.goto("/cadastro/confirmar-email");
  await page.getByLabel("Caractere 1 do código").fill("ZZZZZZ");
  await page.getByRole("button", { name: "Confirmar e-mail", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Código inválido");
  await page.getByRole("button", { name: "Reenviar código" }).click();
  await expect(page.getByRole("status")).toContainText("Código reenviado");
  await page.getByRole("button", { name: "Alterar", exact: true }).click();
  await page.getByLabel("Corrija seu e-mail").fill("invalido");
  await page.getByRole("button", { name: "Salvar e reenviar" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Informe um e-mail válido");
  const corrected = uniqueEmail();
  await page.getByLabel("Corrija seu e-mail").fill(corrected);
  await page.getByRole("button", { name: "Salvar e reenviar" }).click();
  await expect(page.getByText(corrected, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(corrected, { exact: true })).toBeVisible();
  expect((await page.request.post("/api/auth/email-otp/verify-email", { data: { email: original, otp: "A1B2C3" } })).status()).toBe(403);
  await page.getByLabel("Caractere 1 do código").fill("A1B2C3");
  await page.getByRole("button", { name: "Confirmar e-mail", exact: true }).click();
  await expect(page).toHaveURL(/concluido$/);
});

test("login retoma conta não confirmada e as APIs rejeitam ausência de sessão", async ({ page, request }) => {
  const email = await signup(page.request);
  await page.context().clearCookies();
  await page.goto("/eventos/novo/personalizacao");
  await expect(page).toHaveURL(/login$/);
  expect((await request.post("/api/eventos/rascunho")).status()).toBe(401);
  expect((await request.post("/api/cadastro/pendente", { data: { email } })).status()).toBe(400);
  expect((await request.patch("/api/cadastro/alterar-email", { data: { email: uniqueEmail() } })).status()).toBe(401);
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/confirmar-email$/);
});

test("favoritos são privados, autorizados e idempotentes", async ({ request, playwright }) => {
  const email = await signup(request);
  await verify(request, email);
  const event = await draft(request);
  await patch(request, event.id, { type: "WEDDING", name: "Favoritos privados", eventDate: "2030-12-31" });
  expect((await request.post(`/api/eventos/${event.id}/concluir`, { data: { useDefaults: true } })).status()).toBe(200);
  const photo = await addPhotoToAlbum(event.id);
  const url = `/api/eventos/${event.id}/fotos/${photo.id}/favorito`;
  const trusted = { Origin: "http://127.0.0.1:3001" };

  expect((await request.put(url)).status()).toBe(403);
  expect(await (await request.put(url, { headers: trusted })).json()).toEqual({ favorited: true });
  expect(await (await request.put(url, { headers: trusted })).json()).toEqual({ favorited: true });

  const stranger = await playwright.request.newContext({ baseURL: "http://127.0.0.1:3001" });
  try {
    const otherEmail = await signup(stranger);
    await verify(stranger, otherEmail);
    expect((await stranger.put(url, { headers: trusted })).status()).toBe(404);
  } finally {
    await stranger.dispose();
  }

  expect(await (await request.delete(url, { headers: trusted })).json()).toEqual({ favorited: false });
  expect(await (await request.delete(url, { headers: trusted })).json()).toEqual({ favorited: false });
});

test("seis tipos, validação no servidor, propriedade, padrões e conclusão idempotente", async ({ request, playwright }) => {
  const email = await signup(request); await verify(request, email);
  const stranger = await playwright.request.newContext({ baseURL: "http://127.0.0.1:3001" });
  const otherEmail = await signup(stranger); await verify(stranger, otherEmail);
  for (const type of ["WEDDING", "BIRTHDAY", "GRADUATION", "GATHERING", "CORPORATE", "OTHER"]) {
    const current = await draft(request);
    const same = await Promise.all([draft(request), draft(request)]);
    expect(same.map((e) => e.id)).toEqual([current.id, current.id]);
    expect((await request.post("/api/eventos/" + current.id + "/concluir")).status()).toBe(400);
    await patch(request, current.id, { type });
    expect((await stranger.patch("/api/eventos/" + current.id, { data: { type } })).status()).toBe(404);
    expect((await request.patch("/api/eventos/" + current.id, { data: { description: "a".repeat(301) } })).status()).toBe(400);
    expect((await request.patch("/api/eventos/" + current.id, { data: { eventDate: "2026-02-31" } })).status()).toBe(400);
    await patch(request, current.id, { name: "Celebração " + type, eventDate: "2030-12-31", description: "a".repeat(300), albumColor: "#e46662" });
    if (type === "WEDDING") {
      const url = "/api/eventos/" + current.id + "/capa";
      expect((await request.post(url, { multipart: { cover: { name: "huge.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) } } })).status()).toBe(400);
      expect((await request.post(url, { multipart: { cover: { name: "text.txt", mimeType: "text/plain", buffer: Buffer.from("no") } } })).status()).toBe(400);
      expect((await request.post(url, { multipart: { cover: { name: "party.png", mimeType: "image/png", buffer: await readFile("public/images/login/party.png") } } })).status()).toBe(200);
      expect((await stranger.get(url)).status()).toBe(404);
    }
    const url = "/api/eventos/" + current.id + "/concluir";
    const results = await Promise.all([request.post(url, { data: { useDefaults: true } }), request.post(url, { data: { useDefaults: true } })]);
    for (const result of results) {
      expect(result.status(), await result.text()).toBe(200);
      expect((await result.json()).event).toMatchObject({ id: current.id, state: "CREATED", albumColor: "#17345f", coverPath: null });
    }
    expect((await stranger.post(url)).status()).toBe(404);
    expect(await (await stranger.get("/eventos/" + current.id + "/criado")).text()).not.toContain("Celebração " + type);
    expect((await stranger.get("/eventos/" + current.id)).status()).toBe(404);
    if (type === "WEDDING") {
      const photo = await addPhotoToAlbum(current.id);
      expect((await request.get(`/api/eventos/${current.id}/fotos/${photo.id}`)).status()).toBe(200);
      expect((await stranger.get(`/api/eventos/${current.id}/fotos/${photo.id}`)).status()).toBe(404);
    }
    expect((await request.patch("/api/eventos/" + current.id, { data: { name: "Alteração tardia" } })).status()).toBe(409);
    if (type === "OTHER") {
      await mkdir(".local", { recursive: true });
      await request.storageState({ path: ".local/test-session.json" });
      await writeFile(".local/test-persisted-event.json", JSON.stringify({ id: current.id, name: "Celebração " + type }));
    }
  }
  await stranger.dispose();
});

test("OTP expirado e limite de tentativas são recuperados por reenvio", async ({ request }) => {
  const email = await signup(request);
  const db = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  try {
    await db.query('UPDATE "Verification" SET "expiresAt" = NOW() - INTERVAL \'1 minute\' WHERE identifier = $1', ["email-verification-otp-" + email]);
    const headers = { Origin: "http://127.0.0.1:3001" };
    const verifyUrl = "/api/auth/email-otp/verify-email";
    expect((await request.post(verifyUrl, { headers, data: { email, otp: "A1B2C3" } })).status()).toBe(400);
    const resend = () => request.post("/api/auth/email-otp/send-verification-otp", { headers, data: { email, type: "email-verification" } });
    expect((await resend()).status()).toBe(200);
    for (let attempt = 0; attempt < 5; attempt++) expect((await request.post(verifyUrl, { headers, data: { email, otp: "XXXXXX" } })).ok()).toBe(false);
    expect((await request.post(verifyUrl, { headers, data: { email, otp: "A1B2C3" } })).ok()).toBe(false);
    expect((await resend()).status()).toBe(200);
    await verify(request, email);
  } finally { await db.end(); }
});

test("revisão visual das sete telas e regressão do login em desktop e celular", async ({ page }) => {
  test.setTimeout(120000);
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await mkdir("artifacts", { recursive: true });
  for (const viewport of [{ width: 1584, height: 993 }, { width: 390, height: 844 }]) {
    await page.context().clearCookies();
    await page.setViewportSize(viewport);
    const w = viewport.width;
    await page.goto("/login"); await screenshot(page, "login-final-" + w);
    await page.goto("/cadastro"); await screenshot(page, "cadastro-final-" + w);
    const email = await signup(page.request);
    await page.goto("/cadastro/confirmar-email"); await screenshot(page, "confirmar-final-" + w);
    await verify(page.request, email);
    await page.goto("/cadastro/concluido"); await screenshot(page, "conta-final-" + w);
    await page.goto("/eventos/novo/personalizacao"); await expect(page).toHaveURL(/tipo$/);
    await screenshot(page, "tipo-final-" + w);
    const current = (await (await page.request.get("/api/eventos/rascunho")).json()).event;
    await patch(page.request, current.id, { type: "BIRTHDAY" });
    await page.goto("/eventos/novo/informacoes"); await screenshot(page, "informacoes-final-" + w);
    await patch(page.request, current.id, { name: "Aniversário da Ana", eventDate: "2026-09-08" });
    await page.goto("/eventos/novo/personalizacao"); await screenshot(page, "personalizacao-final-" + w);
    await page.getByRole("button", { name: "Personalizar depois", exact: true }).click();
    await expect(page).toHaveURL(/criado$/);
    await screenshot(page, "album-final-" + w);
    await page.getByRole("link", { name: "Ir para meu álbum", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Olá, Ana!" })).toBeVisible();
    await screenshot(page, "dashboard-final-" + w);
  }
  expect(runtimeErrors).toEqual([]);
});

test("login móvel não transfere as fotos decorativas ocultas", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    const requestedImages: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/images/login/") && request.resourceType() === "image") requestedImages.push(request.url());
    });
    await page.goto("/login");
    expect(requestedImages).toEqual([]);
  } finally { await context.close(); }
});
