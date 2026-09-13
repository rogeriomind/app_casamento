import { NextResponse } from "next/server";
import { getDraftForUser, getOrCreateDraftForUser } from "@/lib/events";
import { apiResponse, apiUser } from "@/lib/api";
export function GET(request: Request) {
  return apiResponse(request, async () => NextResponse.json({ event: await getDraftForUser((await apiUser()).id) }));
}
export function POST(request: Request) {
  return apiResponse(request, async () => NextResponse.json({ event: await getOrCreateDraftForUser((await apiUser()).id) }));
}
