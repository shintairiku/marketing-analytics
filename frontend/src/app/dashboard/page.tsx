import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { AuthModePanel } from "@/components/auth-mode-panel";
import { GscChatPanel } from "@/components/gsc-chat-panel";
import { parseGoogleAuthMode } from "@/lib/google-auth-mode";

type DashboardSearchParams = Promise<{
  google?: string;
  gsc?: string;
  reason?: string;
  mode?: string;
}>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: DashboardSearchParams;
}) {
  const user = await currentUser();
  const params = await searchParams;
  const authMode = parseGoogleAuthMode(params.mode);

  const connectionStatus = params.google ?? params.gsc;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <h1 className="text-lg font-semibold">Analytics アナリスト</h1>
        <UserButton />
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">ログイン中</p>
          <p className="mt-1 text-lg font-medium text-gray-900">{user?.emailAddresses[0]?.emailAddress}</p>
          <p className="mt-2 text-sm text-gray-600">
            Google連携1回で Search Console と GA4 を利用できます。分析サービスの選択はAIエージェントが自動で行います。
          </p>

          <AuthModePanel
            initialMode={authMode}
            connectionStatus={connectionStatus}
            reason={params.reason}
          />
        </div>

        <GscChatPanel />
      </main>
    </div>
  );
}
