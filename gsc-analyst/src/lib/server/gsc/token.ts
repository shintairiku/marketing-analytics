import type { GoogleRefreshResponse, SupabaseTokenUpdatePayload, TokenRow } from "@/lib/gsc/types";
import { getRequiredEnv } from "@/lib/server/env";

export function buildSupabaseHeaders(serviceRoleKey: string): HeadersInit {
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

export async function getTokenFromSupabase(
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

export async function updateTokenInSupabase(
  userId: string,
  data: SupabaseTokenUpdatePayload,
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

export async function refreshAccessToken(refreshToken: string): Promise<GoogleRefreshResponse> {
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

export async function withRefreshedAccessToken<T>(params: {
  userId: string;
  token: TokenRow;
  supabaseUrl: string;
  serviceRoleKey: string;
  runWithToken: (accessToken: string) => Promise<T>;
  shouldRefreshRetry: (error: unknown) => boolean;
}): Promise<T> {
  const { userId, token, supabaseUrl, serviceRoleKey, runWithToken, shouldRefreshRetry } = params;

  let accessToken = token.access_token;
  let canRetryByRefresh = false;

  if (isExpired(token.expires_at)) {
    if (!token.refresh_token) {
      throw new Error("refresh_token_missing");
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
    canRetryByRefresh = !!token.refresh_token;
  }

  try {
    return await runWithToken(accessToken);
  } catch (error) {
    if (!canRetryByRefresh || !token.refresh_token || !shouldRefreshRetry(error)) {
      throw error;
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

    return runWithToken(refreshed.access_token);
  }
}
