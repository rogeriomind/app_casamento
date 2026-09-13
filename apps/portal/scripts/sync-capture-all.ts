import "dotenv/config";
import { syncCaptureIntegration } from "../src/lib/capture-integration";
import { prisma } from "../src/lib/prisma";

async function main() {
  const integrations = await prisma.captureIntegration.findMany({ select: { eventId: true, event: { select: { ownerId: true } } }, orderBy: { updatedAt: "asc" } });
  let failed = false;
  for (const integration of integrations) {
    try {
      const result = await syncCaptureIntegration(integration.eventId, integration.event.ownerId);
      console.log(JSON.stringify({ eventId: integration.eventId, ...result }));
    } catch (error) {
      failed = true;
      console.error(JSON.stringify({ eventId: integration.eventId, error: error instanceof Error ? error.message : String(error) }));
    }
  }
  if (failed) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
