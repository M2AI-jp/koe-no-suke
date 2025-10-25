# restaurant-voice-ai

日本国内飲食店向け電話予約受付AIシステムの開発リポジトリです。  
Phase1（ローカル音声会話）と Phase2（Google Sheets 連携）のセットアップ手順をまとめています。

## 1. 共通セットアップ

1. 依存ライブラリをインストール:
   ```bash
   npm install
   ```
2. 環境変数ファイルを準備:
   ```bash
   cp .env.template .env
   ```
3. `.env` または `.env.local` に以下を設定:
   - `OPENAI_API_KEY`
   - `GOOGLE_SA_KEY`（サービスアカウントJSONを1行化したもの、Phase2で使用）
   - `GOOGLE_SHEET_PARENT_FOLDER_ID`（プロビジョニング先のDriveフォルダID、Phase2で使用）
   - 必要に応じて `GOOGLE_TEMPLATE_SHEET_ID` / `GOOGLE_SHEET_ID`
4. テスト実行:
   ```bash
   npm test
   ```

## 2. Phase1: ローカル音声会話

```bash
# フェイク音声I/OとフェイクRealtimeクライアントでドライラン（API課金なし）
npm exec tsx src/bin/local-realtime.ts -- --dry-run

# 実マイク・スピーカーと OpenAI Realtime API を使用
npm exec tsx src/bin/local-realtime.ts
```

`--dry-run` モードではフェイクRealtimeクライアントが即座に `response.done` を返し、OpenAI API への課金は発生しません。

## 3. Phase2: Google Sheets 連携

1. 顧客シートのプロビジョニング:
   ```bash
   npm exec tsx ops/customers/provision-customers.ts --customer store-a \
     --parent-folder-id 0APgHgDKFj_iKUk9PVA \  # 共有ドライブや特定フォルダを明示する場合
     --force  # 既存の spreadsheetId を上書きしたい場合
   ```
   `customers.json` の `spreadsheetId`/`url` が自動更新されます。`--share <email...>` で共有先を追加可能です。
2. テスト用予約データの書き込み:
   ```bash
   npm exec tsx scripts/test-sheets-write.ts --customer-id store-a
   ```
3. 予約データの読み込み:
   ```bash
   npm exec tsx scripts/test-sheets-read.ts --customer-id store-a
   ```
   `--sheet-id` オプションを使えば環境変数や `customers.json` を介さず直接IDを指定できます。

## 4. トラブルシューティング

- マイクが検出されない場合（Phase1）: OS のマイク権限やデバイス設定を確認してください。
- `node-record-lpcm16` のビルドに失敗する場合: `mic` など代替パッケージの利用やビルドツールの再インストールを検討してください。
- Google Sheets API が 401/403 を返す場合: サービスアカウントをシート／フォルダへ共有し、`GOOGLE_SA_KEY` が最新か確認してください。また、`--parent-folder-id` を利用する場合はフォルダIDが正しいか再確認してください。
