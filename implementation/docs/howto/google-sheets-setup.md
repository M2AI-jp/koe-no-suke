# Google Sheets API セットアップガイド

Google Sheets 連携（Phase2）を行うための準備手順です。全ステップでサービスアカウント・ドキュメント共有を正しく設定してください。

## 1. Google Cloud プロジェクト作成
1. [Google Cloud Console](https://console.cloud.google.com/) にアクセスし、右上のプロジェクトセレクタから「新しいプロジェクト」を選択。
2. プロジェクト名: `restaurant-voice-ai-dev`（任意で変更可）。
3. 請求先アカウントと組織を確認して「作成」。

## 2. API を有効化
1. プロジェクトを選択した状態で「API とサービス」→「ライブラリ」へ移動。
2. `Google Sheets API` を検索し、「有効にする」をクリック。
3. 同様に `Google Drive API` も有効化。

## 3. サービスアカウント作成
1. 「API とサービス」→「認証情報」→「認証情報を作成」→「サービスアカウント」。
2. サービスアカウント名: `restaurant-voice-ai-sa`（任意）。
3. ロールは後でシート共有で付与するため、ここでは未設定のまま完了。

## 4. JSON 鍵ダウンロード
1. 作成したサービスアカウントを開き、「キー」タブを選択。
2. 「鍵を追加」→「新しい鍵を作成」→「JSON」→「作成」。
3. ダウンロードしたJSONは安全な場所に保管し、ローカルには `.env.local` のみ残す。

## 5. スプレッドシートテンプレート準備（任意）
1. [Google Sheets](https://sheets.google.com/) でテンプレートを作成。
2. 1行目にヘッダーを追加:
   ```
   timestamp_iso | caller_number | transcript_log | reservation_date | reservation_time | party_size | customer_name | contact_number | special_request | status
   ```
3. テンプレートを使用する場合は URL から `GOOGLE_TEMPLATE_SHEET_ID` を取得して控える。

## 6. プロビジョニング先フォルダ作成
1. Google Drive で新規フォルダを作成（例: `Restaurant Reservations`）。
2. フォルダ URL の `{FOLDER_ID}` を `GOOGLE_SHEET_PARENT_FOLDER_ID` として使用。
3. フォルダをサービスアカウントに共有し、権限を「編集者」に設定。

## 7. 環境変数設定
```bash
# .env.local 例
OPENAI_API_KEY='sk-...'
GOOGLE_SA_KEY='<JSON全体を1行に整形した文字列>'
GOOGLE_SHEET_PARENT_FOLDER_ID='1v2M_XZKEKhczHzJ17KK9S2K9VAsY8QeT'
GOOGLE_TEMPLATE_SHEET_ID='optional-template-id'
GOOGLE_SHEET_ID='既存シートを使う場合のみ設定'
```
- JSONは `jq -c . key.json` などで1行化すると安全。
- `GOOGLE_SHEET_ID` はテスト読み書きする固定シートがある場合のみ。

## 8. CLI での検証手順
1. 顧客シート生成:
   ```bash
   npm exec tsx ops/customers/provision-customers.ts \
     --customer store-a --share example@example.com \
     --parent-folder-id 0APgHgDKFj_iKUk9PVA --force
   ```
2. テスト予約を書き込み:
   ```bash
   npm exec tsx scripts/test-sheets-write.ts --customer-id store-a
   ```
3. データ読み込み:
   ```bash
   npm exec tsx scripts/test-sheets-read.ts --customer-id store-a
   ```
   CLIログで `sheetId` や `count` を確認し、Sheets 側にもレコード追加が反映されていることを確認。

## トラブルシューティング
- **401 / 403 エラー**: サービスアカウントにシート・フォルダが共有されているかチェック。
- **認証失敗**: `GOOGLE_SA_KEY` の改行（`\n`）が適切にエスケープされているかを再確認。
- **フォルダに作成されない**: `GOOGLE_SHEET_PARENT_FOLDER_ID` が誤っていないか、Drive API が有効か確認。
- **テンプレート反映されない**: `GOOGLE_TEMPLATE_SHEET_ID` を設定し忘れていないか、シートの権限を確認。
