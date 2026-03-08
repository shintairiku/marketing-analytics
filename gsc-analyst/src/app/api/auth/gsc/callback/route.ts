import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { GoogleTokenResponse } from "@/lib/gsc/types";
import { getRequiredEnv } from "@/lib/server/env";
import { buildSupabaseHeaders } from "@/lib/server/gsc/token";

const STATE_COOKIE_NAME = "gsc_oauth_state";

function buildDashboardRedirect(
  req: NextRequest,
  status: "connected" | "error",
  reason?: string,
) {
  const url = req.nextUrl.clone();
  url.pathname = "/dashboard";
  url.searchParams.set("gsc", status);
  if (reason) {
    url.searchParams.set("reason", reason);
  }
  return url;
}

function buildDashboardResponse(
  req: NextRequest,
  status: "connected" | "error",
  reason?: string,
) {
  const response = NextResponse.redirect(
    buildDashboardRedirect(req, status, reason),
  );
  // callback処理後はstate Cookieを必ず破棄する。
  response.cookies.set({
    name: STATE_COOKIE_NAME,
    value: "",
    maxAge: 0,
    path: "/",
  });
  return response;
}

async function saveTokenToSupabase(
  userId: string,
  token: GoogleTokenResponse,
): Promise<void> {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

  const response = await fetch(
    `${supabaseUrl}/rest/v1/gsc_oauth_tokens?on_conflict=clerk_user_id`,
    {
      method: "POST",
      headers: {
        ...buildSupabaseHeaders(supabaseServiceRoleKey),
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        clerk_user_id: userId,
        access_token: token.access_token,
        refresh_token: token.refresh_token ?? null,
        scope: token.scope,
        token_type: token.token_type,
        expires_at: expiresAt,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase save failed: ${response.status} ${errorText}`);
  }
}

export async function GET(req: NextRequest) {
  // Googleから返るクエリと、開始時に保存したstateを取得する。
  const state = req.nextUrl.searchParams.get("state");
  const code = req.nextUrl.searchParams.get("code");
  const oauthError = req.nextUrl.searchParams.get("error");
  const storedState = req.cookies.get(STATE_COOKIE_NAME)?.value;
  const { userId } = await auth();

  // ユーザーが同意を拒否した場合などはそのまま失敗理由を返す。
  if (oauthError) {
    return buildDashboardResponse(req, "error", oauthError);
  }

  if (!userId) {
    return buildDashboardResponse(req, "error", "unauthorized");
  }

  // state不一致は不正リクエストとして扱う。
  if (!state || !storedState || state !== storedState) {
    return buildDashboardResponse(req, "error", "state_mismatch");
  }

  if (!code) {
    return buildDashboardResponse(req, "error", "missing_code");
  }

  try {
    // 認可コードをアクセストークンへ交換する。
    const clientId = getRequiredEnv("GOOGLE_OAUTH_CLIENT_ID");
    const clientSecret = getRequiredEnv("GOOGLE_OAUTH_CLIENT_SECRET");
    const redirectUri = getRequiredEnv("GOOGLE_OAUTH_REDIRECT_URI");

    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("GSC token exchange failed:", errorText);
      return buildDashboardResponse(req, "error", "token_exchange_failed");
    }

    const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;
    await saveTokenToSupabase(userId, tokenData);

    return buildDashboardResponse(req, "connected");
  } catch (error) {
    console.error("GSC OAuth callback failed:", error);
    if (error instanceof Error && error.message.startsWith("Missing required")) {
      return buildDashboardResponse(req, "error", "missing_env");
    }
    return buildDashboardResponse(req, "error", "storage_failed");
  }
}
