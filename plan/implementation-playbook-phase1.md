# implementation-playbook Phase 1 — Local Voice Conversation

> Phase 1 では、OpenAI Realtime API とローカル音声入出力を組み合わせた電話予約向け CLI を構築する。単一ファイル・単一作業の原則を守りつつ `state.md` のステート遷移（coding → pr_preparation → review → fix → integration → done）を全タスクで徹底する。

## 進捗管理

### タスク進捗チェックリスト

#### 基盤構築（Task 0-6）
- [x] Task 0: プロジェクト初期化（package.json, tsconfig.json）
- [x] Task 1: .gitignore 作成
- [x] Task 2: .env.template 作成
- [x] Task 3: src/config.ts 作成
- [x] Task 4: src/config.test.ts 作成
- [x] Task 5: src/logger.ts 作成
- [x] Task 6: src/logger.test.ts 作成

#### Realtimeレイヤー（Task 7-9）
- [x] Task 7: src/realtime/client.ts 作成
- [x] Task 8: src/realtime/client.test.ts 作成
- [x] Task 9: src/realtime/fakeClient.ts 作成

#### 音声I/O（Task 10-16）
- [x] Task 10: src/audio/index.ts 作成
- [x] Task 11: src/audio/microphone.ts 作成
- [x] Task 12: src/audio/microphone.test.ts 作成
- [x] Task 13: src/audio/speakers.ts 作成
- [x] Task 14: src/audio/speakers.test.ts 作成
- [x] Task 15: src/audio/fake.ts 作成
- [x] Task 16: src/audio/fake.test.ts 作成

#### 会話制御（Task 17-18）
- [x] Task 17: src/conversation/localOrchestrator.ts 作成
- [x] Task 18: src/conversation/localOrchestrator.test.ts 作成

#### CLIと統合テスト（Task 19-20）
- [x] Task 19: src/bin/local-realtime.ts 作成
- [x] Task 20: tests/integration/local-conversation.test.ts 作成

#### ドキュメント（Task 21-23）
- [x] Task 21: README.md 更新
- [x] Task 22: docs/howto/local-audio.md 作成
- [x] Task 23: docs/notes/phase1.md 作成

### フェーズ完了条件
- [x] 全24タスクが完了
- [x] `npm test` が成功（8テストファイル / 16テストケース）
- [x] `npm exec tsx src/bin/local-realtime.ts -- --dry-run` がセッション開始から自動停止まで確認済み
- [x] `docs/notes/phase1.md` が作成済み
- [ ] Slack #restaurant-voice-ai-dev への共有（手動作業）

---

## 1. フェーズ目的と完了条件

### 目的
OpenAI Realtime API とローカルのマイク／スピーカーを組み合わせ、飲食店予約に最適化された音声対話 CLI を提供する。Phase 1 では Twilio や Google Sheets 連携は扱わない。

### 完了条件
1. CLI を実行するとリアルタイム会話が成立し、セッション識別子と所要時間がログに記録される。
2. `npm test` でユニットテスト・統合テスト（計16ケース）が全て成功する。
3. `docs/notes/phase1.md` に成果・課題が記録されている。
4. `state.md` の main status / sub status が Phase 1 完了を示す値に更新されている。

---

## 2. 技術仕様

### 採用ライブラリ
- **OpenAI SDK**: `openai@^4.81.0`（`OpenAIRealtimeWS` を `openai/beta/realtime/ws` から利用）
- **構成管理**: `dotenv` + `zod`（必須環境変数検証）
- **再試行制御**: `p-retry`
- **ログ**: `pino`
- **CLI**: `commander`
- **テスト**: `vitest`
- **音声入出力**: `sox`（マイク） + `speaker`（出力） + 自前フェイク実装

### OpenAI Realtime API 設定
- モデル: `gpt-realtime-2025-08-28`
- 入出力フォーマット: `pcm16`
- 日本語レストラン予約用のシステムプロンプトを `session.update` で送信。
- サーバーVAD（`threshold: 0.6`, `silence_duration_ms: 1000`）でターン制御。
- `response.audio.delta` / `response.done` / `conversation.item.input_audio_transcription.completed` を監視しログへ出力。

### 追加仕様（実装確定時の調整）
1. **FakeRealtimeClient の導入**: 課金を伴わない `--dry-run` モード向けに、`response.done` を即時発火するフェイククライアントを提供。
2. **LocalOrchestrator のターン制御**: AI 発話中はマイク入力をミュートし、`response.done` 受信後に再開。`autoStopOnDone` 引数で自動停止を切り替え。
3. **音声チャンクコミット最適化**: `RealtimeClient.sendAudio()` で `input_audio_buffer.append` → `input_audio_buffer.commit` → `response.create` をスケジュールし、レスポンス待機中のバッファリングを管理。

---

## 3. タスク依存関係

```text
Task 0 (初期化)
  ↓
Task 1 (.gitignore) ← Task 0
  ↓
Task 2 (.env.template) ← Task 0
  ↓
Task 3 (config.ts) ← Task 2
  ↓
Task 4 (config.test.ts) ← Task 3
  ↓
Task 5 (logger.ts) ← Task 3
  ↓
Task 6 (logger.test.ts) ← Task 5
  ↓
Task 7 (realtime/client.ts) ← Task 5
  ↓
Task 8 (realtime/client.test.ts) ← Task 7
  ↓
Task 9 (realtime/fakeClient.ts) ← Task 7
  ↓
Task 10 (audio/index.ts) ← Task 5
  ↓
Task 11 (audio/microphone.ts) ← Task 10, Task 5
  ↓
Task 12 (audio/microphone.test.ts) ← Task 11
  ↓
Task 13 (audio/speakers.ts) ← Task 10, Task 5
  ↓
Task 14 (audio/speakers.test.ts) ← Task 13
  ↓
Task 15 (audio/fake.ts) ← Task 10
  ↓
Task 16 (audio/fake.test.ts) ← Task 15
  ↓
Task 17 (conversation/localOrchestrator.ts) ← Task 7, Task 10, Task 5
  ↓
Task 18 (conversation/localOrchestrator.test.ts) ← Task 17, Task 9
  ↓
Task 19 (bin/local-realtime.ts) ← Task 17, Task 9
  ↓
Task 20 (tests/integration/local-conversation.test.ts) ← Task 19
  ↓
Task 21 (README.md) ← Task 19
  ↓
Task 22 (docs/howto/local-audio.md) ← Task 11, Task 13
  ↓
Task 23 (docs/notes/phase1.md) ← Task 20, Task 21
```

---

## 4. タスク詳細

### Task 0: プロジェクト初期化
- **対象**: `implementation/package.json`, `implementation/tsconfig.json`
- **内容**:
  - Node.js 20 LTS 想定で `npm init`（package manager は `pnpm@8.15.0` を指定）。
  - 依存: `openai`, `ws`, `pino`, `p-retry`, `commander`, `zod`, `dotenv`。開発依存に `typescript`, `tsx`, `vitest`, `@types/node`, `@types/ws`, `node-record-lpcm16`, `speaker`。
  - Scripts: `test`（`vitest run`）、`test:watch`、`dev`（`tsx src/bin/local-realtime.ts`）。
  - `tsconfig.json` は `target: ES2022`、`module: ESNext`、`moduleResolution: Bundler`、`typeRoots` なし、`strict: true` などを設定。
- **完了条件**: TypeScript のビルドが警告なしで通り、state.md を `done` に更新。

### Task 1: .gitignore 作成
- **対象**: `implementation/.gitignore`
- **内容**: `node_modules/`, `dist/`, `.env`, `.DS_Store` など開発生成物を除外。
- **完了条件**: `.env` が Git 管理外であることを確認し state 更新。

### Task 2: .env.template 作成
- **対象**: `implementation/.env.template`
- **内容**: `OPENAI_API_KEY` を必須にし、`OPENAI_REALTIME_MODEL`, `AUDIO_SAMPLE_RATE`, `LOG_LEVEL` の推奨値をコメント付きで記載。
- **完了条件**: `.env.template` が配置され、利用者が `.env` を容易に作成できる状態。

### Task 3: src/config.ts 作成
- **対象**: `implementation/src/config.ts`
- **内容**:
  - `dotenv` を最初に読み込み、環境変数を `zod` で検証。
  - `OPENAI_API_KEY` を必須、その他はデフォルト値（モデル: `gpt-realtime-2025-08-28`、サンプルレート: 16000、ログレベル: `info`）。
  - `safeParse` 失敗時は検証結果を `console.error` で出力し `process.exit(1)`。
- **完了条件**: `loadConfig()` が正しく型付けされ、テストから読み取れる。

### Task 4: src/config.test.ts 作成
- **対象**: `implementation/src/config.test.ts`
- **内容**: `vitest` で `process.exit` をスパイし、必須値欠損時に例外が投げられること／デフォルト値が適用されることを検証。各テスト後に `vi.unstubAllEnvs()` で環境変数を復元。
- **完了条件**: `vitest run implementation/src/config.test.ts` が成功。

### Task 5: src/logger.ts 作成
- **対象**: `implementation/src/logger.ts`
- **内容**: `pino` を `loadConfig()` のログレベルで初期化し、`correlationId` を `child` ロガーで付与する `createLogger()` を提供。
- **完了条件**: 依存先から `createLogger` を呼び出せる。

### Task 6: src/logger.test.ts 作成
- **対象**: `implementation/src/logger.test.ts`
- **内容**: `createLogger('test-session-123')` が指定した `correlationId` を `bindings()` に保持していることを検証。
- **完了条件**: テストが成功し、モジュールキャッシュをリセットしても副作用が残らない。

### Task 7: src/realtime/client.ts 作成
- **対象**: `implementation/src/realtime/client.ts`
- **内容**:
  - `OpenAIRealtimeWS` を用いて WebSocket を確立（`p-retry` で最大3回再試行）。
  - `session.created` イベント受信時に日本語向け設定を `session.update` で送信し、最初の挨拶を `response.create` で要求。
  - 音声入力は `input_audio_buffer.append` → `input_audio_buffer.commit` → `response.create` の順で送信し、レスポンス待機中は `hasBufferedAudio` でキュー。
  - `response.audio.delta` を Base64 変換して `EventEmitter` として外部へ `Buffer` で転送。
  - `conversation.item.input_audio_transcription.completed` と `response.done` をログ出力。
- **完了条件**: `RealtimeClient` が `EventEmitter` を継承し、`start/stop/sendAudio` を提供。

### Task 8: src/realtime/client.test.ts 作成
- **対象**: `implementation/src/realtime/client.test.ts`
- **内容**:
  - `openai` と `openai/beta/realtime/ws` をモック化し、`socket.once('open'|'error')` のハンドラ登録／解除を検証。
  - `sendAudio()` がチャンクを Base64 で送信し、タイマー経由で `commit` と `response.create` を発行することを `vi.useFakeTimers()` で確認。
  - レスポンス待機中に追加チャンクがバッファリングされ、`response.done` 後に再コミットされる挙動をチェック。
- **完了条件**: テストが 3 ケースすべて成功し、副作用（タイマー・イベントリスナー）がクリーンアップされる。

### Task 9: src/realtime/fakeClient.ts 作成
- **対象**: `implementation/src/realtime/fakeClient.ts`
- **内容**: `EventEmitter` を継承したフェイククライアントを実装。`start()`/`stop()` で状態管理し、`sendAudio()` 受信時に `audio.delta` を即時、`response.done` を非同期（`setImmediate`）で発火して `--dry-run` を成立させる。
- **完了条件**: CLI やテストで実 API を呼ばずに対話ループを成立させられる。

### Task 10: src/audio/index.ts 作成
- **対象**: `implementation/src/audio/index.ts`
- **内容**: 音声入力・出力の共通インターフェース `IAudioSource` / `IAudioSink` を宣言。
- **完了条件**: 各実装が共通シグネチャに準拠。

### Task 11: src/audio/microphone.ts 作成
- **対象**: `implementation/src/audio/microphone.ts`
- **内容**: `sox` プロセスを `spawn` し、16kHz/16bit/mono の生 PCM を stdout から取得。`stderr`・`error`・`exit` をログ出力し、`callback` に音声チャンクを渡す。
- **完了条件**: `start()` / `stop()` / `onData()` が実装され、SIGTERM でプロセスを終了できる。

### Task 12: src/audio/microphone.test.ts 作成
- **対象**: `implementation/src/audio/microphone.test.ts`
- **内容**: `child_process.spawn` をモックし、`start()` で適切な引数が渡ること・`stop()` で `kill()` が呼ばれることを検証。`createLogger()` は環境変数のスタブ (`vi.stubEnv`) で初期化。
- **完了条件**: 2 ケースが成功し、`vi.resetModules()` でモックを解放。

### Task 13: src/audio/speakers.ts 作成
- **対象**: `implementation/src/audio/speakers.ts`
- **内容**: `speaker` ライブラリで PCM16 を再生。`start()` でインスタンス生成、`stop()` で `end()`、`write()` でチャンク送信。
- **完了条件**: サンプルレート設定を共有し、ログに開始／停止を出力。

### Task 14: src/audio/speakers.test.ts 作成
- **対象**: `implementation/src/audio/speakers.test.ts`
- **内容**: `speaker` をモックし、`write` / `end` が呼ばれることを確認。`createLogger()` はマイクテスト同様スタブ化。
- **完了条件**: 3 ケースが成功し、`writeMock` / `endMock` が適切な回数で呼び出される。

### Task 15: src/audio/fake.ts 作成
- **対象**: `implementation/src/audio/fake.ts`
- **内容**: `FakeAudioSource` は 20ms 間隔で 320byte (16kHz, 20ms) のサイレントチャンクを生成。`FakeAudioSink` は `write()` で受信チャンクを配列に保存し `getChunks()` で参照可能にする。
- **完了条件**: フェイク実装で dry-run やテストが完結。

### Task 16: src/audio/fake.test.ts 作成
- **対象**: `implementation/src/audio/fake.test.ts`
- **内容**: `FakeAudioSource` がチャンクを発生させること、`FakeAudioSink` が書き込み内容を保持することを確認。
- **完了条件**: 2 ケースが成功し、`setTimeout` で待機後にチャンク数が正の値。

### Task 17: src/conversation/localOrchestrator.ts 作成
- **対象**: `implementation/src/conversation/localOrchestrator.ts`
- **内容**:
  - `RealtimeClient` 互換の EventEmitter を受け取り、`isAiSpeaking` フラグでターン制御。
  - `autoStopOnDone` 引数が `true` の場合、`response.done` 受信時に自動で `stop()` を呼び出し dry-run を即終了。
  - セッション開始／終了時に `correlationId` と所要時間をログに記録。
- **完了条件**: `start()` が音声入出力・RealtimeClient を起動し、`stop()` が冪等にリソースを解放する。

### Task 18: src/conversation/localOrchestrator.test.ts 作成
- **対象**: `implementation/src/conversation/localOrchestrator.test.ts`
- **内容**: RealtimeClient をモックし、`start()`/`stop()` の呼び出し、音声送信、`autoStopOnDone` の自動停止を検証。フェイクRealtimeクライアントで dry-run シナリオを再現。
- **完了条件**: 2 ケースが成功し、イベントリスナーが適切に登録・解放される。

### Task 19: src/bin/local-realtime.ts 作成
- **対象**: `implementation/src/bin/local-realtime.ts`
- **内容**:
  - `commander` で `--dry-run` / `--model` オプションを定義。
  - dry-run 時は `FakeRealtimeClient` + `FakeAudioSource/Sink`・自動停止を利用、通常時は本番クライアントと実機I/Oを起動。
  - `SIGINT` でグレースフルシャットダウン。
- **完了条件**: `npm exec tsx src/bin/local-realtime.ts` が期待通り動作。

### Task 20: tests/integration/local-conversation.test.ts 作成
- **対象**: `implementation/tests/integration/local-conversation.test.ts`
- **内容**:
  - `vitest` で `RealtimeClient` を部分モックし、`FakeAudioSource/Sink` と `LocalOrchestrator` の統合を検証。
  - `listeners` に登録したハンドラを手動で発火させ、AI 応答時の挙動（送受信ログ、チャンク書き込み）をチェック。
  - テストタイムアウトは 10 秒、`Promise` で 100ms 待機後に `audio.delta` を模擬。
- **完了条件**: テストが成功し、`sink.getChunks()` が空でないことを確認。

### Task 21: README.md 更新
- **対象**: `implementation/README.md`
- **内容**: Phase 1 セットアップ・dry-run 手順・実行例・トラブルシューティング（マイク検出／ネイティブモジュールビルド）を記載。
- **完了条件**: 新規開発者が README だけで環境構築できる状態。

### Task 22: docs/howto/local-audio.md 作成
- **対象**: `implementation/docs/howto/local-audio.md`
- **内容**: macOS / Windows / Linux (Ubuntu) 向けマイク権限の確認手順、`arecord` / `pactl` コマンド例、ビルドエラー対処を整理。
- **完了条件**: OS 別のトラブルシューティングが網羅されている。

### Task 23: docs/notes/phase1.md 作成
- **対象**: `implementation/docs/notes/phase1.md`
- **内容**: 完了日、担当、ユニットテスト 12件 + 統合テスト 1件 + 手動 QA の実績、未決課題（実 API でのチューニング、デバイス検証）、次フェーズ TODO を記録。
- **完了条件**: Phase 1 の振り返りが更新され、次フェーズへ引き継げる。

---

## 5. フェーズ完了チェックリスト

- [x] 全24タスクが `done` ステータスに到達
- [x] `npm test` が成功（実行日時: 2025-10-25 / 16 tests）
- [x] `npm exec tsx src/bin/local-realtime.ts -- --dry-run` が正常終了（FakeRealtimeClient により自動停止）
- [x] `docs/notes/phase1.md` がリポジトリに反映済み
- [ ] Slack #restaurant-voice-ai-dev へ成果共有（要手動対応）

---

**次フェーズ**: Phase 2（Google Sheets 連携）へ進む
