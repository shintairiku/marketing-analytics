import { cookies } from "next/headers";

export const GOOGLE_AUTH_MODE_COOKIE_NAME = "google_auth_mode";

export type GoogleAuthMode = "oauth" | "service_account";

export function parseGoogleAuthMode(value: string | null | undefined): GoogleAuthMode {
  return value === "service_account" ? "service_account" : "oauth";
}

export async function getGoogleAuthMode(): Promise<GoogleAuthMode> {
  const cookieStore = await cookies();
  return parseGoogleAuthMode(cookieStore.get(GOOGLE_AUTH_MODE_COOKIE_NAME)?.value);
}
