// 分析ツールの基本インターフェース
export interface AnalyticsProvider {
  id: string
  name: string
  icon: string
  color: string
  enabled: boolean
}

// メトリクスの基本型
export interface Metric {
  id: string
  label: string
  value: number | string
  format: 'number' | 'percentage' | 'currency' | 'duration'
  trend?: {
    value: number
    direction: 'up' | 'down' | 'stable'
    period: string
  }
}

// チャートデータの型
export interface ChartDataPoint {
  date: string
  [key: string]: any
}

// GA4関連の型
export interface GA4Metrics {
  sessions: number
  users: number
  engagementRate: number
  conversions: number
  conversionRate: number
  bounceRate: number
  avgSessionDuration: number
  pageViews: number
}

export interface GA4Data {
  provider: 'ga4'
  propertyId: string
  metrics: GA4Metrics
  chartData: ChartDataPoint[]
  lastUpdated: string
}

// GSC関連の型
export interface GSCMetrics {
  clicks: number
  impressions: number
  ctr: number
  avgPosition: number
  totalQueries: number
}

export interface GSCData {
  provider: 'gsc'
  siteUrl: string
  metrics: GSCMetrics
  chartData: ChartDataPoint[]
  topQueries: Array<{
    query: string
    clicks: number
    impressions: number
    ctr: number
    position: number
  }>
  lastUpdated: string
}

// 将来の拡張用プロバイダー
export interface SocialMediaMetrics {
  followers: number
  engagement: number
  reach: number
  mentions: number
}

export interface SocialMediaData {
  provider: 'social'
  platform: string
  metrics: SocialMediaMetrics
  chartData: ChartDataPoint[]
  lastUpdated: string
}

export interface SEMRushMetrics {
  organicKeywords: number
  organicTraffic: number
  backlinks: number
  domainAuthority: number
}

export interface SEMRushData {
  provider: 'semrush'
  domain: string
  metrics: SEMRushMetrics
  chartData: ChartDataPoint[]
  lastUpdated: string
}

// 統合データ型
export type AnalyticsData = GA4Data | GSCData | SocialMediaData | SEMRushData

// ダッシュボード設定
export interface DashboardConfig {
  dealId: string
  enabledProviders: string[]
  refreshInterval: number
  dateRange: {
    start: string
    end: string
    preset: 'last7days' | 'last30days' | 'last90days' | 'custom'
  }
}

// 統計サマリー
export interface AnalyticsSummary {
  totalSessions: number
  totalUsers: number
  totalConversions: number
  avgConversionRate: number
  totalClicks: number
  totalImpressions: number
  avgPosition: number
  lastSyncDate: string
}