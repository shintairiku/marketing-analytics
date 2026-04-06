# HubSpot CRM API クライアント

このスクリプトは、HubSpotのCRMから取引（Deal）レコードとプロパティを取得し、GA4/GSCのアナリティクスデータで更新するためのPythonクライアントです。

## 機能

- **プロパティ取得**: 取引オブジェクトのプロパティ一覧を取得
- **取引取得**: GA4プロパティIDまたはGSCサイトURLが設定されている取引を取得
- **個別更新**: 特定の取引のアナリティクスプロパティを更新
- **一括更新**: 複数の取引を効率的に一括更新

## セットアップ

1. **依存関係のインストール**:
```bash
pip install requests
```

2. **HubSpotアクセストークンの設定**:
```bash
export HUBSPOT_ACCESS_TOKEN="your_private_app_token_here"
```

3. **スクリプト実行**:
```bash
python hubspot_api_client.py
```

## 使用方法

### 基本的な使用例

```python
from hubspot_api_client import HubSpotAPIClient

# クライアント初期化
client = HubSpotAPIClient("your_access_token")

# アナリティクスID設定済みの取引を取得
deals = client.get_deals_with_analytics_ids()

# アナリティクスデータで更新
for deal in deals:
    analytics_data = {
        "hp_sessions": "1500",
        "hp_total_users": "1200",
        "hp_engagement_rate": "75.5",
        "hp_cv": "25", 
        "hp_cvr": "1.67"
    }
    client.update_deal_analytics_properties(deal['id'], analytics_data)
```

### 一括更新

```python
# 複数の取引を一括更新
updates = [
    {
        "id": "deal_id_1",
        "properties": {
            "hp_sessions": "1500",
            "hp_total_users": "1200"
        }
    },
    {
        "id": "deal_id_2", 
        "properties": {
            "hp_sessions": "2000",
            "hp_total_users": "1800"
        }
    }
]

client.batch_update_deals(updates)
```

## HubSpotでの事前準備

要件定義に基づき、HubSpotの「取引」オブジェクトに以下のカスタムプロパティを作成してください：

### 必須キープロパティ
- `ga4_property_id` - GA4プロパティID
- `gsc_site_url` - GSCサイトURL

### アナリティクスプロパティ
- `hp_sessions` - HPセッション
- `hp_total_users` - HP総ユーザー  
- `hp_engagement_rate` - HPエンゲージメント率
- `hp_cv` - HP CV
- `hp_cvr` - HP CVR
- `last_data_sync_date` - 最終データ同期日

## エラーハンドリング

スクリプトには以下のエラーハンドリングが含まれています：
- API呼び出しエラーの捕捉と表示
- 認証エラーの検出
- レート制限への対応（手動リトライが必要）

## 次のステップ

このスクリプトをベースに、以下の機能を追加できます：
1. GA4 Data APIとの連携
2. Search Console APIとの連携  
3. 自動スケジュール実行（GCP Cloud Functions）
4. エラー監視とログ記録
5. 指数バックオフによるリトライロジック