import "dotenv/config";
import { getCaptureClientMetadata } from "../src/lib/capture-integration";
import { prisma } from "../src/lib/prisma";

type LinkArgs = {
  ownerEmail: string;
  portalEventId: string;
  captureEventId: string;
  captureClientHash: string;
  apply: boolean;
};

function parseArgs(argv: string[]): LinkArgs {
  const values = new Map<string, string>();
  let apply = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") { apply = true; continue; }
    if (!arg.startsWith("--") || !argv[index + 1] || argv[index + 1].startsWith("--")) {
      throw new Error(`Argumento inválido: ${arg}`);
    }
    values.set(arg.slice(2), argv[index + 1]);
    index += 1;
  }
  const required = ["owner-email", "portal-event-id", "capture-event-id", "capture-client-hash"];
  for (const key of required) if (!values.get(key)?.trim()) throw new Error(`Informe --${key}.`);
  return {
    ownerEmail: values.get("owner-email")!.trim().toLowerCase(),
    portalEventId: values.get("portal-event-id")!.trim(),
    captureEventId: values.get("capture-event-id")!.trim(),
    captureClientHash: values.get("capture-client-hash")!.trim(),
    apply,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = new URL(process.env.CAPTURE_API_BASE_URL ?? "https://digax.productpulse.com.br").origin;
  const owner = await prisma.user.findFirst({ where: { email: args.ownerEmail, emailVerified: true }, select: { id: true } });
  if (!owner) throw new Error("A conta do proprietário não existe ou não está confirmada.");

  const portalEvent = await prisma.event.findUnique({ where: { id: args.portalEventId }, include: { captureIntegration: true } });
  if (!portalEvent || portalEvent.ownerId !== owner.id || portalEvent.state !== "CREATED") throw new Error("O álbum do portal não pertence ao proprietário ou não está concluído.");

  const metadata = await getCaptureClientMetadata(args.captureClientHash, baseUrl);
  if (metadata.id !== args.captureEventId) throw new Error("O evento informado não pertence ao hash de cliente informado.");

  const integrations = await prisma.captureIntegration.findMany({ where: { sourceEventId: args.captureEventId }, select: { id: true, eventId: true, sourceBaseUrl: true, sourceClientHash: true } });
  const remoteConflict = integrations.find((integration) => integration.eventId !== args.portalEventId || integration.sourceClientHash !== args.captureClientHash);
  if (remoteConflict) throw new Error("O evento de captura já está vinculado a outro álbum ou cliente.");
  if (portalEvent.captureIntegration && (portalEvent.captureIntegration.sourceEventId !== args.captureEventId || portalEvent.captureIntegration.sourceClientHash !== args.captureClientHash)) {
    throw new Error("O álbum do portal já está vinculado a outra captura.");
  }

  const existing = portalEvent.captureIntegration ?? integrations[0] ?? null;
  console.log(JSON.stringify({ mode: args.apply ? "apply" : "dry-run", portalEventId: args.portalEventId, captureEventId: args.captureEventId, captureClientHash: args.captureClientHash, sourceBaseUrl: baseUrl, sourceStoragePrefix: metadata.storagePrefix, existingIntegrationId: existing?.id ?? null }, null, 2));
  if (!args.apply) return;

  if (existing) {
    await prisma.captureIntegration.update({ where: { id: existing.id }, data: { eventId: args.portalEventId, sourceBaseUrl: baseUrl, sourceEventId: args.captureEventId, sourceClientHash: args.captureClientHash, sourceStoragePrefix: metadata.storagePrefix } });
  } else {
    await prisma.captureIntegration.create({ data: { eventId: args.portalEventId, sourceBaseUrl: baseUrl, sourceEventId: args.captureEventId, sourceClientHash: args.captureClientHash, sourceStoragePrefix: metadata.storagePrefix } });
  }
  console.log("Vínculo persistido.");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
