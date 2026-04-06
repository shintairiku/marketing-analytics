# HubSpot Analytics Dashboard UI Extension

HubSpotのUI Extensionとして動作する多機能分析ダッシュボードです。GA4、GSC、将来的にはソーシャルメディア分析やSEOツールとの連携も可能な拡張可能な設計となっています。

## 🚀 機能

### 現在実装済み
- **GA4連携**: セッション、ユーザー、コンバージョン、エンゲージメント率
- **GSC連携**: クリック数、表示回数、CTR、平均掲載順位
- **統合ダッシュボード**: 複数プロバイダーのデータを一画面で表示
- **インタラクティブチャート**: Line, Area, Barチャートでトレンド表示
- **レスポンシブデザイン**: デスクトップ・モバイル対応

### 将来対応予定
- **ソーシャルメディア分析**: Twitter, Facebook, Instagram
- **SEOツール連携**: SEMrush, Ahrefs, Moz
- **カスタムKPI**: 業界別指標の追加
- **アラート機能**: 閾値ベースの通知システム

## 🏗️ 技術スタック

- **フレームワーク**: Next.js 14 (App Router)
- **UI ライブラリ**: React 18 + Shadcn/ui + Radix UI
- **スタイリング**: Tailwind CSS
- **チャートライブラリ**: Recharts
- **アイコン**: Lucide React
- **言語**: TypeScript

## 📁 プロジェクト構造

```
hubspot/ui-extension/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                 # Shadcn UIコンポーネント
│   │   │   ├── card.tsx
│   │   │   └── tabs.tsx
│   │   └── analytics/          # 分析専用コンポーネント
│   │       ├── MetricCard.tsx
│   │       ├── AnalyticsChart.tsx
│   │       └── ProviderCard.tsx
│   ├── types/
│   │   └── analytics.ts        # TypeScript型定義
│   ├── data/
│   │   └── mockData.ts         # デモ用データ
│   └── lib/
│       └── utils.ts            # ユーティリティ関数
├── package.json
├── next.config.js              # HubSpot UI Extension用設定
├── tailwind.config.js
└── tsconfig.json
```

## 🛠️ セットアップ

1. **依存関係のインストール**:
```bash
cd hubspot/ui-extension
npm install
```

2. **開発サーバー起動**:
```bash
npm run dev
```

3. **ビルド（HubSpot UI Extension用）**:
```bash
npm run build
```

## 🎨 設計思想

### 拡張可能性
- **プロバイダーパターン**: 新しい分析ツールを簡単に追加可能
- **型安全**: TypeScriptによる厳密な型定義
- **コンポーネント再利用**: MetricCard、AnalyticsChart等の汎用コンポーネント

### プロバイダー追加例
新しい分析ツールを追加する場合：

1. `src/types/analytics.ts`に新しいデータ型を定義
2. `src/data/mockData.ts`にプロバイダー情報とメトリクス変換関数を追加
3. `src/app/page.tsx`に新しいタブを追加

```typescript
// 新しいプロバイダーの例
export interface NewAnalyticsData {
  provider: 'new_tool'
  metrics: NewMetrics
  chartData: ChartDataPoint[]
  lastUpdated: string
}
```

### UI/UXの特徴
- **HubSpotライク**: HubSpotの既存UIに馴染むデザイン
- **情報密度**: 限られた画面領域で多くの情報を効果的に表示
- **パフォーマンス**: 仮想化とメモ化による高速描画

## 🔧 HubSpot UI Extension統合

### 設定ファイル例 (hubspot.config.yml)
```yaml
name: analytics-dashboard
version: 1.0.0
type: ui-extension
scopes:
  - crm.objects.deals.read
  - crm.objects.deals.write
extensions:
  - type: crm-card
    label: Analytics Dashboard  
    path: ./dist/index.html
    context: ["CRM_RECORD"]
```

### デプロイ手順
1. `npm run build`でStaticファイル生成
2. `dist/`フォルダをHubSpotにアップロード
3. UI Extensionとして取引レコードページに配置

## 📊 メトリクス仕様

### GA4メトリクス
- **セッション数**: `sessions`
- **ユーザー数**: `totalUsers`
- **エンゲージメント率**: `engagementRate`
- **コンバージョン数**: `conversions`
- **コンバージョン率**: `sessionConversionRate`

### GSCメトリクス
- **クリック数**: `clicks`
- **表示回数**: `impressions`
- **CTR**: `ctr`
- **平均掲載順位**: `position`

## 🚀 今後の拡張計画

1. **リアルタイムデータ**: WebSocket/SSEによるライブ更新
2. **カスタムダッシュボード**: ユーザー定義可能なレイアウト
3. **データエクスポート**: CSV/PDF出力機能
4. **比較分析**: 期間比較・競合比較機能
5. **予測分析**: Machine Learning基盤の統合

このダッシュボードは、HubSpotのUI Extensionの設計自由度を最大限活用し、将来の分析ニーズに対応できる拡張可能な基盤として設計されています。