"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";
import { getBrowserBackendOrigin } from "@/lib/browser-config";

export function GoogleConnectButton() {
  const { getToken } = useAuth();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending) {
      return;
    }

    setPending(true);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("missing_session_token");
      }

      const url = new URL("/api/auth/google", getBrowserBackendOrigin());
      url.searchParams.set("token", token);
      window.location.href = url.toString();
    } catch {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={pending}
      className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
    >
      Googleアカウントを連携
    </button>
  );
}
