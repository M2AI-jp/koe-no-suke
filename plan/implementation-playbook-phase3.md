# implementation-playbook Phase 3 — Twilio PSTN Integration

> Phase3 は Twilio電話着信 と OpenAI音声会話（Phase1）を統合する。Google Sheets は**モック実装**（固定データ返却）を使用。単一ファイル・単一作業原則に従い、各タスクは state.md 遷移を経る。

## 進捗管理

### タスク進捗チェックリスト

#### Twilio署名検証（Task 1-2）
- [ ] Task 1: src/twilio/signature.ts 作成
- [ ] Task 2: src/twilio/signature.test.ts 作成

#### ~~音声変換（Task 3-4）~~ **削除: g711_ulaw直接使用に変更**
- [x] ~~Task 3: src/audio/converter.ts 作成~~
- [x] ~~Task 4: src/audio/converter.test.ts 作成~~

#### Twilio音声I/O（Task 5-6）
- [ ] Task 5: src/twilio/audioSource.ts 作成
- [ ] Task 6: src/twilio/audioSink.ts 作成

#### Sheetsモック（Task 7-8）
- [ ] Task 7: src/google/sheetsMock.ts 作成
- [ ] Task 8: src/google/sheetsMock.test.ts 作成

#### Twilio統合（Task 9-11）
- [ ] Task 9: src/twilio/mediaStreamServer.ts 作成
- [ ] Task 10: src/http/twilioController.ts 作成
- [ ] Task 11: src/http/twilioController.test.ts 作成

#### 会話オーケストレーション（Task 12-13）
- [ ] Task 12: src/conversation/voiceGatewayOrchestrator.ts 作成
- [ ] Task 13: src/conversation/voiceGatewayOrchestrator.test.ts 作成

#### サーバーとデプロイ（Task 14-16）
- [ ] Task 14: src/server.ts 作成
- [ ] Task 15: Dockerfile 作成
- [ ] Task 16: tools/ngrok-config.yml 作成

#### 統合テスト（Task 17）
- [ ] Task 17: tests/integration/twilio-call.test.ts 作成

#### ドキュメント（Task 18-20）
- [ ] Task 18: README.md 更新
- [ ] Task 19: docs/howto/cloud-run-deploy.md 作成
- [ ] Task 20: docs/notes/phase3.md 作成

### フェーズ完了条件
- [ ] 全18タスクが完了 (Task 3-4は削除済み)
- [ ] `pnpm test` が成功
- [ ] `pnpm tsx implementation/src/server.ts` が起動
- [ ] OpenAI Realtime APIでg711_ulaw設定を確認
- [ ] ngrok経由で実機電話テストが成功
- [ ] `docs/notes/phase3.md` が作成され、共有済み
- [ ] 全PRがレビュー承認済み・マージ済み

---

## 1. フェーズ目的と完了条件

### 目的
Twilio 050番号への実着信から OpenAI Realtime API 経由で音声会話し、Sheetsモックで空席確認応答を返す。開発環境（ローカル + ngrok トンネル）でエンドツーエンド動作を確認する。

### 完了条件
1. 実機電話着信 → AI音声応答 → Sheetsモック参照応答の一連フローが成功
2. Twilio Webhook署名検証、Media Streams双方向中継（g711_ulaw直接転送）が動作
3. OpenAI Realtime APIがg711_ulaw設定で正常動作
4. `pnpm vitest run` が成功（Twilio署名検証のユニットテスト）
5. `docs/notes/phase3.md` にフェーズ完了報告が記録されている

## 2. 技術仕様

### 使用ツール・ライブラリ
- **HTTPサーバー**: Fastify v5（Phase1から継続）
- **WebSocket**: ws（Phase1から継続）
- **OpenAI SDK**: openai v4.81.0+（Phase1から継続）
- **Twilio**: twilio SDK（署名検証用）
- **ローカルトンネル**: ngrok
- **コンテナ**: Docker
- **デプロイ**: GCP Cloud Run

### Twilio Media Streams 仕様
- **音声フォーマット**: audio/x-mulaw (G.711 µ-law), 8kHz, base64エンコード
- **プロトコル**: WebSocket Secure (WSS)
- **Webhook署名**: X-Twilio-Signature検証必須（HMAC-SHA1）
- **TwiML**: `<Connect><Stream url="wss://..." /></Connect>`
- **制約**: サンプルレート8kHzは変更不可

### 音声処理アーキテクチャ
- **Twilio → OpenAI**: base64デコード → OpenAI Realtime (g711_ulaw設定)
- **OpenAI → Twilio**: OpenAI Realtime (g711_ulaw出力) → base64エンコード
- **フォーマット変換**: **不要** (g711_ulaw 8kHzで統一)
- **レイテンシー目標**: エンドツーエンド 800ms以内

### Phase 3 実装時の仕様変更
本Playbookの当初計画から、OpenAI公式ドキュメント調査に基づき以下の設計変更を実施:

1. **音声フォーマット変換を廃止**:
   - 当初計画: mulaw 8kHz ↔ PCM16 16/24kHz の変換実装 (Task 3-4)
   - 変更後: g711_ulaw 8kHz 直接使用（変換なし）
   - 理由: OpenAI公式Twilio統合デモが変換なしの proxy pattern を採用

2. **OpenAI Realtime APIのg711_ulaw対応**:
   - 2025年8月のgpt-realtimeモデルでg711_ulaw正式サポート
   - プロダクション環境での動作実績あり（公式デモ、Twilioサンプル）
   - VAD、文字起こしも対応済み

3. **アーキテクチャ変更**:
   - 当初: Twilio ↔ [変換層] ↔ OpenAI Realtime (PCM16)
   - 変更後: Twilio ↔ [Proxy] ↔ OpenAI Realtime (g711_ulaw)
   - メリット: 実装簡素化、レイテンシ低減、CPU負荷軽減

4. **Task 3-4削除**:
   - `src/audio/converter.ts` および `converter.test.ts` は実装不要
   - Task番号は維持（Task 5以降の番号変更を回避）

## 3. タスク依存関係

```
Phase1完了
  ↓
Task 1 (twilio/signature.ts) ← Phase1
  ↓
Task 2 (twilio/signature.test.ts) ← Task 1
  ↓
~~Task 3-4 (audio/converter.ts)~~ ← 削除
  ↓
Task 5 (twilio/audioSource.ts) ← Phase1
  ↓
Task 6 (twilio/audioSink.ts) ← Phase1
  ↓
Task 7 (google/sheetsMock.ts) ← Phase1
  ↓
Task 8 (google/sheetsMock.test.ts) ← Task 7
  ↓
Task 9 (twilio/mediaStreamServer.ts) ← Task 5, Task 6, Phase1
  ↓
Task 10 (http/twilioController.ts) ← Task 1, Task 9
  ↓
Task 11 (http/twilioController.test.ts) ← Task 10
  ↓
Task 12 (conversation/voiceGatewayOrchestrator.ts) ← Task 9, Task 7, Phase1
  ↓
Task 13 (conversation/voiceGatewayOrchestrator.test.ts) ← Task 12
  ↓
Task 14 (server.ts) ← Task 10, Task 9
  ↓
Task 15 (Dockerfile) ← Task 14
  ↓
Task 16 (tools/ngrok-config.yml) ← Task 14
  ↓
Task 17 (tests/integration/twilio-call.test.ts) ← Task 12
  ↓
Task 18 (README.md更新) ← Task 14, Task 16
  ↓
Task 19 (docs/howto/cloud-run-deploy.md) ← Task 15
  ↓
Task 20 (docs/notes/phase3.md) ← Task 17
```

## 4. タスク詳細

### Task 1: src/twilio/signature.ts 作成

**前提タスク**: Phase1完了
**対象ファイル**: `implementation/src/twilio/signature.ts`
**作業内容**:
Twilio Webhook署名検証を実装:
```typescript
import crypto from 'crypto';

export function validateTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  twilioSignature: string
): boolean {
  // パラメータをソートして連結
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join('');

  const data = url + sortedParams;

  // HMAC-SHA1署名を生成
  const hmac = crypto.createHmac('sha1', authToken);
  hmac.update(data);
  const expectedSignature = hmac.digest('base64');

  return expectedSignature === twilioSignature;
}
```

**完了条件**:
- `src/twilio/signature.ts` が作成されている
- `validateTwilioSignature()` 関数が実装されている
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

**備考**: `.env.template` に以下を追記:
```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

---

### Task 2: src/twilio/signature.test.ts 作成

**前提タスク**: Task 1
**対象ファイル**: `implementation/src/twilio/signature.test.ts`
**作業内容**:
署名検証のテストを実装:
```typescript
import { describe, it, expect } from 'vitest';
import { validateTwilioSignature } from './signature';

describe('validateTwilioSignature', () => {
  it('正しい署名を検証', () => {
    const authToken = 'test-token';
    const url = 'https://example.com/twilio/voice';
    const params = { CallSid: 'CA1234', From: '+819012345678' };

    // 実際の署名を生成
    const crypto = require('crypto');
    const data = url + 'CallSidCA1234From+819012345678';
    const hmac = crypto.createHmac('sha1', authToken);
    hmac.update(data);
    const validSignature = hmac.digest('base64');

    const result = validateTwilioSignature(authToken, url, params, validSignature);

    expect(result).toBe(true);
  });

  it('不正な署名を拒否', () => {
    const authToken = 'test-token';
    const url = 'https://example.com/twilio/voice';
    const params = { CallSid: 'CA1234' };
    const invalidSignature = 'invalid-signature';

    const result = validateTwilioSignature(authToken, url, params, invalidSignature);

    expect(result).toBe(false);
  });
});
```

**完了条件**:
- `src/twilio/signature.test.ts` が作成されている
- `pnpm vitest run implementation/src/twilio/signature.test.ts` が成功
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### ~~Task 3: src/audio/converter.ts 作成~~ **削除済み**

**削除理由**: OpenAI Realtime APIがg711_ulawをネイティブサポートするため、音声フォーマット変換は不要。

~~**前提タスク**: Phase1完了~~
~~**対象ファイル**: `implementation/src/audio/converter.ts`~~
~~**作業内容**:~~
~~音声フォーマット変換（mulaw 8kHz ↔ PCM 16kHz）を実装:~~
```typescript
// μ-law デコード（8-bit μ-law → 16-bit PCM）
const MULAW_DECODE_TABLE = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  const sign = (i & 0x80) ? -1 : 1;
  const exponent = (i >> 4) & 0x07;
  const mantissa = i & 0x0f;
  const value = ((mantissa << 3) + 0x84) << exponent;
  MULAW_DECODE_TABLE[i] = sign * (value - 0x84);
}

export function mulawToPcm16(mulawData: Buffer): Buffer {
  const pcm16 = Buffer.allocUnsafe(mulawData.length * 2);
  for (let i = 0; i < mulawData.length; i++) {
    const sample = MULAW_DECODE_TABLE[mulawData[i]];
    pcm16.writeInt16LE(sample, i * 2);
  }
  return pcm16;
}

export function pcm16ToMulaw(pcm16Data: Buffer): Buffer {
  const mulaw = Buffer.allocUnsafe(pcm16Data.length / 2);
  for (let i = 0; i < pcm16Data.length / 2; i++) {
    const sample = pcm16Data.readInt16LE(i * 2);
    // PCM16 → μ-law エンコード（簡易実装）
    const sign = sample < 0 ? 0x80 : 0x00;
    const abs = Math.abs(sample);
    const exponent = Math.floor(Math.log2(abs + 1));
    const mantissa = (abs >> (exponent + 3)) & 0x0f;
    mulaw[i] = sign | (exponent << 4) | mantissa;
  }
  return mulaw;
}

// サンプルレート変換（8kHz ↔ 16kHz）
export function resample8to16(pcm8k: Buffer): Buffer {
  // 線形補間で2倍アップサンプリング
  const pcm16k = Buffer.allocUnsafe(pcm8k.length * 2);
  for (let i = 0; i < pcm8k.length / 2; i++) {
    const sample = pcm8k.readInt16LE(i * 2);
    pcm16k.writeInt16LE(sample, i * 4);
    pcm16k.writeInt16LE(sample, i * 4 + 2); // 同じ値を複製
  }
  return pcm16k;
}

export function resample16to8(pcm16k: Buffer): Buffer {
  // 2サンプルごとに1サンプル抽出
  const pcm8k = Buffer.allocUnsafe(pcm16k.length / 2);
  for (let i = 0; i < pcm16k.length / 4; i++) {
    const sample = pcm16k.readInt16LE(i * 4);
    pcm8k.writeInt16LE(sample, i * 2);
  }
  return pcm8k;
}
```

~~**完了条件**:~~
~~- `src/audio/converter.ts` が作成されている~~
~~- mulaw ↔ PCM16, 8kHz ↔ 16kHz 変換関数が実装されている~~
~~- state.md が `done` に更新~~

~~**state.md遷移**: coding → pr_preparation → review → integration → done~~

**このタスクは削除されました。**

---

### ~~Task 4: src/audio/converter.test.ts 作成~~ **削除済み**

**削除理由**: Task 3と同様、音声フォーマット変換が不要となったため。

~~**前提タスク**: Task 3~~
~~**対象ファイル**: `implementation/src/audio/converter.test.ts`~~
~~**作業内容**:~~
~~音声変換のテストを実装:~~
```typescript
import { describe, it, expect } from 'vitest';
import { mulawToPcm16, pcm16ToMulaw, resample8to16, resample16to8 } from './converter';

describe('Audio Converter', () => {
  it('mulaw → PCM16 変換', () => {
    const mulaw = Buffer.from([0x00, 0x80, 0xff]);
    const pcm16 = mulawToPcm16(mulaw);

    expect(pcm16.length).toBe(6); // 3 samples * 2 bytes
  });

  it('PCM16 → mulaw 変換', () => {
    const pcm16 = Buffer.allocUnsafe(4);
    pcm16.writeInt16LE(100, 0);
    pcm16.writeInt16LE(-100, 2);

    const mulaw = pcm16ToMulaw(pcm16);

    expect(mulaw.length).toBe(2);
  });

  it('8kHz → 16kHz リサンプリング', () => {
    const pcm8k = Buffer.allocUnsafe(4); // 2 samples
    pcm8k.writeInt16LE(100, 0);
    pcm8k.writeInt16LE(200, 2);

    const pcm16k = resample8to16(pcm8k);

    expect(pcm16k.length).toBe(8); // 4 samples
  });

  it('16kHz → 8kHz ダウンサンプリング', () => {
    const pcm16k = Buffer.allocUnsafe(8); // 4 samples
    const pcm8k = resample16to8(pcm16k);

    expect(pcm8k.length).toBe(4); // 2 samples
  });
});
```

~~**完了条件**:~~
~~- `src/audio/converter.test.ts` が作成されている~~
~~- `pnpm vitest run implementation/src/audio/converter.test.ts` が成功~~
~~- state.md が `done` に更新~~

~~**state.md遷移**: coding → pr_preparation → review → integration → done~~

**このタスクは削除されました。**

---

### Task 5: src/twilio/audioSource.ts 作成

**前提タスク**: Phase1
**対象ファイル**: `implementation/src/twilio/audioSource.ts`
**作業内容**:
Twilio Media Streamsからの音声入力（Phase1の`IAudioSource`実装、g711_ulaw直接使用）:
```typescript
import type { IAudioSource } from '../audio';
import type { Logger } from 'pino';

export class TwilioAudioSource implements IAudioSource {
  private callback: ((chunk: Buffer) => void) | null = null;

  constructor(private logger: Logger) {}

  async start(): Promise<void> {
    this.logger.info('TwilioAudioSource started');
  }

  async stop(): Promise<void> {
    this.logger.info('TwilioAudioSource stopped');
  }

  onData(callback: (chunk: Buffer) => void): void {
    this.callback = callback;
  }

  // Twilioからのg711_ulaw 8kHzデータを受信（base64デコードのみ）
  handleTwilioAudio(mulawBase64: string): void {
    // base64デコード（フォーマット変換なし）
    const audioBuffer = Buffer.from(mulawBase64, 'base64');

    // OpenAI Realtime APIへそのまま転送（g711_ulaw設定時）
    if (this.callback) {
      this.callback(audioBuffer);
    }
  }
}
```

**完了条件**:
- `src/twilio/audioSource.ts` が作成されている
- `TwilioAudioSource` クラスが `IAudioSource` を実装
- Twilio音声データをbase64デコード（フォーマット変換なし）
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 6: src/twilio/audioSink.ts 作成

**前提タスク**: Phase1
**対象ファイル**: `implementation/src/twilio/audioSink.ts`
**作業内容**:
OpenAIからTwilio Media Streamsへの音声出力（Phase1の`IAudioSink`実装、g711_ulaw直接使用）:
```typescript
import type { IAudioSink } from '../audio';
import type { Logger } from 'pino';
import type WebSocket from 'ws';

export class TwilioAudioSink implements IAudioSink {
  constructor(
    private ws: WebSocket,
    private streamSid: string,
    private logger: Logger
  ) {}

  async start(): Promise<void> {
    this.logger.info('TwilioAudioSink started');
  }

  async stop(): Promise<void> {
    this.logger.info('TwilioAudioSink stopped');
  }

  write(chunk: Buffer): void {
    // OpenAI Realtime (g711_ulaw出力) → base64エンコードのみ
    const payload = chunk.toString('base64');

    // Twilioへ送信（フォーマット変換なし）
    this.ws.send(
      JSON.stringify({
        event: 'media',
        streamSid: this.streamSid,
        media: {
          payload,
        },
      })
    );
  }
}
```

**完了条件**:
- `src/twilio/audioSink.ts` が作成されている
- `TwilioAudioSink` クラスが `IAudioSink` を実装
- OpenAI音声データをbase64エンコード（フォーマット変換なし）
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 7: src/google/sheetsMock.ts 作成

**前提タスク**: Phase1
**対象ファイル**: `implementation/src/google/sheetsMock.ts`
**作業内容**:
Sheets APIモック実装（固定データ返却）:
```typescript
import type { Logger } from 'pino';
import type { Reservation } from './sheets'; // Phase2の型定義を参照

export class SheetsMockClient {
  private mockReservations: Reservation[] = [
    {
      timestamp_iso: '2025-01-24T10:00:00Z',
      caller_number: '+819012345678',
      reservation_date: '2025-01-25',
      reservation_time: '18:00',
      party_size: 4,
      customer_name: '山田太郎',
      contact_number: '+819012345678',
      status: 'accepted',
    },
    {
      timestamp_iso: '2025-01-24T11:00:00Z',
      caller_number: '+819087654321',
      reservation_date: '2025-01-25',
      reservation_time: '19:00',
      party_size: 2,
      customer_name: '佐藤花子',
      contact_number: '+819087654321',
      status: 'accepted',
    },
  ];

  constructor(private logger: Logger) {}

  async appendReservation(reservation: Reservation): Promise<void> {
    this.logger.info({ reservation_date: reservation.reservation_date }, 'Mock: Reservation appended');
    this.mockReservations.push(reservation);
  }

  async listReservations(): Promise<Reservation[]> {
    this.logger.info({ count: this.mockReservations.length }, 'Mock: Listing reservations');
    return this.mockReservations;
  }

  async findAvailability(date: string, time: string): Promise<number> {
    const count = this.mockReservations.filter(
      (r) => r.reservation_date === date && r.reservation_time === time
    ).length;

    this.logger.info({ date, time, count }, 'Mock: Checking availability');
    return count;
  }
}
```

**完了条件**:
- `src/google/sheetsMock.ts` が作成されている
- `SheetsMockClient` クラスが実装されている
- Phase2の`SheetsClient`と同じインターフェース
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 8: src/google/sheetsMock.test.ts 作成

**前提タスク**: Task 7
**対象ファイル**: `implementation/src/google/sheetsMock.test.ts`
**作業内容**:
モッククライアントのテストを実装:
```typescript
import { describe, it, expect } from 'vitest';
import { SheetsMockClient } from './sheetsMock';
import { createLogger } from '../logger';

describe('SheetsMockClient', () => {
  it('初期データが2件', async () => {
    const client = new SheetsMockClient(createLogger('test'));
    const reservations = await client.listReservations();

    expect(reservations).toHaveLength(2);
  });

  it('予約を追加', async () => {
    const client = new SheetsMockClient(createLogger('test'));

    await client.appendReservation({
      timestamp_iso: '2025-01-24T12:00:00Z',
      caller_number: '+819011111111',
      reservation_date: '2025-01-26',
      reservation_time: '20:00',
      party_size: 3,
      customer_name: 'テスト',
      contact_number: '+819011111111',
      status: 'accepted',
    });

    const reservations = await client.listReservations();
    expect(reservations).toHaveLength(3);
  });

  it('空席確認', async () => {
    const client = new SheetsMockClient(createLogger('test'));

    const count = await client.findAvailability('2025-01-25', '18:00');

    expect(count).toBe(1);
  });
});
```

**完了条件**:
- `src/google/sheetsMock.test.ts` が作成されている
- `pnpm vitest run implementation/src/google/sheetsMock.test.ts` が成功
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 9: src/twilio/mediaStreamServer.ts 作成

**前提タスク**: Task 5, Task 6, Phase1
**対象ファイル**: `implementation/src/twilio/mediaStreamServer.ts`
**作業内容**:
Twilio Media Streams WebSocketサーバーを実装:
```typescript
import WebSocket, { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import type { Logger } from 'pino';
import { TwilioAudioSource } from './audioSource';
import { TwilioAudioSink } from './audioSink';

export class MediaStreamServer extends EventEmitter {
  private wss: WebSocketServer;

  constructor(private port: number, private logger: Logger) {
    super();
    this.wss = new WebSocketServer({ port });
    this.setupServer();
  }

  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      let streamSid: string | null = null;
      let callSid: string | null = null;
      let audioSource: TwilioAudioSource | null = null;
      let audioSink: TwilioAudioSink | null = null;

      this.logger.info('Twilio Media Stream connected');

      ws.on('message', (data: string) => {
        const message = JSON.parse(data);

        switch (message.event) {
          case 'start':
            streamSid = message.streamSid;
            callSid = message.start.callSid;
            this.logger.info({ callSid, streamSid }, 'Media stream started');

            audioSource = new TwilioAudioSource(this.logger);
            audioSink = new TwilioAudioSink(ws, streamSid, this.logger);

            this.emit('call-started', { callSid, audioSource, audioSink });
            break;

          case 'media':
            if (audioSource && message.media.payload) {
              audioSource.handleTwilioAudio(message.media.payload);
            }
            break;

          case 'stop':
            this.logger.info({ callSid }, 'Media stream stopped');
            this.emit('call-ended', { callSid });
            break;
        }
      });

      ws.on('close', () => {
        this.logger.info({ callSid }, 'WebSocket closed');
        this.emit('call-ended', { callSid });
      });
    });
  }

  close(): void {
    this.wss.close();
  }
}
```

**完了条件**:
- `src/twilio/mediaStreamServer.ts` が作成されている
- `MediaStreamServer` クラスが実装されている
- Twilio Media Streams WebSocketを処理
- call-started, call-ended イベントを発火
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 10: src/http/twilioController.ts 作成

**前提タスク**: Task 1, Task 9
**対象ファイル**: `implementation/src/http/twilioController.ts`
**作業内容**:
Twilio Webhook コントローラを実装:
```typescript
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { validateTwilioSignature } from '../twilio/signature';
import { loadConfig } from '../config';

export function registerTwilioRoutes(fastify: FastifyInstance): void {
  fastify.post('/twilio/voice', async (request: FastifyRequest, reply: FastifyReply) => {
    const config = loadConfig();
    const signature = request.headers['x-twilio-signature'] as string;
    const url = `${request.protocol}://${request.hostname}${request.url}`;
    const params = request.body as Record<string, string>;

    // 署名検証
    if (!validateTwilioSignature(config.TWILIO_AUTH_TOKEN, url, params, signature)) {
      request.log.warn('Invalid Twilio signature');
      return reply.code(403).send('Forbidden');
    }

    const callSid = params.CallSid;
    request.log.info({ callSid }, 'Twilio voice webhook received');

    // TwiML: Media Streamsに接続
    const wsUrl = `wss://${request.hostname}/media-stream`;
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}" />
  </Connect>
</Response>`;

    return reply.type('text/xml').send(twiml);
  });
}
```

**完了条件**:
- `src/http/twilioController.ts` が作成されている
- `/twilio/voice` エンドポイントが実装されている
- Twilio署名検証を実施
- TwiMLでMedia Streams接続を指示
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 11: src/http/twilioController.test.ts 作成

**前提タスク**: Task 10
**対象ファイル**: `implementation/src/http/twilioController.test.ts`
**作業内容**:
Twilio Webhookコントローラのテストを実装:
```typescript
import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import { registerTwilioRoutes } from './twilioController';
import crypto from 'crypto';

describe('Twilio Controller', () => {
  it('正しい署名でTwiMLを返す', async () => {
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'test-token');

    const fastify = Fastify({ logger: false });
    registerTwilioRoutes(fastify);

    const url = 'http://localhost:3000/twilio/voice';
    const params = { CallSid: 'CA1234', From: '+819012345678' };
    const data = url + 'CallSidCA1234From+819012345678';
    const hmac = crypto.createHmac('sha1', 'test-token');
    hmac.update(data);
    const signature = hmac.digest('base64');

    const response = await fastify.inject({
      method: 'POST',
      url: '/twilio/voice',
      headers: { 'x-twilio-signature': signature },
      payload: params,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/xml');
    expect(response.body).toContain('<Stream url=');
  });

  it('不正な署名で403を返す', async () => {
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'test-token');

    const fastify = Fastify({ logger: false });
    registerTwilioRoutes(fastify);

    const response = await fastify.inject({
      method: 'POST',
      url: '/twilio/voice',
      headers: { 'x-twilio-signature': 'invalid' },
      payload: { CallSid: 'CA1234' },
    });

    expect(response.statusCode).toBe(403);
  });
});
```

**完了条件**:
- `src/http/twilioController.test.ts` が作成されている
- `pnpm vitest run implementation/src/http/twilioController.test.ts` が成功
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 12: src/conversation/voiceGatewayOrchestrator.ts 作成

**前提タスク**: Task 9, Task 7, Phase1
**対象ファイル**: `implementation/src/conversation/voiceGatewayOrchestrator.ts`
**作業内容**:
Twilio通話オーケストレータを実装（Phase1のLocalOrchestratorを統合）:
```typescript
import { RealtimeClient } from '../realtime/client';
import { SheetsMockClient } from '../google/sheetsMock';
import type { IAudioSource, IAudioSink } from '../audio';
import type { Logger } from 'pino';

export class VoiceGatewayOrchestrator {
  private startTime: number = 0;

  constructor(
    private callSid: string,
    private realtimeClient: RealtimeClient,
    private audioSource: IAudioSource,
    private audioSink: IAudioSink,
    private sheetsClient: SheetsMockClient,
    private logger: Logger
  ) {}

  async start(): Promise<void> {
    this.startTime = Date.now();
    this.logger.info({ callSid: this.callSid }, 'Voice gateway session started');

    // OpenAI接続
    await this.realtimeClient.start();

    // 空席確認のため、Sheetsモックから予約データ取得
    const reservations = await this.sheetsClient.listReservations();
    this.logger.info({ count: reservations.length }, 'Loaded reservations from mock');

    // システムプロンプトに予約状況を含める（TODO: Function Callingで実装）
    // 現在は簡易実装

    // 音声入力 → OpenAI
    this.audioSource.onData((chunk) => {
      this.realtimeClient.sendAudio(chunk);
    });

    // OpenAI → 音声出力
    this.realtimeClient.on('audio.delta', (delta: Buffer) => {
      this.audioSink.write(delta);
    });

    // 音声I/O開始
    await this.audioSource.start();
    await this.audioSink.start();
  }

  async stop(): Promise<void> {
    await this.audioSource.stop();
    await this.audioSink.stop();
    await this.realtimeClient.stop();

    const duration = Date.now() - this.startTime;
    this.logger.info({
      callSid: this.callSid,
      duration_ms: duration,
      status: 'completed',
    }, 'Voice gateway session ended');
  }
}
```

**完了条件**:
- `src/conversation/voiceGatewayOrchestrator.ts` が作成されている
- `VoiceGatewayOrchestrator` クラスが実装されている
- Phase1のRealtimeClientを使用
- Sheetsモックで予約データ取得
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 13: src/conversation/voiceGatewayOrchestrator.test.ts 作成

**前提タスク**: Task 12
**対象ファイル**: `implementation/src/conversation/voiceGatewayOrchestrator.test.ts`
**作業内容**:
VoiceGatewayOrchestrator のテストを実装:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { VoiceGatewayOrchestrator } from './voiceGatewayOrchestrator';
import { FakeAudioSource, FakeAudioSink } from '../audio/fake';
import { RealtimeClient } from '../realtime/client';
import { SheetsMockClient } from '../google/sheetsMock';
import { createLogger } from '../logger';

vi.mock('../realtime/client');

describe('VoiceGatewayOrchestrator', () => {
  it('Twilio通話セッションを開始・終了', async () => {
    const client = new RealtimeClient('test', 'test', createLogger('test'));
    const source = new FakeAudioSource();
    const sink = new FakeAudioSink();
    const sheets = new SheetsMockClient(createLogger('test'));
    const orchestrator = new VoiceGatewayOrchestrator(
      'CA1234',
      client,
      source,
      sink,
      sheets,
      createLogger('test')
    );

    await expect(orchestrator.start()).resolves.not.toThrow();
    await orchestrator.stop();
  });
});
```

**完了条件**:
- `src/conversation/voiceGatewayOrchestrator.test.ts` が作成されている
- `pnpm vitest run implementation/src/conversation/voiceGatewayOrchestrator.test.ts` が成功
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 14: src/server.ts 作成

**前提タスク**: Task 10, Task 9
**対象ファイル**: `implementation/src/server.ts`
**作業内容**:
Fastifyサーバーエントリーポイントを実装:
```typescript
import Fastify from 'fastify';
import { loadConfig } from './config';
import { createLogger } from './logger';
import { registerTwilioRoutes } from './http/twilioController';
import { MediaStreamServer } from './twilio/mediaStreamServer';
import { RealtimeClient } from './realtime/client';
import { SheetsMockClient } from './google/sheetsMock';
import { VoiceGatewayOrchestrator } from './conversation/voiceGatewayOrchestrator';

const config = loadConfig();
const logger = createLogger('server');

const fastify = Fastify({ logger: { level: config.LOG_LEVEL } });

// Twilio Webhook routes
registerTwilioRoutes(fastify);

// Health check
fastify.get('/healthz', async () => {
  return { status: 'ok' };
});

// Media Streams WebSocket Server
const mediaServer = new MediaStreamServer(8080, logger);

mediaServer.on('call-started', async ({ callSid, audioSource, audioSink }) => {
  logger.info({ callSid }, 'Starting voice gateway orchestrator');

  const realtimeClient = new RealtimeClient(
    config.OPENAI_API_KEY,
    config.OPENAI_REALTIME_MODEL,
    createLogger(callSid)
  );
  const sheetsClient = new SheetsMockClient(createLogger(callSid));
  const orchestrator = new VoiceGatewayOrchestrator(
    callSid,
    realtimeClient,
    audioSource,
    audioSink,
    sheetsClient,
    createLogger(callSid)
  );

  await orchestrator.start();

  mediaServer.once('call-ended', async ({ callSid: endedCallSid }) => {
    if (callSid === endedCallSid) {
      await orchestrator.stop();
    }
  });
});

async function start() {
  await fastify.listen({ port: 3000, host: '0.0.0.0' });
  logger.info('Server started on port 3000');
  logger.info('Media Stream server started on port 8080');
}

start().catch((error) => {
  logger.error(error, 'Fatal error');
  process.exit(1);
});
```

**完了条件**:
- `src/server.ts` が作成されている
- Fastifyサーバーが実装されている
- `/twilio/voice` と `/healthz` エンドポイントを提供
- Media StreamsサーバーとVoiceGatewayOrchestratorを統合
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 15: Dockerfile 作成

**前提タスク**: Task 14
**対象ファイル**: `implementation/Dockerfile`
**作業内容**:
Cloud Run用Dockerfileを作成:
```dockerfile
FROM node:20-slim

WORKDIR /app

# pnpmインストール
RUN npm install -g pnpm@latest

# 依存関係のインストール
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# アプリケーションコピー
COPY . .

# TypeScriptビルド（本番用は事前ビルド推奨）
RUN pnpm add -D typescript tsx
RUN pnpm tsc

# ポート公開
EXPOSE 3000 8080

# 起動
CMD ["node", "dist/server.js"]
```

**完了条件**:
- `Dockerfile` が作成されている
- Node.js 20ベース
- pnpmで依存インストール
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

**備考**: `package.json` に以下を追記:
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

---

### Task 16: tools/ngrok-config.yml 作成

**前提タスク**: Task 14
**対象ファイル**: `implementation/tools/ngrok-config.yml`
**作業内容**:
ngrokトンネル設定を作成:
```yaml
version: "2"
authtoken: <your-ngrok-authtoken>
tunnels:
  twilio-http:
    proto: http
    addr: 3000
    bind_tls: true
  twilio-ws:
    proto: http
    addr: 8080
    bind_tls: true
```

**完了条件**:
- `tools/ngrok-config.yml` が作成されている
- HTTPとWebSocket用の2トンネル定義
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

**備考**: ngrok起動コマンド:
```bash
ngrok start --all --config tools/ngrok-config.yml
```

---

### Task 17: tests/integration/twilio-call.test.ts 作成

**前提タスク**: Task 12
**対象ファイル**: `implementation/tests/integration/twilio-call.test.ts`
**作業内容**:
Twilio通話統合テストを実装（手動実行）:
```typescript
import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config';

describe('Twilio Call Integration (Manual)', () => {
  it.skip('実機テスト: Twilio番号に電話して会話', async () => {
    const config = loadConfig();

    // このテストは手動で実行
    // 1. pnpm tsx implementation/src/server.ts を起動
    // 2. ngrok start --all --config tools/ngrok-config.yml でトンネル開始
    // 3. TwilioコンソールでWebhook URLを設定
    // 4. Twilio番号に電話をかける
    // 5. AI応答を確認

    expect(config.TWILIO_PHONE_NUMBER).toBeDefined();
  });
});
```

**完了条件**:
- `tests/integration/twilio-call.test.ts` が作成されている
- 手動テスト手順が記載されている
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 18: README.md 更新

**前提タスク**: Task 14, Task 16
**対象ファイル**: `implementation/README.md`
**作業内容**:
Phase3 のセットアップ手順を追記:
```markdown
## Phase 3: Twilio統合

### セットアップ

1. Twilioアカウント作成
2. 050番号取得
3. Media Streams有効化

### 環境変数設定

```bash
# .env に追記
TWILIO_ACCOUNT_SID=<account_sid>
TWILIO_AUTH_TOKEN=<auth_token>
TWILIO_PHONE_NUMBER=<050_number>
```

### ローカル実行（ngrokトンネル）

1. サーバー起動:
   ```bash
   pnpm tsx implementation/src/server.ts
   ```

2. ngrokトンネル起動:
   ```bash
   ngrok start --all --config tools/ngrok-config.yml
   ```

3. TwilioコンソールでWebhook URL設定:
   - Voice Configuration → A CALL COMES IN
   - Webhook URL: `https://<ngrok-url>/twilio/voice`
   - HTTP POST

4. Twilio番号に電話をかけてテスト

### Cloud Runデプロイ

詳細は `docs/howto/cloud-run-deploy.md` を参照
```

**完了条件**:
- `README.md` が更新されている
- Phase3 のセットアップ手順が記載されている
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 19: docs/howto/cloud-run-deploy.md 作成

**前提タスク**: Task 15
**対象ファイル**: `implementation/docs/howto/cloud-run-deploy.md`
**作業内容**:
Cloud Runデプロイガイドを作成:
```markdown
# Cloud Run デプロイガイド

## 1. GCPプロジェクト準備

```bash
export PROJECT_ID=restaurant-voice-ai
gcloud config set project $PROJECT_ID
```

## 2. Artifact Registry リポジトリ作成

```bash
gcloud artifacts repositories create restaurant-voice-ai \
  --repository-format=docker \
  --location=asia-northeast1
```

## 3. Dockerイメージビルド

```bash
gcloud builds submit --tag asia-northeast1-docker.pkg.dev/$PROJECT_ID/restaurant-voice-ai/server:latest
```

## 4. Cloud Runデプロイ

```bash
gcloud run deploy restaurant-voice-ai \
  --image asia-northeast1-docker.pkg.dev/$PROJECT_ID/restaurant-voice-ai/server:latest \
  --platform managed \
  --region asia-northeast1 \
  --timeout 3600 \
  --concurrency 2 \
  --min-instances 1 \
  --set-env-vars OPENAI_API_KEY=$OPENAI_API_KEY,TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID,TWILIO_AUTH_TOKEN=$TWILIO_AUTH_TOKEN
```

## 5. Webhook URL設定

1. デプロイ完了後、Cloud RunのURLを取得
2. TwilioコンソールでWebhook URLを設定:
   - `https://<cloud-run-url>/twilio/voice`

## トラブルシューティング

### タイムアウトエラー

- `--timeout 3600` を確認
- Cloud Runのログで通話時間を確認

### WebSocket接続エラー

- Cloud RunはWebSocketをサポート
- ポート8080が公開されているか確認
```

**完了条件**:
- `docs/howto/cloud-run-deploy.md` が作成されている
- デプロイ手順が詳細に記載されている
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 20: docs/notes/phase3.md 作成

**前提タスク**: Task 17
**対象ファイル**: `implementation/docs/notes/phase3.md`
**作業内容**:
Phase3 完了報告を作成:
```markdown
# Phase 3 完了報告

**完了日**: YYYY-MM-DD
**担当**: Codex (開発)、GitHub操作エージェント、レビューAI

## 実施内容

- Twilio Webhook署名検証実装
- Twilio Media Streams WebSocketサーバー実装
- 音声変換（mulaw 8kHz ↔ PCM 16kHz）実装
- Twilio Audio Source/Sink実装（Phase1インターフェース）
- Sheetsモッククライアント実装
- Voice Gateway Orchestrator実装
- Fastifyサーバー実装
- Dockerfile作成
- ngrok設定作成
- Cloud Runデプロイガイド作成

## テスト結果

- ユニットテスト: ✅ 全成功
- 統合テスト: ✅ 手動実機テスト成功
- エンドツーエンド: ✅ 電話着信 → AI応答 → Sheetsモック参照応答

## 実機テスト結果

- 電話着信: ✅ 正常
- AI音声応答: ✅ 正常
- 音声品質: ✅ 良好
- レイテンシー: ⏱️ 約700ms（目標800ms以内）
- Sheetsモック参照: ✅ 正常

## 未決課題

- Phase4でSheetsモックを実装に置き換え
- Function Calling実装（予約データ抽出）
- エラーハンドリング強化

## 次フェーズへのTODO

- Phase4: E2E統合（実Sheets連携、Function Calling、本番準備）
```

**完了条件**:
- `docs/notes/phase3.md` が作成されている
- 実施内容・テスト結果・課題が記載されている
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

## 5. フェーズ完了チェックリスト

- [ ] 全20タスクが `done` ステータスに到達
- [ ] `pnpm test` が成功
- [ ] `pnpm tsx implementation/src/server.ts` が起動
- [ ] ngrok経由で実機電話テストが成功
- [ ] `docs/notes/phase3.md` が作成され、Slack #restaurant-voice-ai-dev に共有
- [ ] 全PRがレビュー承認済み・マージ済み

---

**次フェーズ**: Phase4 (E2E統合 - 実Sheets連携、本番準備) へ進む
