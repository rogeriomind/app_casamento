import { NextResponse } from "next/server";
import { apiResponse, apiUser, HttpError } from "@/lib/api";
import { syncCaptureIntegration } from "@/lib/capture-integration";

type Params = { params: Promise<{ id: string }> };

function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const trusted = new Set([
    new URL(process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000").origin,
    "http://127.0.0.1:3000",
    "http://localhost:3000",
  ]);
  if (!origin || !trusted.has(origin)) throw new HttpError(403, "Origem da solicitação inválida.");
}

export async function POST(request: Request, { params }: Params) {
  return apiResponse(request, async () => {
    requireSameOrigin(request);
    const user = await apiUser();
    const { id } = await params;
    const result = await syncCaptureIntegration(id, user.id);
    return NextResponse.json(result, { status: result.status === "syncing" ? 202 : 200 });
  });
}
