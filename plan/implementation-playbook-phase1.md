# implementation-playbook Phase 1 — Local Voice Conversation

> Phase1 は OpenAI Realtime API との音声会話をローカルCLIで実現する。単一ファイル・単一作業原則に従い、各タスクは1ファイルの作成・修正のみを行う。全タスクは state.md 遷移（coding → pr_preparation → review → fix → integration → done）を経る。

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

#### OpenAI Realtime APIクライアント（Task 7-8）
- [x] Task 7: src/realtime/client.ts 作成
- [x] Task 8: src/realtime/client.test.ts 作成

#### 音声I/Oインターフェース（Task 9-15）
- [x] Task 9: src/audio/index.ts 作成
- [x] Task 10: src/audio/microphone.ts 作成
- [x] Task 11: src/audio/microphone.test.ts 作成
- [x] Task 12: src/audio/speakers.ts 作成
- [x] Task 13: src/audio/speakers.test.ts 作成
- [x] Task 14: src/audio/fake.ts 作成
- [x] Task 15: src/audio/fake.test.ts 作成

#### 会話オーケストレーション（Task 16-17）
- [x] Task 16: src/conversation/localOrchestrator.ts 作成
- [x] Task 17: src/conversation/localOrchestrator.test.ts 作成

#### CLIと統合テスト（Task 18-19）
- [x] Task 18: src/bin/local-realtime.ts 作成
- [x] Task 19: tests/integration/local-conversation.test.ts 作成

#### ドキュメント（Task 20-22）
- [x] Task 20: README.md 更新
- [x] Task 21: docs/howto/local-audio.md 作成
- [x] Task 22: docs/notes/phase1.md 作成

#### 実装確定（Task 23-25）
- [x] Task 23: soxマイク実装テスト更新（src/audio/microphone.test.ts）
- [x] Task 24: Realtime日本語設定テスト更新（src/realtime/client.test.ts）
- [x] Task 25: transcriptログ実装完了（src/realtime/client.ts）

### フェーズ完了条件
- [x] 全25タスクが完了
- [x] `npm test` が成功 (16テストスイート=全25タスクの検証が完了)
- [x] ローカル環境での動作確認完了
- [x] `docs/notes/phase1.md` が作成済み
- [ ] 全PRがレビュー承認済み・マージ済み (現在pr_preparation状態)

---

## 1. フェーズ目的と完了条件

### 目的
開発用マシン上で OpenAI Realtime API と日本語音声で双方向会話できる CLI を構築する。Twilio・Google Sheets には触れない。

### 完了条件
1. CLI 実行でリアルタイム会話が成立し、ログに timestamp + sessionID + 全文が残る
2. `npx vitest run` が成功（音声I/Oはモック実装でテスト可能）
3. `docs/notes/phase1.md` にフェーズ完了報告が記録されている

## 2. 技術仕様

### 使用ツール・ライブラリ
- **言語**: TypeScript + Node.js 20 LTS
- **パッケージマネージャ**: npm (Node.js 20 同梱)
- **HTTPサーバー**: Fastify v5 (Phase3以降で使用)
- **WebSocket**: ws
- **OpenAI SDK**: openai v4.81.0+ (`OpenAIRealtimeWS`)
- **リトライ**: p-retry
- **テスト**: vitest
- **ログ**: pino
- **音声入力**: sox (child_process経由)
- **音声出力**: speaker (代替: play-sound)
- **CLI**: commander
- **スキーマ検証**: zod

### OpenAI Realtime API 仕様
- **モデル**: `gpt-realtime-2025-08-28` (GA版)
- **旧モデル**: `gpt-4o-realtime-preview-2024-12-17` (非推奨)
- **音声フォーマット**: PCM16 24kHz, 16-bit, mono (ローカル環境)
- **レイテンシー**: 200ms以下
- **機能**: Speech-to-Speech, Server VAD, 文字起こし (Whisper-1), 割り込み処理

### Phase 1 実装時の仕様変更
本Playbookの当初計画から、実装テスト中に以下の緊急修正を実施:

1. **音声入力をsoxに変更**:
   - `node-record-lpcm16`は6年間メンテナンス停止、内部でsoxを使用
   - macOS環境での動作不安定性を解消するため、直接sox使用に変更

2. **日本語レストラン予約AI設定を追加**:
   - セッション開始時に日本語プロンプトと初期挨拶を設定
   - VAD設定 (threshold: 0.6, silence_duration: 1000ms) で環境音を低減

3. **Turn Control実装**:
   - AI応答中のマイク入力を抑制 (`isAiSpeaking`フラグ)
   - 過入力によるフィードバックループを防止

4. **Transcript Logging追加**:
   - ユーザー/AI双方の文字起こしをログ出力
   - デバッグと会話履歴追跡を容易化

これらの変更により、当初のTask 26-28で計画していた「本仕様リストア」は不要となり、緊急修正版が本仕様として確定。

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
Task 9 (audio/index.ts) ← なし
  ↓
Task 10 (audio/microphone.ts) ← Task 9, Task 5
  ↓
Task 11 (audio/microphone.test.ts) ← Task 10
  ↓
Task 12 (audio/speakers.ts) ← Task 9, Task 5
  ↓
Task 13 (audio/speakers.test.ts) ← Task 12
  ↓
Task 14 (audio/fake.ts) ← Task 9
  ↓
Task 15 (audio/fake.test.ts) ← Task 14
  ↓
Task 16 (conversation/localOrchestrator.ts) ← Task 7, Task 9, Task 5
  ↓
Task 17 (conversation/localOrchestrator.test.ts) ← Task 16
  ↓
Task 18 (bin/local-realtime.ts) ← Task 16
  ↓
Task 19 (統合テスト) ← Task 18
  ↓
Task 20 (README.md) ← Task 18
  ↓
Task 21 (docs/howto/local-audio.md) ← Task 10, Task 12
  ↓
Task 22 (docs/notes/phase1.md) ← Task 19
```

## 4. タスク詳細

### Task 0: プロジェクト初期化

**前提タスク**: なし
**対象ファイル**: `implementation/package.json`, `implementation/tsconfig.json`
**作業内容**:
1. `npm init -y` でプロジェクト初期化
2. 依存パッケージ追加:
   ```bash
   npm install openai@^4.81.0 ws pino p-retry commander zod
   npm install --save-dev typescript tsx vitest @types/node @types/ws @types/pino node-record-lpcm16 speaker
   ```
3. `tsconfig.json` 作成:
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "ESNext",
       "moduleResolution": "Bundler",
       "allowJs": false,
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true,
       "types": ["node"]
     },
     "include": ["src"]
   }
   ```
4. `package.json` に scripts 追加:
   ```json
   {
     "scripts": {
       "test": "vitest run",
       "test:watch": "vitest",
       "dev": "tsx src/bin/local-realtime.ts"
     }
   }
   ```

**完了条件**:
- `npm install` が成功
- `npx tsc --noEmit` が成功（警告のみOK）
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 1: .gitignore 作成

**前提タスク**: Task 0
**対象ファイル**: `implementation/.gitignore`
**作業内容**:
以下を含む `.gitignore` を作成:
```text
node_modules/
dist/
.env
.env.local
*.log
logs/
out/
.DS_Store
```

**完了条件**:
- `.gitignore` が作成されている
- `.env` が git tracking から除外されている
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 2: .env.template 作成

**前提タスク**: Task 0
**対象ファイル**: `implementation/.env.template`
**作業内容**:
環境変数テンプレート作成:
```text
# OpenAI API
OPENAI_API_KEY=

# オプション
OPENAI_REALTIME_MODEL=gpt-realtime-2025-08-28
AUDIO_SAMPLE_RATE=16000
LOG_LEVEL=info
```

**完了条件**:
- `.env.template` が作成されている
- 必須変数 `OPENAI_API_KEY` が記載されている
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 3: src/config.ts 作成

**前提タスク**: Task 2
**対象ファイル**: `implementation/src/config.ts`
**作業内容**:
Zod で環境変数を検証する設定ローダーを実装:
```typescript
import { z } from 'zod';

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_REALTIME_MODEL: z.string().default('gpt-realtime-2025-08-28'),
  AUDIO_SAMPLE_RATE: z.coerce.number().default(16000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Environment validation failed:', result.error.format());
    process.exit(1);
  }
  return result.data;
}
```

**完了条件**:
- `src/config.ts` が作成されている
- `loadConfig()` 関数がエクスポートされている
- Zod スキーマで環境変数検証を実装
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 4: src/config.test.ts 作成

**前提タスク**: Task 3
**対象ファイル**: `implementation/src/config.test.ts`
**作業内容**:
`config.ts` のユニットテストを実装:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('必須変数が欠けている場合はprocess.exitを呼ぶ', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.stubEnv('OPENAI_API_KEY', '');

    loadConfig();

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it('デフォルト値が適用される', () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');

    const config = loadConfig();

    expect(config.OPENAI_REALTIME_MODEL).toBe('gpt-realtime-2025-08-28');
    expect(config.AUDIO_SAMPLE_RATE).toBe(16000);
  });
});
```

**完了条件**:
- `src/config.test.ts` が作成されている
- `npx vitest run implementation/src/config.test.ts` が成功
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 5: src/logger.ts 作成

**前提タスク**: Task 3
**対象ファイル**: `implementation/src/logger.ts`
**作業内容**:
Pino ロガーを初期化:
```typescript
import pino from 'pino';
import { loadConfig } from './config';

const config = loadConfig();

export const logger = pino({
  level: config.LOG_LEVEL,
});

export function createLogger(correlationId: string) {
  return logger.child({ correlationId });
}
```

**完了条件**:
- `src/logger.ts` が作成されている
- `logger` と `createLogger` がエクスポートされている
- `correlationId` を子ロガーに設定できる
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 6: src/logger.test.ts 作成

**前提タスク**: Task 5
**対象ファイル**: `implementation/src/logger.test.ts`
**作業内容**:
ロガーのテストを実装:
```typescript
import { describe, it, expect } from 'vitest';
import { createLogger } from './logger';

describe('createLogger', () => {
  it('correlationIdを持つ子ロガーを作成', () => {
    const childLogger = createLogger('test-session-123');

    expect(childLogger.bindings()).toMatchObject({
      correlationId: 'test-session-123',
    });
  });
});
```

**完了条件**:
- `src/logger.test.ts` が作成されている
- `npx vitest run implementation/src/logger.test.ts` が成功
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 7: src/realtime/client.ts 作成

**前提タスク**: Task 5
**対象ファイル**: `implementation/src/realtime/client.ts`
**作業内容**:
OpenAI Realtime API クライアントを実装:
```typescript
import { OpenAIRealtimeWS } from 'openai/beta/realtime/websocket';
import pRetry from 'p-retry';
import { EventEmitter } from 'events';
import type { Logger } from 'pino';

export class RealtimeClient extends EventEmitter {
  private ws: OpenAIRealtimeWS | null = null;

  constructor(
    private apiKey: string,
    private model: string,
    private logger: Logger
  ) {
    super();
  }

  async start() {
    await pRetry(
      async () => {
        this.ws = await OpenAIRealtimeWS.connect({
          apiKey: this.apiKey,
          model: this.model,
        });
        this.setupEventHandlers();
        this.logger.info('Realtime API connected');
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: 500,
        maxTimeout: 5000,
      }
    );
  }

  private setupEventHandlers() {
    if (!this.ws) return;

    this.ws.on('response.audio.delta', (event) => {
      this.emit('audio.delta', event.delta);
    });

    this.ws.on('response.done', (event) => {
      this.emit('response.done', event);
    });
  }

  sendAudio(chunk: Buffer) {
    if (!this.ws) throw new Error('WebSocket not connected');
    this.ws.sendAudioChunk(chunk);
  }

  async stop() {
    if (this.ws) {
      await this.ws.close();
      this.logger.info('Realtime API disconnected');
    }
  }
}
```

**完了条件**:
- `src/realtime/client.ts` が作成されている
- `RealtimeClient` クラスが実装されている
- `p-retry` による再接続ロジックが実装されている
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 8: src/realtime/client.test.ts 作成

**前提タスク**: Task 7
**対象ファイル**: `implementation/src/realtime/client.test.ts`
**作業内容**:
RealtimeClient のテストを実装（モック使用）:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { RealtimeClient } from './client';
import { createLogger } from '../logger';

vi.mock('openai/beta/realtime/websocket', () => ({
  OpenAIRealtimeWS: {
    connect: vi.fn().mockResolvedValue({
      on: vi.fn(),
      sendAudioChunk: vi.fn(),
      close: vi.fn(),
    }),
  },
}));

describe('RealtimeClient', () => {
  it('start()でWebSocket接続を確立', async () => {
    const client = new RealtimeClient('test-key', 'test-model', createLogger('test'));

    await expect(client.start()).resolves.not.toThrow();
  });

  it('stop()で接続を閉じる', async () => {
    const client = new RealtimeClient('test-key', 'test-model', createLogger('test'));
    await client.start();

    await expect(client.stop()).resolves.not.toThrow();
  });
});
```

**完了条件**:
- `src/realtime/client.test.ts` が作成されている
- `npx vitest run implementation/src/realtime/client.test.ts` が成功
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 9: src/audio/index.ts 作成

**前提タスク**: なし
**対象ファイル**: `implementation/src/audio/index.ts`
**作業内容**:
音声入出力のインターフェース定義:
```typescript
export interface IAudioSource {
  start(): Promise<void>;
  stop(): Promise<void>;
  onData(callback: (chunk: Buffer) => void): void;
}

export interface IAudioSink {
  start(): Promise<void>;
  stop(): Promise<void>;
  write(chunk: Buffer): void;
}
```

**完了条件**:
- `src/audio/index.ts` が作成されている
- `IAudioSource` と `IAudioSink` インターフェースが定義されている
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 10: src/audio/microphone.ts 作成

**前提タスク**: Task 9, Task 5
**対象ファイル**: `implementation/src/audio/microphone.ts`
**作業内容**:
マイク入力を実装 (sox使用):
```typescript
import { spawn, ChildProcess } from 'child_process';
import type { Logger } from 'pino';
import type { IAudioSource } from './index';

export class Microphone implements IAudioSource {
  private process: ChildProcess | null = null;
  private callback: ((chunk: Buffer) => void) | null = null;

  constructor(
    private readonly sampleRate: number,
    private readonly logger: Logger
  ) {}

  async start(): Promise<void> {
    // Use sox to capture audio from default microphone
    // Output: 16-bit PCM, mono, specified sample rate
    this.process = spawn('sox', [
      '-d',                    // default audio device (microphone)
      '-t', 'raw',            // output type: raw PCM
      '-b', '16',             // 16-bit
      '-e', 'signed-integer', // signed integer encoding
      '-c', '1',              // mono (1 channel)
      '-r', this.sampleRate.toString(), // sample rate
      '-',                    // output to stdout
    ]);

    if (!this.process.stdout) {
      throw new Error('Failed to start sox process');
    }

    this.process.stdout.on('data', (chunk: Buffer) => {
      this.logger.debug({ chunkSize: chunk.length }, 'Microphone data received');
      if (this.callback) {
        this.callback(chunk);
      }
    });

    this.process.stderr?.on('data', (data) => {
      this.logger.debug({ stderr: data.toString() }, 'sox stderr');
    });

    this.process.on('error', (error) => {
      this.logger.error({ err: error }, 'sox process error');
    });

    this.process.on('exit', (code, signal) => {
      this.logger.warn({ code, signal }, 'sox process exited');
    });

    this.logger.info('Microphone started (sox)');
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
      this.logger.info('Microphone stopped');
    }
  }

  onData(callback: (chunk: Buffer) => void): void {
    this.callback = callback;
  }
}
```

**完了条件**:
- `src/audio/microphone.ts` が作成されている
- `Microphone` クラスが `IAudioSource` を実装
- sox経由でマイク入力を取得
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 11: src/audio/microphone.test.ts 作成

**前提タスク**: Task 10
**対象ファイル**: `implementation/src/audio/microphone.test.ts`
**作業内容**:
Microphone のテストを実装（child_processモック使用）:
```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;

  kill(signal?: string) {
    this.killed = true;
    return true;
  }
}

let mockProcess: MockChildProcess;
const spawnMock = vi.fn(() => mockProcess);

vi.mock('child_process', () => ({
  spawn: spawnMock,
}));

const createTestLogger = async () => {
  vi.stubEnv('OPENAI_API_KEY', 'test-key');
  const { createLogger } = await import('../logger');
  return createLogger('test');
};

beforeEach(() => {
  mockProcess = new MockChildProcess();
  spawnMock.mockClear();
});

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('Microphone', () => {
  it('start()でsoxプロセスを起動', async () => {
    const { Microphone } = await import('./microphone');
    const mic = new Microphone(16000, await createTestLogger());

    await expect(mic.start()).resolves.not.toThrow();
    expect(spawnMock).toHaveBeenCalledWith('sox', [
      '-d',
      '-t', 'raw',
      '-b', '16',
      '-e', 'signed-integer',
      '-c', '1',
      '-r', '16000',
      '-',
    ]);
  });

  it('stop()でsoxプロセスを停止', async () => {
    const { Microphone } = await import('./microphone');
    const mic = new Microphone(16000, await createTestLogger());
    await mic.start();

    await expect(mic.stop()).resolves.not.toThrow();
    expect(mockProcess.killed).toBe(true);
  });
});
```

**完了条件**:
- `src/audio/microphone.test.ts` が作成されている
- `npx vitest run implementation/src/audio/microphone.test.ts` が成功
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 12: src/audio/speakers.ts 作成

**前提タスク**: Task 9, Task 5
**対象ファイル**: `implementation/src/audio/speakers.ts`
**作業内容**:
スピーカー出力を実装:
```typescript
import Speaker from 'speaker';
import type { Logger } from 'pino';
import type { IAudioSink } from './index';

export class Speakers implements IAudioSink {
  private speaker: Speaker | null = null;

  constructor(
    private sampleRate: number,
    private logger: Logger
  ) {}

  async start(): Promise<void> {
    this.speaker = new Speaker({
      channels: 1,
      bitDepth: 16,
      sampleRate: this.sampleRate,
    });

    this.logger.info('Speakers started');
  }

  async stop(): Promise<void> {
    if (this.speaker) {
      this.speaker.end();
      this.logger.info('Speakers stopped');
    }
  }

  write(chunk: Buffer): void {
    if (this.speaker) {
      this.speaker.write(chunk);
    }
  }
}
```

**完了条件**:
- `src/audio/speakers.ts` が作成されている
- `Speakers` クラスが `IAudioSink` を実装
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 13: src/audio/speakers.test.ts 作成

**前提タスク**: Task 12
**対象ファイル**: `implementation/src/audio/speakers.test.ts`
**作業内容**:
Speakers のテストを実装（モック使用）:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { Speakers } from './speakers';
import { createLogger } from '../logger';

vi.mock('speaker', () => ({
  default: vi.fn().mockImplementation(() => ({
    write: vi.fn(),
    end: vi.fn(),
  })),
}));

describe('Speakers', () => {
  it('start()でスピーカーを起動', async () => {
    const speakers = new Speakers(16000, createLogger('test'));

    await expect(speakers.start()).resolves.not.toThrow();
  });

  it('stop()でスピーカーを停止', async () => {
    const speakers = new Speakers(16000, createLogger('test'));
    await speakers.start();

    await expect(speakers.stop()).resolves.not.toThrow();
  });
});
```

**完了条件**:
- `src/audio/speakers.test.ts` が作成されている
- `npx vitest run implementation/src/audio/speakers.test.ts` が成功
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 14: src/audio/fake.ts 作成

**前提タスク**: Task 9
**対象ファイル**: `implementation/src/audio/fake.ts`
**作業内容**:
CI/テスト用フェイク音声I/Oを実装:
```typescript
import type { IAudioSource, IAudioSink } from './index';

export class FakeAudioSource implements IAudioSource {
  private callback: ((chunk: Buffer) => void) | null = null;
  private interval: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    // 20msごとにダミー音声データを生成
    this.interval = setInterval(() => {
      if (this.callback) {
        const dummyChunk = Buffer.alloc(320); // 16kHz, 20ms
        this.callback(dummyChunk);
      }
    }, 20);
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  onData(callback: (chunk: Buffer) => void): void {
    this.callback = callback;
  }
}

export class FakeAudioSink implements IAudioSink {
  private chunks: Buffer[] = [];

  async start(): Promise<void> {
    // 何もしない
  }

  async stop(): Promise<void> {
    // 何もしない
  }

  write(chunk: Buffer): void {
    this.chunks.push(chunk);
  }

  getChunks(): Buffer[] {
    return this.chunks;
  }
}
```

**完了条件**:
- `src/audio/fake.ts` が作成されている
- `FakeAudioSource` と `FakeAudioSink` が実装されている
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 15: src/audio/fake.test.ts 作成

**前提タスク**: Task 14
**対象ファイル**: `implementation/src/audio/fake.test.ts`
**作業内容**:
フェイク音声I/Oのテストを実装:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { FakeAudioSource, FakeAudioSink } from './fake';

describe('FakeAudioSource', () => {
  it('start()後にダミーデータを生成', async () => {
    const source = new FakeAudioSource();
    const chunks: Buffer[] = [];

    source.onData((chunk) => chunks.push(chunk));
    await source.start();

    await new Promise((resolve) => setTimeout(resolve, 50));
    await source.stop();

    expect(chunks.length).toBeGreaterThan(0);
  });
});

describe('FakeAudioSink', () => {
  it('write()でデータを保存', async () => {
    const sink = new FakeAudioSink();
    await sink.start();

    const chunk = Buffer.from('test');
    sink.write(chunk);

    expect(sink.getChunks()).toHaveLength(1);
    expect(sink.getChunks()[0]).toEqual(chunk);
  });
});
```

**完了条件**:
- `src/audio/fake.test.ts` が作成されている
- `npx vitest run implementation/src/audio/fake.test.ts` が成功
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 16: src/conversation/localOrchestrator.ts 作成

**前提タスク**: Task 7, Task 9, Task 5
**対象ファイル**: `implementation/src/conversation/localOrchestrator.ts`
**作業内容**:
会話オーケストレータを実装:
```typescript
import { RealtimeClient } from '../realtime/client';
import type { IAudioSource, IAudioSink } from '../audio';
import type { Logger } from 'pino';
import { randomUUID } from 'crypto';

export class LocalOrchestrator {
  private correlationId: string;
  private startTime: number = 0;

  constructor(
    private realtimeClient: RealtimeClient,
    private audioSource: IAudioSource,
    private audioSink: IAudioSink,
    private logger: Logger
  ) {
    this.correlationId = randomUUID();
  }

  async start(): Promise<void> {
    this.startTime = Date.now();
    this.logger.info({ correlationId: this.correlationId }, 'Session started');

    // OpenAI接続
    await this.realtimeClient.start();

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
      correlationId: this.correlationId,
      duration_ms: duration,
      status: 'completed',
    }, 'Session ended');
  }
}
```

**完了条件**:
- `src/conversation/localOrchestrator.ts` が作成されている
- `LocalOrchestrator` クラスが実装されている
- 音声I/OとRealtimeClientを統合
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 17: src/conversation/localOrchestrator.test.ts 作成

**前提タスク**: Task 16
**対象ファイル**: `implementation/src/conversation/localOrchestrator.test.ts`
**作業内容**:
LocalOrchestrator のテストを実装:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { LocalOrchestrator } from './localOrchestrator';
import { FakeAudioSource, FakeAudioSink } from '../audio/fake';
import { RealtimeClient } from '../realtime/client';
import { createLogger } from '../logger';

vi.mock('../realtime/client');

describe('LocalOrchestrator', () => {
  it('start()でセッションを開始', async () => {
    const client = new RealtimeClient('test', 'test', createLogger('test'));
    const source = new FakeAudioSource();
    const sink = new FakeAudioSink();
    const orchestrator = new LocalOrchestrator(client, source, sink, createLogger('test'));

    await expect(orchestrator.start()).resolves.not.toThrow();
    await orchestrator.stop();
  });
});
```

**完了条件**:
- `src/conversation/localOrchestrator.test.ts` が作成されている
- `npx vitest run implementation/src/conversation/localOrchestrator.test.ts` が成功
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 18: src/bin/local-realtime.ts 作成

**前提タスク**: Task 16
**対象ファイル**: `implementation/src/bin/local-realtime.ts`
**作業内容**:
CLI エントリーポイントを実装:
```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { loadConfig } from '../config';
import { createLogger } from '../logger';
import { RealtimeClient } from '../realtime/client';
import { Microphone } from '../audio/microphone';
import { Speakers } from '../audio/speakers';
import { FakeAudioSource, FakeAudioSink } from '../audio/fake';
import { LocalOrchestrator } from '../conversation/localOrchestrator';

const program = new Command();

program
  .name('local-realtime')
  .option('--dry-run', 'Use fake audio I/O for testing')
  .option('--model <model>', 'OpenAI model to use')
  .parse();

const options = program.opts();
const config = loadConfig();

const model = options.model || config.OPENAI_REALTIME_MODEL;
const logger = createLogger('cli');

const realtimeClient = new RealtimeClient(config.OPENAI_API_KEY, model, logger);

let audioSource, audioSink;
if (options.dryRun) {
  audioSource = new FakeAudioSource();
  audioSink = new FakeAudioSink();
  logger.info('Using fake audio I/O');
} else {
  audioSource = new Microphone(config.AUDIO_SAMPLE_RATE, logger);
  audioSink = new Speakers(config.AUDIO_SAMPLE_RATE, logger);
  logger.info('Using real audio I/O');
}

const orchestrator = new LocalOrchestrator(realtimeClient, audioSource, audioSink, logger);

async function main() {
  await orchestrator.start();

  // Ctrl+C でグレースフル終了
  process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    await orchestrator.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error(error, 'Fatal error');
  process.exit(1);
});
```

**完了条件**:
- `src/bin/local-realtime.ts` が作成されている
- `--dry-run` フラグが実装されている
- `npm exec tsx implementation/src/bin/local-realtime.ts -- --dry-run` が起動する
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 19: tests/integration/local-conversation.test.ts 作成

**前提タスク**: Task 18
**対象ファイル**: `implementation/tests/integration/local-conversation.test.ts`
**作業内容**:
統合テストを実装:
```typescript
import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config';
import { createLogger } from '../../src/logger';
import { RealtimeClient } from '../../src/realtime/client';
import { FakeAudioSource, FakeAudioSink } from '../../src/audio/fake';
import { LocalOrchestrator } from '../../src/conversation/localOrchestrator';

describe('Local Conversation Integration', () => {
  it('フェイク音声I/Oで会話セッションを開始・終了', async () => {
    const config = loadConfig();
    const logger = createLogger('integration-test');
    const client = new RealtimeClient(config.OPENAI_API_KEY, config.OPENAI_REALTIME_MODEL, logger);
    const source = new FakeAudioSource();
    const sink = new FakeAudioSink();
    const orchestrator = new LocalOrchestrator(client, source, sink, logger);

    await orchestrator.start();

    // 1秒待機
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await orchestrator.stop();

    // 音声データが処理されたことを確認
    expect(sink.getChunks().length).toBeGreaterThan(0);
  }, 10000); // 10秒タイムアウト
});
```

**完了条件**:
- `tests/integration/local-conversation.test.ts` が作成されている
- `npx vitest run implementation/tests/integration/local-conversation.test.ts` が成功
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 20: README.md 更新

**前提タスク**: Task 18
**対象ファイル**: `implementation/README.md`
**作業内容**:
Phase1 のセットアップ手順を追記:
```markdown
# restaurant-voice-ai

日本国内飲食店向け電話予約受付AIシステム

## Phase 1: ローカル音声会話

### セットアップ

1. 依存インストール:
   ```bash
   npm install
   ```

2. 環境変数設定:
   ```bash
   cp .env.template .env
   # .env に OPENAI_API_KEY を設定
   ```

3. テスト実行:
   ```bash
   npm test
   ```

### 使い方

```bash
# ローカルマイク/スピーカーで会話
npm exec tsx src/bin/local-realtime.ts

# フェイク音声I/Oでテスト
npm exec tsx src/bin/local-realtime.ts -- --dry-run
```

※ dry-run 時は `FakeRealtimeClient` が即座に `response.done` を返し、オーケストレータが自動停止するため API 課金は発生しません。

### トラブルシューティング

- マイクが検出されない: OS のマイク権限を確認
- `node-record-lpcm16` のビルドエラー: `mic` パッケージへの切り替えを検討
```

**完了条件**:
- `README.md` が更新されている
- Phase1 のセットアップ手順が記載されている
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 21: docs/howto/local-audio.md 作成

**前提タスク**: Task 10, Task 12
**対象ファイル**: `implementation/docs/howto/local-audio.md`
**作業内容**:
OS別マイク権限設定ガイドを作成:
```markdown
# ローカル音声I/O設定ガイド

## macOS

1. システム環境設定 → セキュリティとプライバシー → プライバシー → マイク
2. ターミナルアプリにマイクアクセスを許可

## Windows

1. 設定 → プライバシー → マイク
2. アプリにマイクアクセスを許可

## Linux (Ubuntu)

```bash
# マイク確認
arecord -l

# PulseAudio権限確認
pactl list sources
```

## ネイティブ依存のビルドエラー

`node-record-lpcm16` または `speaker` のビルドに失敗する場合:

1. 代替パッケージ検討: `mic`, `play-sound`
2. Python 2.7/3.x と build-tools のインストール確認
```

**完了条件**:
- `docs/howto/local-audio.md` が作成されている
- OS別設定手順が記載されている
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 22: docs/notes/phase1.md 作成

**前提タスク**: Task 19
**対象ファイル**: `implementation/docs/notes/phase1.md`
**作業内容**:
Phase1 完了報告を作成:
```markdown
# Phase 1 完了報告

**完了日**: YYYY-MM-DD
**担当**: Codex (開発)、GitHub操作エージェント、レビューAI

## 実施内容

- OpenAI Realtime API クライアント実装（フェイククライアント含む）
- ローカル音声I/O (マイク/スピーカー) 実装
- フェイク音声I/O (テスト・dry-run用) 実装
- ローカル会話オーケストレータ実装
- CLI エントリポイント (`local-realtime.ts`) 実装
- README / ローカル音声設定ガイド整備
- ユニットテスト・統合テストの整備と実行

## テスト結果

- ユニットテスト: ✅ 16/16 成功 (`npm test`)
- 統合テスト: ✅ 1/1 成功 (`npm test -- --run tests/integration/local-conversation.test.ts`)
- 手動QA: ✅ `npm exec tsx src/bin/local-realtime.ts -- --dry-run` で起動確認 (フェイクRealtime使用)

## 未決課題

- 実API利用時のレスポンス制御チューニング（リアルモード実機検証は要APIキー・要課金）
- 音声入出力デバイスに依存する挙動の追加検証

## 次フェーズへのTODO

- Phase2: Google Sheets 連携の実装
- システムプロンプトに店舗情報など文脈情報を付与する設計検討
```

**完了条件**:
- `docs/notes/phase1.md` が作成されている
- 実施内容・テスト結果・課題が記載されている
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

## 5. フェーズ完了チェックリスト

- [x] 全24タスクが `done` ステータスに到達
- [x] `npm test` が成功（実行日時: 2025-10-25 / 16 tests）
- [x] `npm exec tsx src/bin/local-realtime.ts -- --dry-run` が正常終了（FakeRealtimeClient により自動停止）
- [x] `docs/notes/phase1.md` がリポジトリに反映済み
- [ ] Slack #restaurant-voice-ai-dev へ成果共有（要手動対応）

---

**次フェーズ**: Phase 2（Google Sheets 連携）へ進む
