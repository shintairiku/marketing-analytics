'use client'

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProviderCard } from "@/components/analytics/ProviderCard"
import { AnalyticsChart } from "@/components/analytics/AnalyticsChart"
import { MetricCard } from "@/components/analytics/MetricCard"
import { 
  analyticsProviders,
  mockGA4Data,
  mockGSCData,
  mockSocialData,
  mockSEMRushData,
  convertGA4ToMetrics,
  convertGSCToMetrics,
  convertSocialToMetrics,
  convertSEMRushToMetrics
} from "@/data/mockData"
import { AnalyticsSummary } from "@/types/analytics"
import { BarChart3, TrendingUp, Users, MousePointer, RefreshCw } from "lucide-react"

export default function AnalyticsDashboard() {
  const [refreshing, setRefreshing] = useState(false)

  // サマリー統計の計算
  const summary: AnalyticsSummary = {
    totalSessions: mockGA4Data.metrics.sessions,
    totalUsers: mockGA4Data.metrics.users,
    totalConversions: mockGA4Data.metrics.conversions,
    avgConversionRate: mockGA4Data.metrics.conversionRate,
    totalClicks: mockGSCData.metrics.clicks,
    totalImpressions: mockGSCData.metrics.impressions,
    avgPosition: mockGSCData.metrics.avgPosition,
    lastSyncDate: new Date().toLocaleString('ja-JP')
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    // 実際のAPIコールのシミュレーション
    setTimeout(() => setRefreshing(false), 2000)
  }

  const summaryMetrics = [
    {
      id: 'sessions',
      label: '総セッション数',
      value: summary.totalSessions,
      format: 'number' as const,
      trend: { value: 5.2, direction: 'up' as const, period: '前月' }
    },
    {
      id: 'users',
      label: '総ユーザー数',
      value: summary.totalUsers,
      format: 'number' as const,
      trend: { value: 3.1, direction: 'up' as const, period: '前月' }
    },
    {
      id: 'clicks',
      label: '総クリック数',
      value: summary.totalClicks,
      format: 'number' as const,
      trend: { value: 8.7, direction: 'up' as const, period: '前月' }
    },
    {
      id: 'conversions',
      label: '総コンバージョン数',
      value: summary.totalConversions,
      format: 'number' as const,
      trend: { value: 12.5, direction: 'up' as const, period: '前月' }
    }
  ]

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Deal ID: 12345 | 最終同期: {summary.lastSyncDate}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? '更新中...' : 'データ更新'}
        </button>
      </div>

      {/* サマリーカード */}
      {/* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryMetrics.map((metric) => (
          <MetricCard 
            key={metric.id} 
            metric={metric}
            providerColor="#3b82f6"
          />
        ))}
      </div> */}

      {/* メインタブ */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="ga4">GA4</TabsTrigger>
          <TabsTrigger value="gsc">GSC</TabsTrigger>
          <TabsTrigger value="social">ソーシャル</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
        </TabsList>

        {/* 概要タブ */}
        <TabsContent value="overview" className="space-y-6">
          {/* アクティブプロバイダー */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">アクティブなプロバイダー</h2>
            
            {/* GA4 プロバイダーカード */}
            <ProviderCard
              provider={analyticsProviders[0]}
              metrics={convertGA4ToMetrics(mockGA4Data)}
              lastUpdated={mockGA4Data.lastUpdated}
            />

            {/* GSC プロバイダーカード */}
            <ProviderCard
              provider={analyticsProviders[1]}
              metrics={convertGSCToMetrics(mockGSCData)}
              lastUpdated={mockGSCData.lastUpdated}
            />
          </div>

          {/* 統合チャート */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnalyticsChart
              title="セッショントレンド"
              description="過去30日間のセッション数推移"
              data={mockGA4Data.chartData}
              dataKey="sessions"
              color="#FF6B35"
              type="area"
            />
            <AnalyticsChart
              title="クリック数トレンド"
              description="過去30日間のクリック数推移"
              data={mockGSCData.chartData}
              dataKey="clicks"
              color="#4285F4"
              type="line"
            />
          </div>

          {/* Top検索クエリ */}
          <Card>
            <CardHeader>
              <CardTitle>Top検索クエリ</CardTitle>
              <CardDescription>Google Search Consoleからの上位クエリ</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockGSCData.topQueries.slice(0, 5).map((query, index) => (
                  <div key={query.query} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{query.query}</p>
                        <p className="text-sm text-muted-foreground">
                          順位: {query.position.toFixed(1)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{query.clicks.toLocaleString()}クリック</p>
                      <p className="text-sm text-muted-foreground">
                        CTR: {query.ctr.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GA4詳細タブ */}
        <TabsContent value="ga4" className="space-y-6">
          <ProviderCard
            provider={analyticsProviders[0]}
            metrics={convertGA4ToMetrics(mockGA4Data)}
            lastUpdated={mockGA4Data.lastUpdated}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnalyticsChart
              title="セッション数"
              data={mockGA4Data.chartData}
              dataKey="sessions"
              color="#FF6B35"
              type="area"
            />
            <AnalyticsChart
              title="ユーザー数"
              data={mockGA4Data.chartData}
              dataKey="users"
              color="#34D399"
              type="line"
            />
          </div>
        </TabsContent>

        {/* GSC詳細タブ */}
        <TabsContent value="gsc" className="space-y-6">
          <ProviderCard
            provider={analyticsProviders[1]}
            metrics={convertGSCToMetrics(mockGSCData)}
            lastUpdated={mockGSCData.lastUpdated}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnalyticsChart
              title="クリック数"
              data={mockGSCData.chartData}
              dataKey="clicks"
              color="#4285F4"
              type="bar"
            />
            <AnalyticsChart
              title="表示回数"
              data={mockGSCData.chartData}
              dataKey="impressions"
              color="#8B5CF6"
              type="area"
            />
          </div>
        </TabsContent>

        {/* 将来のプロバイダータブ（デモ用） */}
        <TabsContent value="social" className="space-y-6">
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">ソーシャルメディア分析</h3>
            <p className="text-muted-foreground mb-6">
              このプロバイダーは将来のリリースで利用可能になります
            </p>
            <div className="max-w-md mx-auto">
              <ProviderCard
                provider={analyticsProviders[2]}
                metrics={convertSocialToMetrics(mockSocialData)}
                lastUpdated={mockSocialData.lastUpdated}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="seo" className="space-y-6">
          <div className="text-center py-12">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">SEO分析ツール</h3>
            <p className="text-muted-foreground mb-6">
              SEMrush、Ahrefs等のSEOツール連携は将来のリリースで利用可能になります
            </p>
            <div className="max-w-md mx-auto">
              <ProviderCard
                provider={analyticsProviders[3]}
                metrics={convertSEMRushToMetrics(mockSEMRushData)}
                lastUpdated={mockSEMRushData.lastUpdated}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}