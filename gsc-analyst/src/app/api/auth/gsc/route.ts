import { NextRequest, NextResponse } from "next/server";

const STATE_COOKIE_NAME = "gsc_oauth_state";
const DEFAULT_SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function GET(req: NextRequest) {
  try {
    // OAuth開始に必要な設定を環境変数から読み込む。
    const clientId = getRequiredEnv("GOOGLE_OAUTH_CLIENT_ID");
    const redirectUri = getRequiredEnv("GOOGLE_OAUTH_REDIRECT_URI");
    const scopes = (process.env.GOOGLE_OAUTH_SCOPES ?? DEFAULT_SCOPES.join(" "))
      .split(" ")
      .filter(Boolean);

    // CSRF対策のstateを発行して、Google同意画面URLを生成する。
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
    // callbackで照合するためstateをHTTP Only Cookieに保存する。
    response.cookies.set({
      name: STATE_COOKIE_NAME,
      value: state,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
    return response;
  } catch (error) {
    // 設定不足などで開始できない場合はdashboardへ失敗状態を返す。
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.set("gsc", "error");
    url.searchParams.set("reason", "missing_env");

    console.error("GSC OAuth init failed:", error);
    return NextResponse.redirect(url);
  }
}
