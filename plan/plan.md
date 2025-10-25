# restaurant-voice-ai 実装計画

**最終更新**: 2025-10-25（公式ドキュメント検証済み）

## プロジェクト概要

日本国内飲食店向け電話予約受付AIシステム

**フロー**: Twilio電話着信 → OpenAI Realtime API音声応答 → Googleスプレッドシート記録

**重要原則**: 段階的な単機能テストを重視したモジュール設計

---

## 技術スタック選択

### 採用技術（確定）

| 用途 / フェーズ | ライブラリ / ツール | 対象フェーズ | 備考 |
|----------------|---------------------|--------------|------|
| ランタイム | Node.js 20 LTS + TypeScript 5.x | 全フェーズ | `npm` を標準パッケージマネージャーとして使用（Node.js 20同梱） |
| CLI実装 | commander, tsx | Phase1 | ローカル音声検証用のCLIエントリーポイントを提供 |
| 音声I/O | sox, speaker, 自前フェイク実装 | Phase1 | ローカル検証・dry-runに対応 |
| OpenAI SDK | openai v4.81.0+ (`openai/beta/realtime/ws`) | 全フェーズ | g711_ulaw対応のRealtime APIを利用 |
| 環境変数 | dotenv | 全フェーズ | .envファイルからの環境変数読み込み |
| スキーマ検証 | zod | 全フェーズ | 環境変数・データ型の実行時検証 |
| ログ | pino | 全フェーズ | JSON構造化ログを標準化 |
| テスト | vitest | 全フェーズ | 単体・統合テストに共通利用 |
| HTTPサーバー | Fastify v5 | Phase3以降 | Twilio WebhookおよびCloud Run向けサーバー実装で採用 |
| WebSocket | ws | Phase3以降 | Twilio Media Streams ⇄ Realtime APIブリッジ（Phase1ではOpenAI SDK内部で使用） |
| 永続化 | googleapis + google-auth-library | Phase2以降 | Google Sheets サービスアカウント連携 |
| リトライ | p-retry | Phase1以降 | OpenAI/Google API呼び出しのバックオフ制御 |

### 代替案（検討履歴）

Phase0 で Python + FastAPI 構成も検討したが、既存資産とNode.js実装の親和性から採用を見送った。必要に応じて将来の比較検討資料として残す。

---

## 外部サービス制約

### Twilio Voice API

- **電話番号**: 050番号（日本国内）
- **音声フォーマット**: mulaw 8kHz、base64エンコード
- **プロトコル**: WebSocket Secure（WSS、TLS 1.2+）
- **セキュリティ**: X-Twilio-Signature検証必須（HMAC-SHA1）
- **統合方式**:
  - **Media Streams**: 自前WebSocket実装、フルコントロール（推奨初期）
  - **AiSession TwiML**: パイロット版、簡素化（申請必要、評価推奨）
- **コスト**: 約¥10-15/分
- **ドキュメント**: https://www.twilio.com/docs/voice/media-streams

### OpenAI Realtime API

- **モデル**: `gpt-realtime-2025-08-28`（GA版、2025年8月28日リリース）
- **旧モデル**: `gpt-4o-realtime-preview-2024-12-17`（非推奨）
- **機能**: 音声-音声直接処理（S2S）、Function Calling、割り込み処理
- **レイテンシー**: 200ms以下
- **制約**: 5分超の通話でレイテンシー劣化の可能性
- **コスト**: $32/1M input tokens ($0.40 cached), $64/1M output tokens
  - 実測: システムプロンプトありで約$1.63/分
  - 5分通話: 約¥150-300
- **最適化**: Prompt Cachingで最大90%削減可能
- **ドキュメント**: https://openai.com/index/introducing-gpt-realtime/

### Google Sheets API v4

- **レート制限**:
  - 300 read req/min/project
  - 60 req/min/user/project
  - 500 write req/100s/project
  - クォータは毎分自動リフィル
- **エラー処理**: 429エラー時は指数バックオフ必須
- **認証**: サービスアカウントJSON鍵
- **ドキュメント**: https://developers.google.com/sheets/api/limits

### GCP Cloud Run

- **WebSocketサポート**: 対応
- **タイムアウト**: 最大3600秒（60分）、デフォルト300秒
  - 推奨設定: 3600秒（予約通話は3-5分だが余裕持たせる）
- **リージョン**: asia-northeast1（東京）
- **コンカレンシー**: 1-2（音声遅延対策）
- **最小インスタンス**: 1（コールドスタート回避）
- **ドキュメント**: https://cloud.google.com/run/docs/triggering/websockets

---

## データモデル

### 予約データ（スプレッドシート1行）

| 列名 | 型 | 形式 | 必須 | 説明 |
|------|------|------|------|------|
| timestamp_iso | string | ISO8601 | ✓ | 通話終了時刻（UTC） |
| caller_number | string | E.164 | ✓ | 発信者電話番号 |
| transcript_log | string | - | - | 会話全文 |
| reservation_date | string | YYYY-MM-DD | ✓ | 予約日 |
| reservation_time | string | HH:MM | ✓ | 予約時刻 |
| party_size | integer | - | ✓ | 人数 |
| customer_name | string | - | ✓ | 顧客名 |
| contact_number | string | - | ✓ | 連絡先 |
| special_request | string | - | - | 特別リクエスト |
| status | enum | accepted/pending/manual | ✓ | ステータス |

### 店舗情報

| フィールド | 型 | 説明 |
|-----------|------|------|
| name | string | 店舗名 |
| business_hours | array | 営業時間（open/close） |
| closed_days | array | 定休日 |
| max_capacity | integer | 最大収容人数 |

---

## 段階的テスト戦略

### Phase 0: 環境セットアップ（1週間）
- GCPプロジェクト、Twilio電話番号、OpenAI APIキー取得
- Google Sheets API有効化、サービスアカウント作成
- ローカル開発環境構築
- **言語・フレームワーク決定**

### Phase 1: ローカル音声処理（1-2週間）
- **実サービス**: OpenAI Realtime API
- **モック**: Twilio、Google Sheets
- **目標**: OpenAI接続・Function Calling動作確認
- **dry-run挙動**: フェイクRealtimeクライアントが即座に`response.done`を返し、CLIはAPI課金なく自動終了
- **成功基準**: 日本語音声認識・合成動作、Function Call結果パース可能

### Phase 2: Sheets連携（1週間）
- **実サービス**: Google Sheets API
- **モック**: OpenAI、Twilio
- **目標**: レート制限・リトライロジック確認
- **成功基準**: データ追加成功、指数バックオフ動作、429エラー処理
- **前提Ops**:
  - GCPで Google Sheets / Drive API を有効化し、サービスアカウント権限を確認済み
  - サービスアカウント鍵を発行し `.env.local` の `GOOGLE_SA_KEY` に一行JSONで登録、原本は削除
  - 顧客用シート格納フォルダID（`1v2M_XZKEKhczHzJ17KK9S2K9VAsY8QeT`）を `GOOGLE_SHEET_PARENT_FOLDER_ID` として設定し、Provisioner で生成したシート ID を `GOOGLE_SHEET_ID` に保存

### Phase 3: Twilio統合（2-3週間）
- **実サービス**: Twilio、OpenAI
- **モック**: Google Sheets
- **目標**: 実電話 → AI応答確認、統合方式選択
- **成功基準**: 電話着信 → AI応答、レイテンシー1秒以内、Function Calling発火
- **決定事項**: Media Streams vs AiSession選択

### Phase 4: E2E統合（1-2週間）
- **実サービス**: Twilio、OpenAI、Google Sheets
- **モック**: なし
- **目標**: 本番同等環境で全フロー確認
- **テストケース**: 正常系、異常系（情報不足）、エラー系（API障害）、営業時間外
- **成功基準**: エンドツーエンド予約完了、スプレッドシート正確記録

### Phase 5: 本番デプロイ（1週間）
- Cloud Run本番環境、Secret Manager、CI/CD構築
- Cloud Logging/Monitoring、アラート設定
- セキュリティ監査、運用ドキュメント

### Phase 6: 本番リリース（1週間）
- ソフトローンチ（テスト店舗1店）
- 実運用モニタリング、顧客フィードバック収集

**合計**: 約2-3ヶ月（兼業想定）

---

## 制約・考慮事項

### セキュリティ
- Twilio Webhook署名検証必須（X-Twilio-Signature、HMAC-SHA1）
- APIキーはSecret Manager経由で注入（本番）、`.env`（ローカル、gitignore必須）
- WebSocket通信はWSS（TLS 1.2+）のみ
- 会話ログにPII含む、GDPR/個人情報保護法対応

### パフォーマンス
- エンドツーエンドレイテンシー目標: 800ms以内
- OpenAI Realtime API: 200ms以下
- Cloud Runコンカレンシー: 1-2（音声遅延対策）

### コスト
- **1通話あたり**: ¥200-350（5分想定）
  - OpenAI: ¥150-300
  - Twilio: ¥50-75
- **月間100通話**: ¥20,000-35,000

### 信頼性
- Google Sheets API 429エラー対策必須（指数バックオフ）
- OpenAI/Twilio API障害時のフォールバック
- 営業時間外の自動応答分岐
- 長時間通話（5分超）のレイテンシー劣化対策

---

## 成功指標

### 開発
- 各フェーズの完了基準達成
- テストカバレッジ80%以上
- CI/CD正常動作

### 本番
- 予約成功率: 95%以上
- レイテンシー: 1秒以内
- 音声認識精度: 90%以上（日本語）
- システム稼働率: 99.9%
- コスト: ¥350以下/通話

### ビジネス
- 顧客満足度: 4.0/5.0以上
- 電話予約受付時間短縮: 50%
- 予約データ正確性: 95%以上

---

## 参考資料

### 公式ドキュメント
- [Twilio + OpenAI Realtime API統合](https://www.twilio.com/en-us/blog/twilio-openai-realtime-api-launch-integration)
- [OpenAI Realtime API公式](https://openai.com/index/introducing-gpt-realtime/)
- [Twilio Media Streams仕様](https://www.twilio.com/docs/voice/media-streams)
- [Google Sheets API制限](https://developers.google.com/sheets/api/limits)
- [GCP Cloud Run WebSocket](https://cloud.google.com/run/docs/triggering/websockets)

### チュートリアル
- [Twilio Voice AI Assistant（Node.js）](https://www.twilio.com/en-us/blog/voice-ai-assistant-openai-realtime-api-node)
- [Twilio Voice AI Assistant（Python）](https://www.twilio.com/en-us/blog/voice-ai-assistant-openai-realtime-api-python)

### サンプルコード
- [Twilio Media Streams GitHub](https://github.com/twilio/media-streams)
- [OpenAI Realtime API Examples](https://platform.openai.com/docs/guides/realtime)

---

## 技術検証（2025-01-24実施）

公式ドキュメントから全主要技術の仕様・制限・料金を徹底検証済み。

### 主要更新事項
1. OpenAI Realtime API: `gpt-realtime-2025-08-28` (GA版)に更新
2. 料金体系: トークンベース（$32/1M input, $64/1M output）に修正
3. Fastify: v5推奨（v4は2025/6/30 EOL）
4. FastAPI: v0.119.1+に更新
5. OpenAI Node.js SDK: v4.81.0+（Realtime API対応版）
6. Cloud Runタイムアウト: 3600秒（60分、最大値）
7. コスト試算: ¥200-350/通話（最新料金反映）

### 次回検証推奨
Phase 0開始前（料金・仕様変更確認）
