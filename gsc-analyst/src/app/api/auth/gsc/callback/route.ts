import { NextRequest, NextResponse } from "next/server";

const STATE_COOKIE_NAME = "gsc_oauth_state";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

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

export async function GET(req: NextRequest) {
  // Googleから返るクエリと、開始時に保存したstateを取得する。
  const state = req.nextUrl.searchParams.get("state");
  const code = req.nextUrl.searchParams.get("code");
  const oauthError = req.nextUrl.searchParams.get("error");
  const storedState = req.cookies.get(STATE_COOKIE_NAME)?.value;

  // ユーザーが同意を拒否した場合などはそのまま失敗理由を返す。
  if (oauthError) {
    return NextResponse.redirect(buildDashboardRedirect(req, "error", oauthError));
  }

  // state不一致は不正リクエストとして扱う。
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(
      buildDashboardRedirect(req, "error", "state_mismatch"),
    );
  }

  if (!code) {
    return NextResponse.redirect(buildDashboardRedirect(req, "error", "missing_code"));
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
      return NextResponse.redirect(
        buildDashboardRedirect(req, "error", "token_exchange_failed"),
      );
    }

    // Step 2ではトークン永続化は未実装。Step 3でDB保存を追加予定。
    const redirect = NextResponse.redirect(
      buildDashboardRedirect(req, "connected"),
    );
    // 使い終わったstate Cookieを削除する。
    redirect.cookies.set({
      name: STATE_COOKIE_NAME,
      value: "",
      maxAge: 0,
      path: "/",
    });
    return redirect;
  } catch (error) {
    console.error("GSC OAuth callback failed:", error);
    return NextResponse.redirect(buildDashboardRedirect(req, "error", "missing_env"));
  }
}
