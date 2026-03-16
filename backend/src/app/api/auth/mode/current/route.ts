import { NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/server/cors";
import { getGoogleAuthMode } from "@/lib/server/google/auth-mode";

export async function GET() {
  const mode = await getGoogleAuthMode();
  return withCors(NextResponse.json({ mode }, { status: 200 }));
}

export async function OPTIONS() {
  return corsPreflight();
}
