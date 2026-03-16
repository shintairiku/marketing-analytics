# Cloud Run + Vercel 前提のレビュー指摘事項

## 1. 高: Clerk トークンを URL クエリで backend に渡している

- 該当箇所
  - [frontend/src/components/google-connect-button.tsx](/home/yuki/development/gsc-oauth-mcp/frontend/src/components/google-connect-button.tsx#L24)
  - [backend/src/lib/server/request-auth.ts](/home/yuki/development/gsc-oauth-mcp/backend/src/lib/server/request-auth.ts#L14)
- 現状
  - frontend が `?token=...` を付けて Cloud Run の `/api/auth/google` へ遷移している
  - backend はその query parameter を Clerk 認証トークンとして受け取っている
- 問題
  - JWT が Cloud Run のアクセスログ、ブラウザ履歴、監視基盤、共有 URL などに残る
  - 認証情報を URL に載せる設計になっており、安全性が低い
- 対応案
  - frontend 同一オリジン経由の BFF に寄せる
  - もしくは backend 側で短命な one-time state を発行し、URL には state のみを載せる

## 2. 高: `FRONTEND_APP_URL` を正規化せずに CORS と redirect に使っている

- 該当箇所
  - [backend/src/lib/server/cors.ts](/home/yuki/development/gsc-oauth-mcp/backend/src/lib/server/cors.ts#L6)
  - [backend/src/lib/server/frontend-url.ts](/home/yuki/development/gsc-oauth-mcp/backend/src/lib/server/frontend-url.ts#L3)
- 現状
  - `FRONTEND_APP_URL` の文字列をそのまま `Access-Control-Allow-Origin` と redirect の基準 URL に使っている
- 問題
  - 末尾 `/`、path 含み、http/https の揺れで本番 CORS が壊れる
  - 実際に末尾 slash 1 文字の差で `OPTIONS` は 204 でも `POST` がブラウザにブロックされた
- 対応案
  - `new URL(process.env.FRONTEND_APP_URL)` で正規化する
  - CORS には `url.origin` のみを返す
  - 起動時に不正な URL を検知して fail fast する

## 3. 中: dashboard の認証方式表示が backend の実状態と同期していない

- 該当箇所
  - [frontend/src/app/dashboard/page.tsx](/home/yuki/development/gsc-oauth-mcp/frontend/src/app/dashboard/page.tsx#L22)
  - [backend/src/app/api/auth/mode/route.ts](/home/yuki/development/gsc-oauth-mcp/backend/src/app/api/auth/mode/route.ts#L16)
- 現状
  - frontend の dashboard は `searchParams.mode` から認証方式を判定している
  - backend は `google_auth_mode` cookie から認証方式を判定している
- 問題
  - UI 表示と backend の実際の判定がずれる
  - 再読み込みや別導線遷移後に、画面表示だけ `oauth` / `service_account` が誤る可能性がある
- 対応案
  - dashboard SSR で cookie を読む
  - もしくは mode の current state を返す API を追加して画面側で同期する

## 4. 中: backend 呼び出しが `credentials: "include"` の付け忘れに弱い

- 該当箇所
  - [frontend/src/components/auth-mode-toggle.tsx](/home/yuki/development/gsc-oauth-mcp/frontend/src/components/auth-mode-toggle.tsx#L32)
  - [frontend/src/components/gsc-chat-panel.tsx](/home/yuki/development/gsc-oauth-mcp/frontend/src/components/gsc-chat-panel.tsx#L56)
- 現状
  - 認証方式は cookie 依存
  - 各 fetch 呼び出しで個別に `credentials: "include"` を付ける必要がある
- 問題
  - 1 箇所でも付け忘れると backend が常に `oauth` 扱いになる
  - 今回も `/api/chat` で実際に不具合化した
- 対応案
  - backend 向け fetch を共通化する
  - `Authorization` と `credentials: "include"` をまとめたクライアントヘルパーを使う

## 5. 中: 本番向け cookie 設定の扱いが分散していて意図が不明瞭

- 該当箇所
  - [backend/src/app/api/auth/mode/route.ts](/home/yuki/development/gsc-oauth-mcp/backend/src/app/api/auth/mode/route.ts#L16)
  - [backend/src/app/api/auth/google/route.ts](/home/yuki/development/gsc-oauth-mcp/backend/src/app/api/auth/google/route.ts#L39)
- 現状
  - `google_auth_mode` cookie は本番で `SameSite=None; Secure` が必要
  - 一方で OAuth state cookie は `sameSite: "lax"` のまま
- 問題
  - cookie ごとの要件がコード上で統一されておらず、構成変更時に判断を誤りやすい
  - Cloud Run + Vercel のような別ドメイン構成で、どの cookie が cross-site 前提かが分かりにくい
- 対応案
  - cookie 発行の共通ヘルパーを作る
  - `cross-site fetch 用` と `top-level redirect 用` を明示的に分ける

## 補足

- 今回の障害で実際に確認できた事象
  - `FRONTEND_APP_URL` の末尾 `/` により `Access-Control-Allow-Origin` が `Origin` と不一致になった
  - `/api/chat` で cookie が送られず、backend が `oauth` 扱いになって `google_not_connected` を返した
- 優先度
  1. URL クエリでのトークン受け渡し解消
  2. URL / CORS の正規化
  3. 認証状態の同期方式整理
  4. backend fetch の共通化
