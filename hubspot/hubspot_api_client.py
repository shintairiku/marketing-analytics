#!/usr/bin/env python3
"""
HubSpot CRM API Client
取引（Deal）レコードとプロパティを取得するスクリプト
"""

import os
import requests
from typing import List, Dict, Optional
from datetime import datetime


class HubSpotAPIClient:
    """HubSpot CRM API クライアント"""
    
    def __init__(self, access_token: str):
        """
        初期化
        
        Args:
            access_token: HubSpotのプライベートアプリアクセストークン
        """
        self.access_token = access_token
        self.base_url = "https://api.hubapi.com"
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
    
    def get_deal_properties(self) -> List[Dict]:
        """
        取引オブジェクトのプロパティ一覧を取得
        
        Returns:
            プロパティ情報のリスト
        """
        url = f"{self.base_url}/crm/v3/properties/deals"
        
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            
            data = response.json()
            return data.get('results', [])
            
        except requests.exceptions.RequestException as e:
            print(f"プロパティ取得エラー: {e}")
            return []
    
    def get_deals_with_analytics_ids(self, 
                                   properties: Optional[List[str]] = None,
                                   limit: int = 100) -> List[Dict]:
        """
        GA4プロパティIDまたはGSCサイトURLが設定されている取引を取得
        
        Args:
            properties: 取得するプロパティ名のリスト
            limit: 取得件数の上限
            
        Returns:
            取引レコードのリスト
        """
        # デフォルトで取得するプロパティ
        default_properties = [
            "dealname",
            "dealstage", 
            "amount",
            "closedate",
            "ga4_property_id",  # 要件定義で定義されたキープロパティ
            "gsc_site_url",     # 要件定義で定義されたキープロパティ
            "hp_sessions",      # HPセッション
            "hp_total_users",   # HP総ユーザー
            "hp_engagement_rate", # HPエンゲージメント率
            "hp_cv",           # HP CV
            "hp_cvr"           # HP CVR
        ]
        
        if properties:
            default_properties.extend(properties)
        
        url = f"{self.base_url}/crm/v3/objects/deals"
        params = {
            "properties": ",".join(default_properties),
            "limit": limit
        }
        
        try:
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            
            data = response.json()
            deals = data.get('results', [])
            
            # GA4プロパティIDまたはGSCサイトURLがあるものをフィルタリング
            filtered_deals = []
            for deal in deals:
                properties = deal.get('properties', {})
                ga4_id = properties.get('ga4_property_id')
                gsc_url = properties.get('gsc_site_url')
                
                if ga4_id or gsc_url:
                    filtered_deals.append(deal)
            
            return filtered_deals
            
        except requests.exceptions.RequestException as e:
            print(f"取引取得エラー: {e}")
            return []
    
    def get_deal_by_id(self, deal_id: str, properties: Optional[List[str]] = None) -> Optional[Dict]:
        """
        特定の取引IDで取引情報を取得
        
        Args:
            deal_id: 取引ID
            properties: 取得するプロパティ名のリスト
            
        Returns:
            取引レコード
        """
        default_properties = [
            "dealname", "dealstage", "amount", "closedate",
            "ga4_property_id", "gsc_site_url"
        ]
        
        if properties:
            default_properties.extend(properties)
        
        url = f"{self.base_url}/crm/v3/objects/deals/{deal_id}"
        params = {
            "properties": ",".join(default_properties)
        }
        
        try:
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            
            return response.json()
            
        except requests.exceptions.RequestException as e:
            print(f"取引取得エラー (ID: {deal_id}): {e}")
            return None
    
    def update_deal_analytics_properties(self, 
                                       deal_id: str, 
                                       analytics_data: Dict[str, any]) -> bool:
        """
        取引のアナリティクスプロパティを更新
        
        Args:
            deal_id: 取引ID
            analytics_data: 更新するアナリティクスデータ
            
        Returns:
            更新成功可否
        """
        url = f"{self.base_url}/crm/v3/objects/deals/{deal_id}"
        
        # タイムスタンプを追加
        analytics_data["last_data_sync_date"] = datetime.now().isoformat()
        
        payload = {
            "properties": analytics_data
        }
        
        try:
            response = requests.patch(url, headers=self.headers, json=payload)
            response.raise_for_status()
            
            print(f"取引 {deal_id} の更新完了")
            return True
            
        except requests.exceptions.RequestException as e:
            print(f"取引更新エラー (ID: {deal_id}): {e}")
            return False
    
    def batch_update_deals(self, updates: List[Dict[str, any]]) -> bool:
        """
        複数の取引を一括更新
        
        Args:
            updates: 更新データのリスト [{"id": "deal_id", "properties": {...}}, ...]
            
        Returns:
            更新成功可否
        """
        url = f"{self.base_url}/crm/v3/objects/deals/batch/update"
        
        # タイムスタンプを各更新データに追加
        for update in updates:
            update["properties"]["last_data_sync_date"] = datetime.now().isoformat()
        
        payload = {
            "inputs": updates
        }
        
        try:
            response = requests.post(url, headers=self.headers, json=payload)
            response.raise_for_status()
            
            print(f"{len(updates)}件の取引を一括更新完了")
            return True
            
        except requests.exceptions.RequestException as e:
            print(f"一括更新エラー: {e}")
            return False


def main():
    """メイン実行関数"""
    # 環境変数からアクセストークンを取得
    access_token = os.getenv("HUBSPOT_ACCESS_TOKEN")
    if not access_token:
        print("エラー: HUBSPOT_ACCESS_TOKEN環境変数が設定されていません")
        return
    
    # HubSpot APIクライアントを初期化
    client = HubSpotAPIClient(access_token)
    
    print("=== HubSpot 取引プロパティ一覧 ===")
    properties = client.get_deal_properties()
    for prop in properties[:5]:  # 最初の5件のみ表示
        print(f"- {prop.get('name')}: {prop.get('label')} ({prop.get('type')})")
    
    print(f"\n=== アナリティクスID設定済み取引一覧 ===")
    deals = client.get_deals_with_analytics_ids()
    
    for deal in deals:
        props = deal.get('properties', {})
        print(f"取引ID: {deal.get('id')}")
        print(f"  名前: {props.get('dealname')}")
        print(f"  GA4 ID: {props.get('ga4_property_id')}")
        print(f"  GSC URL: {props.get('gsc_site_url')}")
        print(f"  セッション: {props.get('hp_sessions')}")
        print("---")
    
    # サンプル更新データ
    if deals:
        sample_deal_id = deals[0].get('id')
        sample_update = {
            "hp_sessions": "1500",
            "hp_total_users": "1200", 
            "hp_engagement_rate": "75.5",
            "hp_cv": "25",
            "hp_cvr": "1.67"
        }
        
        print(f"\n=== サンプル更新実行 (取引ID: {sample_deal_id}) ===")
        success = client.update_deal_analytics_properties(sample_deal_id, sample_update)
        print(f"更新結果: {'成功' if success else '失敗'}")


if __name__ == "__main__":
    main()