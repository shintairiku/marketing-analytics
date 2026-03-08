import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { GoogleApiError } from "@/lib/gsc/types";
import { getRequiredEnv } from "@/lib/server/env";
import { getTokenFromSupabase, withRefreshedAccessToken } from "@/lib/server/gsc/token";

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

type ClaudeMessageResponse = {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
};

type SearchAnalyticsDimension = "query" | "page" | "date" | "device" | "country";

type ChatRequestBody = {
  siteUrl?: string;
  message?: string;
  dimension?: SearchAnalyticsDimension;
  startDate?: string;
  endDate?: string;
  rowLimit?: number;
};

type ParsedBaseRequest = {
  siteUrl: string;
  startDate: string;
  endDate: string;
  rowLimit: number;
};

type ParsedAnalyticsRequest = ParsedBaseRequest & {
  dimension: SearchAnalyticsDimension;
};

type ParsedChatRequest = ParsedBaseRequest & {
  message: string;
};

type NormalizedAnalyticsRow = {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

const DEFAULT_ROW_LIMIT = 10;
const MAX_ROW_LIMIT = 25000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_DIMENSIONS: SearchAnalyticsDimension[] = ["query", "page", "date", "device", "country"];

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

function parseBaseRequest(body: ChatRequestBody): ParsedBaseRequest {
  if (!body.siteUrl || !body.siteUrl.trim()) {
    throw new Error("invalid_site_url");
  }

  const siteUrl = body.siteUrl.trim();
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

  return { siteUrl, startDate, endDate, rowLimit };
}

function parseAnalyticsRequest(body: ChatRequestBody): ParsedAnalyticsRequest {
  const base = parseBaseRequest(body);
  const dimension = body.dimension;
  if (!dimension || !ALLOWED_DIMENSIONS.includes(dimension)) {
    throw new Error("invalid_dimension");
  }
  return { ...base, dimension };
}

function parseChatRequest(body: ChatRequestBody): ParsedChatRequest {
  const base = parseBaseRequest(body);
  if (!body.message || !body.message.trim()) {
    throw new Error("invalid_message");
  }
  return { ...base, message: body.message.trim() };
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

function normalizeRows(rows: GscSearchAnalyticsRow[] | undefined): NormalizedAnalyticsRow[] {
  return (
    rows?.map((row) => ({
      key: row.keys?.[0] ?? "",
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    })) ?? []
  );
}

async function buildChatAnswer(params: {
  accessToken: string;
  request: ParsedChatRequest;
}): Promise<{
  answer: string;
  analytics: {
    query: NormalizedAnalyticsRow[];
    page: NormalizedAnalyticsRow[];
    date: NormalizedAnalyticsRow[];
    device: NormalizedAnalyticsRow[];
    country: NormalizedAnalyticsRow[];
  };
}> {
  const { accessToken, request } = params;

  const dimensionConfigs: Array<{ dimension: SearchAnalyticsDimension; rowLimit: number }> = [
    { dimension: "query", rowLimit: Math.min(request.rowLimit, 10) },
    { dimension: "page", rowLimit: Math.min(request.rowLimit, 10) },
    { dimension: "date", rowLimit: 30 },
    { dimension: "device", rowLimit: 10 },
    { dimension: "country", rowLimit: 10 },
  ];

  const results = await Promise.all(
    dimensionConfigs.map(async (config) => {
      const raw = await fetchSearchAnalytics(accessToken, {
        siteUrl: request.siteUrl,
        startDate: request.startDate,
        endDate: request.endDate,
        dimension: config.dimension,
        rowLimit: config.rowLimit,
      });
      return { dimension: config.dimension, rows: normalizeRows(raw.rows) };
    }),
  );

  const analytics = {
    query: results.find((item) => item.dimension === "query")?.rows ?? [],
    page: results.find((item) => item.dimension === "page")?.rows ?? [],
    date: results.find((item) => item.dimension === "date")?.rows ?? [],
    device: results.find((item) => item.dimension === "device")?.rows ?? [],
    country: results.find((item) => item.dimension === "country")?.rows ?? [],
  };

  const anthropicApiKey = getRequiredEnv("ANTHROPIC_API_KEY");
  const anthropicModel = process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest";

  const promptPayload = {
    siteUrl: request.siteUrl,
    startDate: request.startDate,
    endDate: request.endDate,
    userQuestion: request.message,
    analytics,
  };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: anthropicModel,
      max_tokens: 1200,
      system:
        "あなたはGoogle Search Consoleデータ分析のアシスタントです。必ず提供データの数値を根拠に日本語で具体的に回答してください。推測は避け、施策は優先度順に提案してください。",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `次のJSONデータを分析して質問に回答してください。\\n${JSON.stringify(promptPayload)}`,
            },
          ],
        },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API failed: ${response.status} ${errorText}`);
  }

  const result = (await response.json()) as ClaudeMessageResponse;
  const answer = result.content?.find((block) => block.type === "text")?.text?.trim();
  if (!answer) {
    throw new Error("invalid_claude_response");
  }

  return { answer, analytics };
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

    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const token = await getTokenFromSupabase(userId, supabaseUrl, serviceRoleKey);

    if (!token) {
      return NextResponse.json({ error: "gsc_not_connected" }, { status: 404 });
    }

    if (body.message && body.message.trim()) {
      const parsedChatRequest = parseChatRequest(body);
      const chatResult = await withRefreshedAccessToken({
        userId,
        token,
        supabaseUrl,
        serviceRoleKey,
        runWithToken: (accessToken) => buildChatAnswer({ accessToken, request: parsedChatRequest }),
        shouldRefreshRetry: (error) => (error as GoogleApiError).status === 401,
      });

      return NextResponse.json(
        {
          answer: chatResult.answer,
          siteUrl: parsedChatRequest.siteUrl,
          startDate: parsedChatRequest.startDate,
          endDate: parsedChatRequest.endDate,
          analytics: chatResult.analytics,
          fetchedAt: new Date().toISOString(),
        },
        { status: 200 },
      );
    }

    const parsedAnalyticsRequest = parseAnalyticsRequest(body);
    const analyticsRows = await withRefreshedAccessToken({
      userId,
      token,
      supabaseUrl,
      serviceRoleKey,
      runWithToken: async (accessToken) => {
        const analytics = await fetchSearchAnalytics(accessToken, parsedAnalyticsRequest);
        return normalizeRows(analytics.rows);
      },
      shouldRefreshRetry: (error) => (error as GoogleApiError).status === 401,
    });

    return NextResponse.json(
      {
        siteUrl: parsedAnalyticsRequest.siteUrl,
        dimension: parsedAnalyticsRequest.dimension,
        startDate: parsedAnalyticsRequest.startDate,
        endDate: parsedAnalyticsRequest.endDate,
        rowLimit: parsedAnalyticsRequest.rowLimit,
        rows: analyticsRows,
        total: analyticsRows.length,
        fetchedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("POST /api/chat failed:", error);

    if (error instanceof Error) {
      if (error.message.startsWith("Missing required")) {
        return NextResponse.json({ error: "missing_env" }, { status: 500 });
      }
      if (error.message === "refresh_token_missing") {
        return NextResponse.json(
          { error: "refresh_token_missing", action: "reconnect_gsc" },
          { status: 401 },
        );
      }
      if (error.message.includes("Google search analytics fetch failed: 403")) {
        return NextResponse.json({ error: "forbidden_site_or_scope" }, { status: 403 });
      }
      if (error.message.includes("Google search analytics fetch failed: 400")) {
        return NextResponse.json({ error: "invalid_gsc_request" }, { status: 400 });
      }
      if (error.message.startsWith("Claude API failed: 401")) {
        return NextResponse.json({ error: "invalid_anthropic_api_key" }, { status: 500 });
      }
      if (error.message.startsWith("Claude API failed: 429")) {
        return NextResponse.json({ error: "anthropic_rate_limited" }, { status: 429 });
      }
      if (error.message.startsWith("invalid_")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
