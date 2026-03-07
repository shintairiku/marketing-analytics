import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { GscSitesPanel } from "@/components/gsc-sites-panel";

type DashboardSearchParams = Promise<{
  gsc?: string;
  reason?: string;
}>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: DashboardSearchParams;
}) {
  // ログイン中ユーザー情報とOAuth結果クエリを画面表示に使う。
  const user = await currentUser();
  const params = await searchParams;
  const isConnected = params.gsc === "connected";
  const isError = params.gsc === "error";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">🔍 GSC アナリスト</h1>
        <UserButton />
      </header>

      {/* メイン */}
      <main className="max-w-2xl mx-auto mt-20 text-center px-4">
        <p className="text-gray-500 text-sm mb-2">ログイン中</p>
        <p className="text-xl font-medium mb-8">{user?.emailAddresses[0]?.emailAddress}</p>
        <div className="space-y-4">
          <p className="text-gray-600">
            Google Search Console を連携してサイト一覧を取得してください
          </p>
          <Link
            href="/api/auth/gsc"
            className="inline-block rounded-md bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700"
          >
            Googleアカウントを連携
          </Link>
          {isConnected && (
            <p className="text-sm text-green-700">
              GSC OAuth連携に成功し、トークンを保存しました。
            </p>
          )}
          {isError && (
            <p className="text-sm text-red-700">
              GSC OAuth連携に失敗しました: {params.reason ?? "unknown_error"}
            </p>
          )}
        </div>

        <div className="mt-8">
          <GscSitesPanel />
        </div>
      </main>
    </div>
  );
}
