"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { AuthModeToggle } from "@/components/auth-mode-toggle";
import { GoogleConnectButton } from "@/components/google-connect-button";
import type { GoogleAuthMode } from "@/lib/google-auth-mode";
import { parseGoogleAuthMode } from "@/lib/google-auth-mode";
import { getBrowserBackendOrigin } from "@/lib/browser-config";

type AuthModePanelProps = {
  initialMode: GoogleAuthMode;
  connectionStatus?: string;
  reason?: string;
};

type AuthModeResponse = {
  mode?: string;
};

export function AuthModePanel({
  initialMode,
  connectionStatus,
  reason,
}: AuthModePanelProps) {
  const { getToken } = useAuth();
  const [mode, setMode] = useState<GoogleAuthMode>(initialMode);

  useEffect(() => {
    let cancelled = false;

    async function loadMode() {
      try {
        const token = await getToken();
        const response = await fetch(`${getBrowserBackendOrigin()}/api/auth/mode/current`, {
          method: "GET",
          credentials: "include",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as AuthModeResponse;
        if (!cancelled) {
          setMode(parseGoogleAuthMode(data.mode));
        }
      } catch {
        // モード取得失敗時は現在の表示値を維持する
      }
    }

    void loadMode();

    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const isConnected = connectionStatus === "connected" || mode === "service_account";
  const isError = connectionStatus === "error";

  return (
    <>
      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-gray-700">認証方式</p>
        <AuthModeToggle
          key={mode}
          initialMode={mode}
          onModeChange={setMode}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {mode === "oauth" ? (
          <GoogleConnectButton />
        ) : (
          <p className="text-sm text-green-700">
            サービスアカウント認証モードです。ユーザーごとの Google OAuth 連携は不要です。
          </p>
        )}
        {mode === "oauth" && isConnected && (
          <p className="text-sm text-green-700">Google OAuth連携に成功しました。</p>
        )}
        {isError && (
          <p className="text-sm text-red-700">
            Google OAuth連携に失敗しました: {reason ?? "unknown_error"}
          </p>
        )}
      </div>
    </>
  );
}
