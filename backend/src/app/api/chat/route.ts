import { NextResponse } from "next/server";
import { runAnalyticsAgent } from "@/lib/server/agent/analytics-agent";
import { buildAnalyticsMcpTools } from "@/lib/server/mcp/analytics-tools";
import { getGoogleAccessContext, withGoogleAccessToken } from "@/lib/server/google/access";
import { corsPreflight, withCors } from "@/lib/server/cors";
import { requireUserId } from "@/lib/server/request-auth";

type ChatRequestBody = {
  message?: string;
};

function buildReferenceDateContext() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const referenceDate = `${lookup.year}-${lookup.month}-${lookup.day}`;
  const referenceDateTime = `${referenceDate} ${lookup.hour}:${lookup.minute}:${lookup.second}`;

  return {
    referenceDate,
    referenceDateTime,
    referenceTimezone: "Asia/Tokyo",
  };
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId(req);

    const body = (await req.json().catch(() => null)) as ChatRequestBody | null;
    if (!body) {
      return withCors(NextResponse.json({ error: "invalid_json" }, { status: 400 }));
    }

    const message = body.message?.trim();
    if (!message) {
      return withCors(NextResponse.json({ error: "invalid_message" }, { status: 400 }));
    }

    const context = await getGoogleAccessContext(userId);
    if (context.mode === "oauth" && !context.token) {
      return withCors(NextResponse.json({ error: "google_not_connected" }, { status: 404 }));
    }

    const result = await withGoogleAccessToken({
      context,
      runWithToken: async (accessToken) => {
        const tools = buildAnalyticsMcpTools(accessToken);
        const dateContext = buildReferenceDateContext();
        return runAnalyticsAgent({
          userMessage: message,
          tools,
          ...dateContext,
        });
      },
      shouldRefreshRetry: () => true,
    });

    return withCors(NextResponse.json(
      {
        answer: result.answer,
        toolCalls: result.toolCalls,
        fetchedAt: new Date().toISOString(),
      },
      { status: 200 },
    ));
  } catch (error) {
    console.error("POST /api/chat failed:", error);

    if (error instanceof Error) {
      if (error.message === "unauthorized") {
        return withCors(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
      }
      if (error.message.startsWith("Missing required")) {
        return withCors(NextResponse.json({ error: "missing_env" }, { status: 500 }));
      }
      if (error.message === "refresh_token_missing") {
        return withCors(NextResponse.json(
          { error: "refresh_token_missing", action: "reconnect_google" },
          { status: 401 },
        ));
      }
      if (error.message.startsWith("Claude API failed: 401")) {
        return withCors(NextResponse.json({ error: "invalid_anthropic_api_key" }, { status: 500 }));
      }
      if (error.message.startsWith("Claude API failed: 429")) {
        return withCors(NextResponse.json({ error: "anthropic_rate_limited" }, { status: 429 }));
      }
      if (error.message === "agent_max_steps_exceeded") {
        return withCors(NextResponse.json({ error: "agent_max_steps_exceeded" }, { status: 500 }));
      }
      if (error.message.startsWith("gsc_") || error.message.startsWith("ga4_")) {
        return withCors(NextResponse.json({ error: error.message }, { status: 400 }));
      }
    }

    return withCors(NextResponse.json({ error: "internal_error" }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return corsPreflight();
}
