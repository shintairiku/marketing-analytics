import { NextRequest, NextResponse } from "next/server";
import { getRequiredEnv } from "@/lib/server/env";
import { buildFrontendDashboardUrl } from "@/lib/server/frontend-url";
import { getGoogleAuthMode } from "@/lib/server/google/auth-mode";
import { requireUserId } from "@/lib/server/request-auth";

const STATE_COOKIE_NAME = "google_oauth_state";
const DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
];

export async function GET(req: NextRequest) {
  if ((await getGoogleAuthMode()) === "service_account") {
    return NextResponse.redirect(
      buildFrontendDashboardUrl("connected", { mode: "service_account" }),
    );
  }

  try {
    const userId = await requireUserId(req);
    const clientId = getRequiredEnv("GOOGLE_OAUTH_CLIENT_ID");
    const redirectUri = getRequiredEnv("GOOGLE_OAUTH_REDIRECT_URI");
    const scopes = (process.env.GOOGLE_OAUTH_SCOPES ?? DEFAULT_SCOPES.join(" "))
      .split(" ")
      .filter(Boolean);

    const state = crypto.randomUUID();
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes.join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);

    const response = NextResponse.redirect(authUrl);
    response.cookies.set({
      name: STATE_COOKIE_NAME,
      value: JSON.stringify({ state, userId }),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
    return response;
  } catch (error) {
    console.error("Google OAuth init failed:", error);
    return NextResponse.redirect(buildFrontendDashboardUrl("error", { reason: "missing_env" }));
  }
}
