import { NextResponse } from "next/server";
import { runAnalyticsAgent } from "@/lib/server/agent/analytics-agent";
import { buildAnalyticsMcpTools } from "@/lib/server/mcp/analytics-tools";
import { getGoogleAccessContext, withGoogleAccessToken } from "@/lib/server/google/access";
import { corsPreflight, withCors } from "@/lib/server/cors";
import { requireUserId } from "@/lib/server/request-auth";

type ChatRequestBody = {
  message?: string;
};

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
        return runAnalyticsAgent({
          userMessage: message,
          tools,
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
