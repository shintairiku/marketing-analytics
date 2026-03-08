import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getRequiredEnv } from "@/lib/server/env";
import { getTokenFromSupabase, withRefreshedAccessToken } from "@/lib/server/gsc/token";

type GoogleSitesResponse = {
  siteEntry?: Array<{
    siteUrl: string;
    permissionLevel: string;
  }>;
};

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

    const sitesResponse = await withRefreshedAccessToken({
      userId,
      token,
      supabaseUrl,
      serviceRoleKey,
      runWithToken: (accessToken) => fetchSites(accessToken),
      shouldRefreshRetry: () => true,
    });
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
    console.error("GET /api/sites failed:", error);

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
    }

    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
