import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

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

type GscSearchAnalyticsRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

type GscSearchAnalyticsResponse = {
  rows?: GscSearchAnalyticsRow[];
};

type SearchAnalyticsDimension = "query" | "page" | "date" | "device" | "country";

type ChatRequestBody = {
  siteUrl?: string;
  dimension?: SearchAnalyticsDimension;
  startDate?: string;
  endDate?: string;
  rowLimit?: number;
};

type GoogleApiError = Error & {
  status?: number;
};

const DEFAULT_ROW_LIMIT = 10;
const MAX_ROW_LIMIT = 25000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_DIMENSIONS: SearchAnalyticsDimension[] = [
  "query",
  "page",
  "date",
  "device",
  "country",
];

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

function formatDateAsIsoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function isValidIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed);
}

function parseRequestBody(body: ChatRequestBody): {
  siteUrl: string;
  dimension: SearchAnalyticsDimension;
  startDate: string;
  endDate: string;
  rowLimit: number;
} {
  if (!body.siteUrl || !body.siteUrl.trim()) {
    throw new Error("invalid_site_url");
  }

  const siteUrl = body.siteUrl.trim();
  const dimension = body.dimension;
  if (!dimension || !ALLOWED_DIMENSIONS.includes(dimension)) {
    throw new Error("invalid_dimension");
  }

  const rowLimit = body.rowLimit ?? DEFAULT_ROW_LIMIT;
  if (!Number.isInteger(rowLimit) || rowLimit <= 0 || rowLimit > MAX_ROW_LIMIT) {
    throw new Error("invalid_row_limit");
  }

  const defaultEndDate = new Date();
  defaultEndDate.setUTCDate(defaultEndDate.getUTCDate() - 3);
  const endDate = body.endDate ?? formatDateAsIsoDay(defaultEndDate);
  if (!isValidIsoDate(endDate)) {
    throw new Error("invalid_end_date");
  }

  const defaultStartDate = new Date(`${endDate}T00:00:00Z`);
  defaultStartDate.setUTCDate(defaultStartDate.getUTCDate() - 29);
  const startDate = body.startDate ?? formatDateAsIsoDay(defaultStartDate);
  if (!isValidIsoDate(startDate)) {
    throw new Error("invalid_start_date");
  }

  if (Date.parse(`${startDate}T00:00:00Z`) > Date.parse(`${endDate}T00:00:00Z`)) {
    throw new Error("invalid_date_range");
  }

  return {
    siteUrl,
    dimension,
    startDate,
    endDate,
    rowLimit,
  };
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

async function fetchSearchAnalytics(
  accessToken: string,
  params: {
    siteUrl: string;
    dimension: SearchAnalyticsDimension;
    startDate: string;
    endDate: string;
    rowLimit: number;
  },
): Promise<GscSearchAnalyticsResponse> {
  const url = new URL(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(params.siteUrl)}/searchAnalytics/query`,
  );

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: [params.dimension],
      rowLimit: params.rowLimit,
      dataState: "final",
      aggregationType: "auto",
      startRow: 0,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(
      `Google search analytics fetch failed: ${response.status} ${errorText}`,
    ) as GoogleApiError;
    error.status = response.status;
    throw error;
  }

  return (await response.json()) as GscSearchAnalyticsResponse;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as ChatRequestBody | null;
    if (!body) {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    let parsedBody: ReturnType<typeof parseRequestBody>;
    try {
      parsedBody = parseRequestBody(body);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "invalid_request" },
        { status: 400 },
      );
    }

    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const token = await getTokenFromSupabase(userId, supabaseUrl, serviceRoleKey);

    if (!token) {
      return NextResponse.json({ error: "gsc_not_connected" }, { status: 404 });
    }

    let accessToken = token.access_token;
    let canRetryByRefresh = false;

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
      canRetryByRefresh = !!token.refresh_token;
    }

    try {
      const analytics = await fetchSearchAnalytics(accessToken, parsedBody);
      const rows =
        analytics.rows?.map((row) => ({
          key: row.keys?.[0] ?? "",
          clicks: row.clicks ?? 0,
          impressions: row.impressions ?? 0,
          ctr: row.ctr ?? 0,
          position: row.position ?? 0,
        })) ?? [];

      return NextResponse.json(
        {
          siteUrl: parsedBody.siteUrl,
          dimension: parsedBody.dimension,
          startDate: parsedBody.startDate,
          endDate: parsedBody.endDate,
          rowLimit: parsedBody.rowLimit,
          rows,
          total: rows.length,
          fetchedAt: new Date().toISOString(),
        },
        { status: 200 },
      );
    } catch (error) {
      const googleError = error as GoogleApiError;
      if (!canRetryByRefresh || !token.refresh_token || googleError.status !== 401) {
        throw error;
      }

      // access_tokenがGoogle側で失効していた場合に1回だけ再発行する。
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

      const analytics = await fetchSearchAnalytics(refreshed.access_token, parsedBody);
      const rows =
        analytics.rows?.map((row) => ({
          key: row.keys?.[0] ?? "",
          clicks: row.clicks ?? 0,
          impressions: row.impressions ?? 0,
          ctr: row.ctr ?? 0,
          position: row.position ?? 0,
        })) ?? [];

      return NextResponse.json(
        {
          siteUrl: parsedBody.siteUrl,
          dimension: parsedBody.dimension,
          startDate: parsedBody.startDate,
          endDate: parsedBody.endDate,
          rowLimit: parsedBody.rowLimit,
          rows,
          total: rows.length,
          fetchedAt: new Date().toISOString(),
        },
        { status: 200 },
      );
    }
  } catch (error) {
    console.error("POST /api/chat failed:", error);

    if (error instanceof Error) {
      if (error.message.startsWith("Missing required")) {
        return NextResponse.json({ error: "missing_env" }, { status: 500 });
      }
      if (error.message.includes("Google search analytics fetch failed: 403")) {
        return NextResponse.json({ error: "forbidden_site_or_scope" }, { status: 403 });
      }
      if (error.message.includes("Google search analytics fetch failed: 400")) {
        return NextResponse.json({ error: "invalid_gsc_request" }, { status: 400 });
      }
    }

    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
