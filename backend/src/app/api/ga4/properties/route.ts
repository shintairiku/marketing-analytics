import { NextResponse } from "next/server";
import { listGa4Properties } from "@/lib/server/analytics/providers/ga4";
import { getGoogleAccessContext, withGoogleAccessToken } from "@/lib/server/google/access";
import { corsPreflight, withCors } from "@/lib/server/cors";
import { requireUserId } from "@/lib/server/request-auth";

export async function GET(req: Request) {
  try {
    const userId = await requireUserId(req);

    const context = await getGoogleAccessContext(userId);
    if (context.mode === "oauth" && !context.token) {
      return withCors(NextResponse.json({ error: "google_not_connected" }, { status: 404 }));
    }

    const properties = await withGoogleAccessToken({
      context,
      runWithToken: (accessToken) => listGa4Properties(accessToken),
      shouldRefreshRetry: () => true,
    });

    return withCors(NextResponse.json(
      {
        properties,
        total: properties.length,
        fetchedAt: new Date().toISOString(),
      },
      { status: 200 },
    ));
  } catch (error) {
    console.error("GET /api/ga4/properties failed:", error);

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
      if (error.message.includes("GA4 properties fetch failed: 403")) {
        return withCors(NextResponse.json({ error: "forbidden_scope_or_account" }, { status: 403 }));
      }
    }

    return withCors(NextResponse.json({ error: "internal_error" }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return corsPreflight();
}
