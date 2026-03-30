import { 
  AnalyticsProvider, 
  GA4Data, 
  GSCData, 
  SocialMediaData,
  SEMRushData,
  Metric,
  ChartDataPoint 
} from "@/types/analytics"

// 分析プロバイダーの定義
export const analyticsProviders: AnalyticsProvider[] = [
  {
    id: 'ga4',
    name: 'Google Analytics 4',
    icon: 'GA4',
    color: '#FF6B35',
    enabled: true
  },
  {
    id: 'gsc',
    name: 'Google Search Console',
    icon: 'GSC',
    color: '#4285F4',
    enabled: true
  },
  {
    id: 'social',
    name: 'ソーシャルメディア',
    icon: 'SM',
    color: '#1DA1F2',
    enabled: false
  },
  {
    id: 'semrush',
    name: 'SEMrush',
    icon: 'SR',
    color: '#FF642D',
    enabled: false
  }
]

// チャートデータの生成
const generateChartData = (days: number, baseValue: number, variance: number): ChartDataPoint[] => {
  const data: ChartDataPoint[] = []
  const today = new Date()
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    
    data.push({
      date: date.toISOString().split('T')[0],
      value: Math.floor(baseValue + (Math.random() - 0.5) * variance),
      sessions: Math.floor(1000 + (Math.random() - 0.5) * 200),
      clicks: Math.floor(800 + (Math.random() - 0.5) * 150),
      impressions: Math.floor(15000 + (Math.random() - 0.5) * 3000),
      users: Math.floor(850 + (Math.random() - 0.5) * 180)
    })
  }
  
  return data
}

// GA4モックデータ
export const mockGA4Data: GA4Data = {
  provider: 'ga4',
  propertyId: 'GA_PROPERTY_12345',
  metrics: {
    sessions: 15420,
    users: 12890,
    engagementRate: 68.5,
    conversions: 245,
    conversionRate: 1.59,
    bounceRate: 31.5,
    avgSessionDuration: 142,
    pageViews: 28650
  },
  chartData: generateChartData(30, 500, 100),
  lastUpdated: new Date().toISOString()
}

// GSCモックデータ
export const mockGSCData: GSCData = {
  provider: 'gsc',
  siteUrl: 'https://example.com',
  metrics: {
    clicks: 8540,
    impressions: 125600,
    ctr: 6.8,
    avgPosition: 12.3,
    totalQueries: 1250
  },
  chartData: generateChartData(30, 300, 80),
  topQueries: [
    { query: 'ウェブマーケティング', clicks: 1250, impressions: 15400, ctr: 8.1, position: 3.2 },
    { query: 'SEO対策', clicks: 980, impressions: 12800, ctr: 7.7, position: 4.1 },
    { query: 'Google Analytics', clicks: 756, impressions: 9600, ctr: 7.9, position: 5.8 },
    { query: 'デジタルマーケティング', clicks: 654, impressions: 8900, ctr: 7.3, position: 6.2 },
    { query: 'コンバージョン最適化', clicks: 542, impressions: 7800, ctr: 7.0, position: 7.1 }
  ],
  lastUpdated: new Date().toISOString()
}

// ソーシャルメディアモックデータ
export const mockSocialData: SocialMediaData = {
  provider: 'social',
  platform: 'Twitter',
  metrics: {
    followers: 12400,
    engagement: 4.2,
    reach: 156800,
    mentions: 89
  },
  chartData: generateChartData(30, 50, 20),
  lastUpdated: new Date().toISOString()
}

// SEMrushモックデータ
export const mockSEMRushData: SEMRushData = {
  provider: 'semrush',
  domain: 'example.com',
  metrics: {
    organicKeywords: 2840,
    organicTraffic: 45600,
    backlinks: 1250,
    domainAuthority: 68
  },
  chartData: generateChartData(30, 1500, 300),
  lastUpdated: new Date().toISOString()
}

// メトリクス変換関数
export function convertGA4ToMetrics(data: GA4Data): Metric[] {
  return [
    {
      id: 'sessions',
      label: 'セッション数',
      value: data.metrics.sessions,
      format: 'number',
      trend: { value: 5.2, direction: 'up', period: '前月' }
    },
    {
      id: 'users',
      label: '総ユーザー数',
      value: data.metrics.users,
      format: 'number',
      trend: { value: 3.1, direction: 'up', period: '前月' }
    },
    {
      id: 'engagementRate',
      label: 'エンゲージメント率',
      value: data.metrics.engagementRate,
      format: 'percentage',
      trend: { value: 1.8, direction: 'up', period: '前月' }
    },
    {
      id: 'conversions',
      label: 'コンバージョン数',
      value: data.metrics.conversions,
      format: 'number',
      trend: { value: 12.5, direction: 'up', period: '前月' }
    },
    {
      id: 'conversionRate',
      label: 'コンバージョン率',
      value: data.metrics.conversionRate,
      format: 'percentage',
      trend: { value: 0.3, direction: 'down', period: '前月' }
    },
    {
      id: 'bounceRate',
      label: '直帰率',
      value: data.metrics.bounceRate,
      format: 'percentage',
      trend: { value: 2.1, direction: 'down', period: '前月' }
    }
  ]
}

export function convertGSCToMetrics(data: GSCData): Metric[] {
  return [
    {
      id: 'clicks',
      label: 'クリック数',
      value: data.metrics.clicks,
      format: 'number',
      trend: { value: 8.7, direction: 'up', period: '前月' }
    },
    {
      id: 'impressions',
      label: '表示回数',
      value: data.metrics.impressions,
      format: 'number',
      trend: { value: 4.2, direction: 'up', period: '前月' }
    },
    {
      id: 'ctr',
      label: 'クリック率',
      value: data.metrics.ctr,
      format: 'percentage',
      trend: { value: 0.5, direction: 'up', period: '前月' }
    },
    {
      id: 'avgPosition',
      label: '平均掲載順位',
      value: data.metrics.avgPosition,
      format: 'number',
      trend: { value: 1.2, direction: 'down', period: '前月' }
    },
    {
      id: 'totalQueries',
      label: '総クエリ数',
      value: data.metrics.totalQueries,
      format: 'number',
      trend: { value: 15.3, direction: 'up', period: '前月' }
    }
  ]
}

export function convertSocialToMetrics(data: SocialMediaData): Metric[] {
  return [
    {
      id: 'followers',
      label: 'フォロワー数',
      value: data.metrics.followers,
      format: 'number',
      trend: { value: 2.8, direction: 'up', period: '前月' }
    },
    {
      id: 'engagement',
      label: 'エンゲージメント率',
      value: data.metrics.engagement,
      format: 'percentage',
      trend: { value: 0.7, direction: 'up', period: '前月' }
    },
    {
      id: 'reach',
      label: 'リーチ数',
      value: data.metrics.reach,
      format: 'number',
      trend: { value: 12.1, direction: 'up', period: '前月' }
    },
    {
      id: 'mentions',
      label: 'メンション数',
      value: data.metrics.mentions,
      format: 'number',
      trend: { value: 5.4, direction: 'down', period: '前月' }
    }
  ]
}

export function convertSEMRushToMetrics(data: SEMRushData): Metric[] {
  return [
    {
      id: 'organicKeywords',
      label: 'オーガニックキーワード数',
      value: data.metrics.organicKeywords,
      format: 'number',
      trend: { value: 6.3, direction: 'up', period: '前月' }
    },
    {
      id: 'organicTraffic',
      label: 'オーガニックトラフィック',
      value: data.metrics.organicTraffic,
      format: 'number',
      trend: { value: 9.8, direction: 'up', period: '前月' }
    },
    {
      id: 'backlinks',
      label: 'バックリンク数',
      value: data.metrics.backlinks,
      format: 'number',
      trend: { value: 3.2, direction: 'up', period: '前月' }
    },
    {
      id: 'domainAuthority',
      label: 'ドメインオーソリティ',
      value: data.metrics.domainAuthority,
      format: 'number',
      trend: { value: 1.1, direction: 'up', period: '前月' }
    }
  ]
}