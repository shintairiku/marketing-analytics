import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

type TokenRow = {
  clerk_user_id: string;
  access_token: string;
  refresh_token: string | null;
  scope: string;
  token_type: string;
  expires_at: string;
};

type GoogleRefreshResponse = {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
};

type GoogleSitesResponse = {
  siteEntry?: Array<{
    siteUrl: string;
    permissionLevel: string;
  }>;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildSupabaseHeaders(serviceRoleKey: string): HeadersInit {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

function isExpired(expiresAtIso: string, bufferSeconds = 60): boolean {
  const expiresAt = Date.parse(expiresAtIso);
  if (Number.isNaN(expiresAt)) {
    return true;
  }
  return expiresAt <= Date.now() + bufferSeconds * 1000;
}

async function getTokenFromSupabase(
  userId: string,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<TokenRow | null> {
  const url = new URL(`${supabaseUrl}/rest/v1/gsc_oauth_tokens`);
  url.searchParams.set("select", "clerk_user_id,access_token,refresh_token,scope,token_type,expires_at");
  url.searchParams.set("clerk_user_id", `eq.${userId}`);
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: buildSupabaseHeaders(serviceRoleKey),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase fetch failed: ${response.status} ${errorText}`);
  }

  const rows = (await response.json()) as TokenRow[];
  return rows[0] ?? null;
}

async function updateTokenInSupabase(
  userId: string,
  data: {
    access_token: string;
    expires_at: string;
    scope?: string;
    token_type?: string;
  },
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<void> {
  const url = new URL(`${supabaseUrl}/rest/v1/gsc_oauth_tokens`);
  url.searchParams.set("clerk_user_id", `eq.${userId}`);

  const response = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      ...buildSupabaseHeaders(serviceRoleKey),
      Prefer: "return=minimal",
    },
    body: JSON.stringify(data),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase update failed: ${response.status} ${errorText}`);
  }
}

async function refreshAccessToken(refreshToken: string): Promise<GoogleRefreshResponse> {
  const clientId = getRequiredEnv("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = getRequiredEnv("GOOGLE_OAUTH_CLIENT_SECRET");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google refresh failed: ${response.status} ${errorText}`);
  }

  return (await response.json()) as GoogleRefreshResponse;
}

async function fetchSites(accessToken: string): Promise<GoogleSitesResponse> {
  const response = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google sites fetch failed: ${response.status} ${errorText}`);
  }

  return (await response.json()) as GoogleSitesResponse;
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const token = await getTokenFromSupabase(userId, supabaseUrl, serviceRoleKey);

    if (!token) {
      return NextResponse.json({ error: "gsc_not_connected" }, { status: 404 });
    }

    let accessToken = token.access_token;
    let shouldRetryByRefresh = false;

    if (isExpired(token.expires_at)) {
      if (!token.refresh_token) {
        return NextResponse.json(
          { error: "refresh_token_missing", action: "reconnect_gsc" },
          { status: 401 },
        );
      }

      const refreshed = await refreshAccessToken(token.refresh_token);
      const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await updateTokenInSupabase(
        userId,
        {
          access_token: refreshed.access_token,
          expires_at: expiresAt,
          scope: refreshed.scope,
          token_type: refreshed.token_type,
        },
        supabaseUrl,
        serviceRoleKey,
      );
      accessToken = refreshed.access_token;
    } else {
      shouldRetryByRefresh = !!token.refresh_token;
    }

    try {
      const sitesResponse = await fetchSites(accessToken);
      const sites =
        sitesResponse.siteEntry?.map((site) => ({
          siteUrl: site.siteUrl,
          permissionLevel: site.permissionLevel,
        })) ?? [];

      return NextResponse.json(
        {
          sites,
          total: sites.length,
          fetchedAt: new Date().toISOString(),
        },
        { status: 200 },
      );
    } catch (error) {
      if (!shouldRetryByRefresh || !token.refresh_token) {
        throw error;
      }

      // access_tokenが失効していた場合のフォールバックとして1度だけ再発行する。
      const refreshed = await refreshAccessToken(token.refresh_token);
      const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await updateTokenInSupabase(
        userId,
        {
          access_token: refreshed.access_token,
          expires_at: expiresAt,
          scope: refreshed.scope,
          token_type: refreshed.token_type,
        },
        supabaseUrl,
        serviceRoleKey,
      );

      const sitesResponse = await fetchSites(refreshed.access_token);
      const sites =
        sitesResponse.siteEntry?.map((site) => ({
          siteUrl: site.siteUrl,
          permissionLevel: site.permissionLevel,
        })) ?? [];

      return NextResponse.json(
        {
          sites,
          total: sites.length,
          fetchedAt: new Date().toISOString(),
        },
        { status: 200 },
      );
    }
  } catch (error) {
    console.error("GET /api/sites failed:", error);

    if (error instanceof Error && error.message.startsWith("Missing required")) {
      return NextResponse.json({ error: "missing_env" }, { status: 500 });
    }

    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
