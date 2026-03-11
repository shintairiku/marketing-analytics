import { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_AUTH_MODE_COOKIE_NAME,
  parseGoogleAuthMode,
} from "@/lib/server/google/auth-mode";

function resolveRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/")) {
    return "/dashboard";
  }
  return value;
}

export async function GET(req: NextRequest) {
  const mode = parseGoogleAuthMode(req.nextUrl.searchParams.get("mode"));
  const redirectPath = resolveRedirectPath(req.nextUrl.searchParams.get("redirect"));
  const url = req.nextUrl.clone();
  url.pathname = redirectPath;
  url.search = "";

  const response = NextResponse.redirect(url);
  response.cookies.set({
    name: GOOGLE_AUTH_MODE_COOKIE_NAME,
    value: mode,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
