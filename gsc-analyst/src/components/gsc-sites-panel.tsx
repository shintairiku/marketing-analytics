"use client";

import { useCallback, useEffect, useState } from "react";

type SiteItem = {
  siteUrl: string;
  permissionLevel: string;
};

type SitesApiSuccess = {
  sites: SiteItem[];
  total: number;
  fetchedAt: string;
};

type SitesApiError = {
  error: string;
  action?: string;
};

export function GscSitesPanel() {
  const [sites, setSites] = useState<SiteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSites = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/sites", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as Partial<SitesApiError>;
        setSites([]);
        setError(data.error ?? "failed_to_fetch_sites");
        return;
      }

      const data = (await response.json()) as SitesApiSuccess;
      setSites(data.sites ?? []);
    } catch {
      setSites([]);
      setError("network_error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSites();
  }, [loadSites]);

  return (
    <section className="w-full rounded-lg border bg-white p-4 text-left">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">連携サイト一覧</h2>
        <button
          type="button"
          onClick={() => void loadSites()}
          disabled={loading}
          className="rounded-md border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          再取得
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">サイト一覧を取得中...</p>}

      {!loading && error && (
        <p className="text-sm text-red-700">
          サイト一覧の取得に失敗しました: {error}
        </p>
      )}

      {!loading && !error && sites.length === 0 && (
        <p className="text-sm text-gray-600">連携済みサイトが見つかりませんでした。</p>
      )}

      {!loading && !error && sites.length > 0 && (
        <ul className="space-y-2">
          {sites.map((site) => (
            <li key={site.siteUrl} className="rounded-md border bg-gray-50 p-3">
              <p className="break-all text-sm font-medium text-gray-900">{site.siteUrl}</p>
              <p className="mt-1 text-xs text-gray-600">権限: {site.permissionLevel}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
