# restaurant-voice-ai

日本国内飲食店向け電話予約受付AIシステムの Phase1（ローカル音声会話）セットアップガイドです。

## セットアップ

1. 依存ライブラリをインストール:
   ```bash
   npm install
   ```
2. 環境変数ファイルを準備:
   ```bash
   cp .env.template .env
   # .env に OPENAI_API_KEY を設定
   ```
3. テスト実行:
   ```bash
   npm test
   ```

## 使い方

```bash
# フェイク音声I/OとフェイクRealtimeクライアントでドライラン（API課金なし）
npm exec tsx src/bin/local-realtime.ts -- --dry-run

# 実マイク・スピーカーと OpenAI Realtime API を使用
npm exec tsx src/bin/local-realtime.ts
```

`--dry-run` モードではフェイクRealtimeクライアントが即座に `response.done` を返し、自動的にセッションが終了するため、OpenAI API への課金は発生しません。

## トラブルシューティング

- マイクが検出されない場合: OS のマイク権限を確認してください。
- `node-record-lpcm16` のビルドに失敗する場合: `mic` など代替パッケージの利用やビルドツールの再インストールを検討してください。
