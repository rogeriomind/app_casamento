import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", service: "portal", commit: process.env.GIT_COMMIT ?? "unknown" });
  } catch {
    return NextResponse.json({ status: "error", service: "portal", commit: process.env.GIT_COMMIT ?? "unknown" }, { status: 503 });
  }
}
