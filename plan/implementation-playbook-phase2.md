# implementation-playbook Phase 2 — Google Sheets Integration

> Phase2 は Google Sheets API との連携を実装する。音声会話機能（Phase1）は使用せず、固定の予約データでSheets APIの書き込み・読み込み・エラー処理をテストする。単一ファイル・単一作業原則に従い、各タスクは state.md 遷移を経る。

## 進捗管理

### タスク進捗チェックリスト

#### Google認証（Task 1-2）
- [x] Task 1: src/google/auth.ts 作成
- [x] Task 2: src/google/auth.test.ts 作成

#### Sheetsクライアント（Task 3-4）
- [x] Task 3: src/google/sheets.ts 作成
- [x] Task 4: src/google/sheets.test.ts 作成

#### 予約データマッピング（Task 5-6）
- [x] Task 5: src/conversation/reservationMapper.ts 作成
- [x] Task 6: src/conversation/reservationMapper.test.ts 作成

#### GCP セットアップ（Ops Task A-C）
- [x] Ops Task A: Google Sheets / Drive API 有効化 & サービスアカウント権限確認
- [x] Ops Task B: サービスアカウント鍵作成・`GOOGLE_SA_KEY` を `.env.local` へ安全保存
- [x] Ops Task C: スプレッドシート格納フォルダID（`GOOGLE_SHEET_PARENT_FOLDER_ID`）設定 & ダウンロード鍵のサニタイズ

#### シートプロビジョニング（Task 7-9）
- [x] Task 7: src/google/sheetsProvisioner.ts 作成
- [x] Task 8: src/google/sheetsProvisioner.test.ts 作成
- [x] Task 9: scripts/create-customer-sheet.ts 作成

#### 顧客管理（Task 10-11）
- [x] Task 10: ops/customers/customers.json 作成（顧客IDとシートIDの対応管理）
- [x] Task 11: ops/customers/provision-customers.ts 作成（顧客一括生成・ID追記）

#### テストスクリプト（Task 10-11）
- [x] Task 12: scripts/test-sheets-write.ts 作成
- [x] Task 13: scripts/test-sheets-read.ts 作成

#### 統合テスト（Task 12）
- [x] Task 14: tests/integration/sheets-api.test.ts 作成

#### ドキュメント（Task 13-15）
- [x] Task 15: README.md 更新
- [x] Task 16: docs/howto/google-sheets-setup.md 作成
- [x] Task 17: docs/notes/phase2.md 作成

### フェーズ完了条件
- [x] 全17タスクが `done` ステータスに到達
- [x] `npm test` が成功
- [x] `npm exec tsx implementation/scripts/create-customer-sheet.ts -- --name Sample --customer-id sample` が成功（シート自動生成）
- [x] `npm exec tsx implementation/scripts/test-sheets-write.ts` が成功（実Sheets書き込み）
- [x] `npm exec tsx implementation/scripts/test-sheets-read.ts` が成功（実Sheets読み込み）
- [x] `npm exec vitest run implementation/tests/integration/sheets-api.test.ts` が成功
- [x] `docs/notes/phase2.md` が作成され、共有済み
- [ ] 全PRがレビュー承認済み・マージ済み

---

## 1. フェーズ目的と完了条件

### 目的
Google Sheets API へ予約データを書き込み、既存予約を読み取る機能を実装する。レート制限対応、指数バックオフ、429エラー処理を確認する。

### 完了条件
1. 固定予約データをSheets APIで書き込み・読み込みが成功
2. 429エラー発生時に指数バックオフでリトライする
3. `npm exec vitest run` が成功（Sheets APIモックテスト + 実API統合テスト）
4. `docs/notes/phase2.md` にフェーズ完了報告が記録されている

## 2. 技術仕様

### 使用ツール・ライブラリ
- **Google SDK**: googleapis
- **認証**: google-auth-library（サービスアカウント）
- **リトライ**: p-retry（Phase1から継続使用）
- **テスト**: vitest（Phase1から継続使用）

### Google Sheets API 制約
- **レート制限**:
  - 300 read req/min/project
  - 500 write req/100s/project
  - 60 req/min/user/project
- **エラー処理**: 429エラー時は指数バックオフ必須（最大3回リトライ）
- **クォータリフィル**: 毎分自動

### 予約データスキーマ（constraints.yaml参照）
```typescript
interface Reservation {
  timestamp_iso: string;      // ISO8601 (UTC)
  caller_number: string;      // E.164形式
  transcript_log?: string;    // オプション
  reservation_date: string;   // YYYY-MM-DD
  reservation_time: string;   // HH:MM
  party_size: number;
  customer_name: string;
  contact_number: string;
  special_request?: string;   // オプション
  status: 'accepted' | 'pending' | 'manual';
}
```

## 3. タスク依存関係

```text
Phase1完了
  ↓
Task 1 (google/auth.ts) ← Phase1
  ↓
Task 2 (google/auth.test.ts) ← Task 1
  ↓
Task 3 (google/sheets.ts) ← Task 1
  ↓
Task 4 (google/sheets.test.ts) ← Task 3
  ↓
Task 5 (conversation/reservationMapper.ts) ← なし
  ↓
Task 6 (conversation/reservationMapper.test.ts) ← Task 5
  ↓
Task 7 (google/sheetsProvisioner.ts) ← Task 3, Ops Task C
  ↓
Task 8 (google/sheetsProvisioner.test.ts) ← Task 7
  ↓
Task 9 (scripts/create-customer-sheet.ts) ← Task 7
  ↓
Task 10 (scripts/test-sheets-write.ts) ← Task 3, Task 5, Task 7
  ↓
Task 11 (scripts/test-sheets-read.ts) ← Task 3, Task 7
  ↓
Task 12 (tests/integration/sheets-api.test.ts) ← Task 3, Task 5, Task 7
  ↓
Task 13 (README.md更新) ← Task 10, Task 11
  ↓
Task 14 (docs/howto/google-sheets-setup.md) ← Task 1, Task 7
  ↓
Task 15 (docs/notes/phase2.md) ← Task 12
```

## 4. タスク詳細

### Ops Task A: Google Sheets / Drive API 有効化 & 権限確認

**前提タスク**: なし  
**対象**: GCP プロジェクト `i-academy-476206-t0`  
**作業内容**:
- Google Cloud コンソールで対象プロジェクトを選択
- `API とサービス > ライブラリ` から Google Sheets API / Google Drive API を有効化
- IAM ロールに `roles/iam.serviceAccountKeyAdmin` 等、必要権限が付与されていることを確認

**完了条件**:
- 両 API が有効化確認済み
- サービスアカウント操作に必要な IAM 権限が揃っている

---

### Ops Task B: サービスアカウント鍵作成・環境ファイルへの格納

**前提タスク**: Ops Task A  
**対象ファイル**: `implementation/.env.local`  
**作業内容**:
- gcloud CLI でサービスアカウント鍵を有効化（`gcloud iam service-accounts keys enable`）
- 取得した JSON を 1 行化し、`GOOGLE_SA_KEY` として `.env.local` に保存
- 同時に Secret Manager 登録を想定し、鍵ファイルをローカルから削除

**完了条件**:
- `implementation/.env.local` に `GOOGLE_SA_KEY` が設定済み
- ダウンロードフォルダ等に鍵が残存していない

---

### Ops Task C: スプレッドシート保存先フォルダID設定

**前提タスク**: Ops Task B  
**対象ファイル**: `implementation/.env.local`  
**作業内容**:
- Google Drive 上で保存先フォルダ（`1v2M_XZKEKhczHzJ17KK9S2K9VAsY8QeT`）を決定
- `.env.local` の `GOOGLE_SHEET_PARENT_FOLDER_ID` にフォルダ ID を設定
- 既存シート ID (`GOOGLE_SHEET_ID`) は暫定で空にしておき、プロビジョニング後に設定する方針を共有
- 将来の自動シート生成で利用するため、フォルダ共有設定（サービスアカウントへのアクセス）を確認

**完了条件**:
- `GOOGLE_SHEET_PARENT_FOLDER_ID` がフォルダ ID で更新済み
- サービスアカウントが当該フォルダへ書き込み可能

---

### Task 1: src/google/auth.ts 作成

**前提タスク**: Phase1完了
**対象ファイル**: `implementation/src/google/auth.ts`
**作業内容**:
Google サービスアカウント認証を実装:
```typescript
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { loadConfig } from '../config';

let authClient: JWT | null = null;

export function getAuthClient(): JWT {
  if (authClient) return authClient;

  const config = loadConfig();

  // 環境変数からサービスアカウントJSONを読み込み
  const credentials = JSON.parse(config.GOOGLE_SA_KEY || '{}');

  authClient = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return authClient;
}

export function getSheetsClient() {
  const auth = getAuthClient();
  return google.sheets({ version: 'v4', auth });
}
```

**完了条件**:
- `src/google/auth.ts` が作成されている
- `getAuthClient()` と `getSheetsClient()` がエクスポートされている
- サービスアカウント認証を実装
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

**備考**: `.env.template` に以下を追記:
```text
GOOGLE_SA_KEY=
GOOGLE_SHEET_PARENT_FOLDER_ID=
GOOGLE_SHEET_ID=
GOOGLE_TEMPLATE_SHEET_ID=
```

---

### Task 2: src/google/auth.test.ts 作成

**前提タスク**: Task 1
**対象ファイル**: `implementation/src/google/auth.test.ts`
**作業内容**:
認証クライアントのテストを実装:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { getAuthClient } from './auth';

describe('getAuthClient', () => {
  it('サービスアカウント認証クライアントを返す', () => {
    vi.stubEnv('GOOGLE_SA_KEY', JSON.stringify({
      client_email: 'test@example.com',
      private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
    }));

    const client = getAuthClient();

    expect(client).toBeDefined();
    expect(client.email).toBe('test@example.com');
  });

  it('GOOGLE_SA_KEYが空の場合はエラー', () => {
    vi.stubEnv('GOOGLE_SA_KEY', '');

    expect(() => getAuthClient()).toThrow();
  });
});
```

**完了条件**:
- `src/google/auth.test.ts` が作成されている
- `npm exec vitest run implementation/src/google/auth.test.ts` が成功
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 3: src/google/sheets.ts 作成

**前提タスク**: Task 1
**対象ファイル**: `implementation/src/google/sheets.ts`
**作業内容**:
Sheets API クライアントを実装:
```typescript
import { getSheetsClient } from './auth';
import { loadConfig } from '../config';
import pRetry from 'p-retry';
import type { Logger } from 'pino';

export interface Reservation {
  timestamp_iso: string;
  caller_number: string;
  transcript_log?: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  customer_name: string;
  contact_number: string;
  special_request?: string;
  status: 'accepted' | 'pending' | 'manual';
}

export class SheetsClient {
  private sheetId: string;

  constructor(private logger: Logger) {
    const config = loadConfig();
    this.sheetId = config.GOOGLE_SHEET_ID;
  }

  async appendReservation(reservation: Reservation): Promise<void> {
    await pRetry(
      async () => {
        const sheets = getSheetsClient();
        const row = [
          reservation.timestamp_iso,
          reservation.caller_number,
          reservation.transcript_log || '',
          reservation.reservation_date,
          reservation.reservation_time,
          reservation.party_size,
          reservation.customer_name,
          reservation.contact_number,
          reservation.special_request || '',
          reservation.status,
        ];

        await sheets.spreadsheets.values.append({
          spreadsheetId: this.sheetId,
          range: 'Sheet1!A:J',
          valueInputOption: 'RAW',
          requestBody: {
            values: [row],
          },
        });

        this.logger.info({ reservation_date: reservation.reservation_date }, 'Reservation appended');
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 5000,
        onFailedAttempt: (error) => {
          this.logger.warn({ attempt: error.attemptNumber, retriesLeft: error.retriesLeft }, 'Sheets API retry');
        },
      }
    );
  }

  async listReservations(range: string = 'Sheet1!A:J'): Promise<Reservation[]> {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range,
    });

    const rows = response.data.values || [];
    return rows.slice(1).map((row) => ({
      timestamp_iso: row[0],
      caller_number: row[1],
      transcript_log: row[2] || undefined,
      reservation_date: row[3],
      reservation_time: row[4],
      party_size: parseInt(row[5], 10),
      customer_name: row[6],
      contact_number: row[7],
      special_request: row[8] || undefined,
      status: row[9] as 'accepted' | 'pending' | 'manual',
    }));
  }

  async findAvailability(date: string, time: string): Promise<number> {
    const reservations = await this.listReservations();
    const count = reservations.filter(
      (r) => r.reservation_date === date && r.reservation_time === time
    ).length;

    return count;
  }
}
```

**完了条件**:
- `src/google/sheets.ts` が作成されている
- `SheetsClient` クラスが実装されている
- `appendReservation`, `listReservations`, `findAvailability` メソッドが実装
- `p-retry` による指数バックオフ実装
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 4: src/google/sheets.test.ts 作成

**前提タスク**: Task 3
**対象ファイル**: `implementation/src/google/sheets.test.ts`
**作業内容**:
SheetsClient のモックテストを実装:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SheetsClient } from './sheets';
import { createLogger } from '../logger';

vi.mock('./auth', () => ({
  getSheetsClient: vi.fn(() => ({
    spreadsheets: {
      values: {
        append: vi.fn().mockResolvedValue({}),
        get: vi.fn().mockResolvedValue({
          data: {
            values: [
              ['timestamp', 'caller', 'transcript', 'date', 'time', 'party_size', 'name', 'contact', 'request', 'status'],
              ['2025-01-24T10:00:00Z', '+819012345678', '', '2025-01-25', '18:00', '4', '田中', '+819012345678', '', 'accepted'],
            ],
          },
        }),
      },
    },
  })),
}));

describe('SheetsClient', () => {
  let client: SheetsClient;

  beforeEach(() => {
    vi.stubEnv('GOOGLE_SHEET_ID', 'test-sheet-id');
    client = new SheetsClient(createLogger('test'));
  });

  it('appendReservation()で予約を追加', async () => {
    const reservation = {
      timestamp_iso: '2025-01-24T10:00:00Z',
      caller_number: '+819012345678',
      reservation_date: '2025-01-25',
      reservation_time: '18:00',
      party_size: 4,
      customer_name: '田中',
      contact_number: '+819012345678',
      status: 'accepted' as const,
    };

    await expect(client.appendReservation(reservation)).resolves.not.toThrow();
  });

  it('listReservations()で予約リストを取得', async () => {
    const reservations = await client.listReservations();

    expect(reservations).toHaveLength(1);
    expect(reservations[0].customer_name).toBe('田中');
  });

  it('findAvailability()で同時刻の予約数を取得', async () => {
    const count = await client.findAvailability('2025-01-25', '18:00');

    expect(count).toBe(1);
  });
});
```

**完了条件**:
- `src/google/sheets.test.ts` が作成されている
- `npm exec vitest run implementation/src/google/sheets.test.ts` が成功
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 5: src/conversation/reservationMapper.ts 作成

**前提タスク**: なし
**対象ファイル**: `implementation/src/conversation/reservationMapper.ts`
**作業内容**:
予約データの変換ロジックを実装:
```typescript
import type { Reservation } from '../google/sheets';

export interface RawReservationData {
  date?: string;
  time?: string;
  party_size?: number;
  customer_name?: string;
  contact_number?: string;
  special_request?: string;
}

export interface MappingResult {
  success: boolean;
  reservation?: Reservation;
  missingFields?: string[];
}

export function mapToReservation(
  raw: RawReservationData,
  callerNumber: string
): MappingResult {
  const missingFields: string[] = [];

  if (!raw.date) missingFields.push('date');
  if (!raw.time) missingFields.push('time');
  if (!raw.party_size) missingFields.push('party_size');
  if (!raw.customer_name) missingFields.push('customer_name');
  if (!raw.contact_number) missingFields.push('contact_number');

  if (missingFields.length > 0) {
    return { success: false, missingFields };
  }

  const reservation: Reservation = {
    timestamp_iso: new Date().toISOString(),
    caller_number: callerNumber,
    reservation_date: raw.date!,
    reservation_time: raw.time!,
    party_size: raw.party_size!,
    customer_name: raw.customer_name!,
    contact_number: raw.contact_number!,
    special_request: raw.special_request,
    status: 'accepted',
  };

  return { success: true, reservation };
}
```

**完了条件**:
- `src/conversation/reservationMapper.ts` が作成されている
- `mapToReservation()` 関数が実装されている
- 不足フィールドを検出する
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 6: src/conversation/reservationMapper.test.ts 作成

**前提タスク**: Task 5
**対象ファイル**: `implementation/src/conversation/reservationMapper.test.ts`
**作業内容**:
マッピングロジックのテストを実装:
```typescript
import { describe, it, expect } from 'vitest';
import { mapToReservation } from './reservationMapper';

describe('mapToReservation', () => {
  it('全フィールドが揃っている場合は成功', () => {
    const result = mapToReservation(
      {
        date: '2025-01-25',
        time: '18:00',
        party_size: 4,
        customer_name: '田中',
        contact_number: '+819012345678',
        special_request: '窓際希望',
      },
      '+819012345678'
    );

    expect(result.success).toBe(true);
    expect(result.reservation?.customer_name).toBe('田中');
  });

  it('必須フィールドが欠けている場合は失敗', () => {
    const result = mapToReservation(
      {
        date: '2025-01-25',
        // timeが欠けている
        party_size: 4,
        customer_name: '田中',
        contact_number: '+819012345678',
      },
      '+819012345678'
    );

    expect(result.success).toBe(false);
    expect(result.missingFields).toContain('time');
  });
});
```

**完了条件**:
- `src/conversation/reservationMapper.test.ts` が作成されている
- `npm exec vitest run implementation/src/conversation/reservationMapper.test.ts` が成功
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 7: src/google/sheetsProvisioner.ts 作成

**前提タスク**: Task 3, Ops Task C  
**対象ファイル**: `implementation/src/google/sheetsProvisioner.ts`  
**作業内容**:  
- Drive API / Sheets API を用いて新規スプレッドシートを自動作成するクラスを実装
- `config.ts` を拡張し、`GOOGLE_SHEET_PARENT_FOLDER_ID` と（必要なら）`GOOGLE_TEMPLATE_SHEET_ID` を読み込む
- `auth.ts` に Drive クライアント (`getDriveClient`) を追加し、サービスアカウント認証を再利用:
```typescript
import { drive_v3, sheets_v4 } from 'googleapis';
import { getSheetsClient, getDriveClient } from './auth';

type ProvisionerOptions = {
  parentFolderId?: string;
  templateSheetId?: string;
  drive?: drive_v3.Drive;
  sheets?: sheets_v4.Sheets;
};

export class SheetsProvisioner {
  constructor(private readonly options: ProvisionerOptions = {}) {}

  private get drive(): drive_v3.Drive {
    return this.options.drive ?? getDriveClient();
  }

  private get sheets(): sheets_v4.Sheets {
    return this.options.sheets ?? getSheetsClient();
  }

  async createSpreadsheet(name: string): Promise<{ spreadsheetId: string; url: string }> {
    if (this.options.templateSheetId) {
      const response = await this.drive.files.copy({
        fileId: this.options.templateSheetId,
        requestBody: {
          name,
          parents: this.options.parentFolderId ? [this.options.parentFolderId] : undefined,
        },
        fields: 'id, webViewLink',
      });
      return { spreadsheetId: response.data.id!, url: response.data.webViewLink! };
    }

    const response = await this.sheets.spreadsheets.create({
      requestBody: {
        properties: { title: name },
      },
    });

    if (this.options.parentFolderId && response.data.spreadsheetId) {
      await this.drive.files.update({
        fileId: response.data.spreadsheetId,
        addParents: this.options.parentFolderId,
        fields: 'id',
      });
    }

    return {
      spreadsheetId: response.data.spreadsheetId!,
      url: response.data.spreadsheetUrl!,
    };
  }
}
```

**完了条件**:
- `src/google/sheetsProvisioner.ts` が作成されている
- フォルダ ID / テンプレート ID を指定して新規シートを生成できる
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 8: src/google/sheetsProvisioner.test.ts 作成

**前提タスク**: Task 7  
**対象ファイル**: `implementation/src/google/sheetsProvisioner.test.ts`  
**作業内容**:  
`googleapis` をモックし、以下のケースを検証:
- テンプレート ID なし → `spreadsheets.create` が呼ばれ、`files.update` でフォルダへ移動
- テンプレート ID あり → `drive.files.copy` により複製される
- 返却値に `spreadsheetId` と `url` が含まれる

**完了条件**:
- `src/google/sheetsProvisioner.test.ts` が作成されている
- `npm exec vitest run implementation/src/google/sheetsProvisioner.test.ts` が成功
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 9: scripts/create-customer-sheet.ts 作成

**前提タスク**: Task 7  
**対象ファイル**: `implementation/scripts/create-customer-sheet.ts`  
**作業内容**:  
CLI から顧客 ID / 表示名 / 共有先メールアドレスを受け取り、スプレッドシートを生成して共有するスクリプトを実装:
```typescript
#!/usr/bin/env tsx
import { Command } from 'commander';
import { createLogger } from '../src/logger';
import { SheetsProvisioner } from '../src/google/sheetsProvisioner';
import { getDriveClient } from '../src/google/auth';
import { loadConfig } from '../src/config';

const program = new Command();
program
  .requiredOption('--name <name>', 'Spreadsheet display name')
  .requiredOption('--customer-id <id>', 'Unique customer identifier')
  .option('--share <email...>', 'Emails to grant edit access');
program.parse();

const options = program.opts<{
  name: string;
  customerId: string;
  share?: string[];
}>();

const logger = createLogger('create-customer-sheet');
const config = loadConfig();

async function main() {
    const provisioner = new SheetsProvisioner({
      parentFolderId: config.GOOGLE_SHEET_PARENT_FOLDER_ID,
      templateSheetId: config.GOOGLE_TEMPLATE_SHEET_ID,
    });
    const { spreadsheetId, url } = await provisioner.createSpreadsheet(options.name);

    if (options.share?.length) {
      const drive = getDriveClient();
      await Promise.all(
        options.share.map((email) =>
          drive.permissions.create({
            fileId: spreadsheetId,
            sendNotificationEmail: false,
            requestBody: {
              emailAddress: email,
              role: 'writer',
              type: 'user',
            },
          })
        )
      );
    }

    logger.info({ customerId: options.customerId, spreadsheetId, url }, 'Sheet provisioned');
    console.log(JSON.stringify({ customerId: options.customerId, spreadsheetId, url }, null, 2));
}

void main().catch((error) => {
  logger.error({ err: error }, 'Failed to provision sheet');
  process.exit(1);
});
```

**完了条件**:
- `scripts/create-customer-sheet.ts` が作成されている
- CLI 経由でシート生成と共有が行える
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 10: ops/customers/customers.json 作成

**前提タスク**: Task 9  
**対象ファイル**: `implementation/ops/customers/customers.json`  
**作業内容**:
- 顧客IDと生成済みスプレッドシートIDを管理するJSONファイルを作成
- フォーマット例:
```json
[
  {
    "customerId": "store-a",
    "spreadsheetId": "1abc...",
    "url": "https://docs.google.com/spreadsheets/d/1abc..."
  }
]
```
- 生成スクリプトがこのファイルを追記更新できるようにする

**完了条件**:
- `implementation/ops/customers/customers.json` が作成されている
- JSON構造が上記フォーマットで初期化されている（空配列で可）
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 11: ops/customers/provision-customers.ts 作成

**前提タスク**: Task 9, Task 10  
**対象ファイル**: `implementation/ops/customers/provision-customers.ts`  
**作業内容**:
- `customers.json` を読み込み、未登録の顧客に対して `create-customer-sheet.ts` 相当の処理を行い、生成結果を追記
- CLI オプションで `--share` メールを受け付け、共有設定を自動化
- 既存エントリに対してはスキップするロジックを実装

**完了条件**:
- `provision-customers.ts` が作成されている
- 指定した顧客リストに対し、シート生成と `customers.json` 更新がワンコマンドで実行できる
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---



### Task 12: scripts/test-sheets-write.ts 作成

**前提タスク**: Task 3, Task 5, Task 7, Task 10
**対象ファイル**: `implementation/scripts/test-sheets-write.ts`
**作業内容**:
- `--sheet-id` または `--customer-id` オプションで書き込み先シートを指定
- `customers.json` から自動的にシートIDを解決するロジックを追加
- 予約データを1件書き込み、結果をログ出力

**完了条件**:
- CLI 実行がオプション経由でシートIDを解決し、書き込みが成功する
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 13: scripts/test-sheets-read.ts 作成

**前提タスク**: Task 3, Task 7, Task 10
**対象ファイル**: `implementation/scripts/test-sheets-read.ts`
**作業内容**:
- `--sheet-id` / `--customer-id` オプションでシートIDを解決
- 予約データを取得し、件数と内容をログ・標準出力へ表示

**完了条件**:
- CLI 実行で対象シートのデータが取得できる
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 14: docs/howto/google-sheets-setup.md 作成

**前提タスク**: Task 1, Task 7
**対象ファイル**: `implementation/docs/howto/google-sheets-setup.md`
**作業内容**:
Google Sheets セットアップガイドを作成:
```markdown
# Google Sheets API セットアップガイド

## 1. Google Cloud プロジェクト作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新規プロジェクト作成: `restaurant-voice-ai-dev`

## 2. Sheets API 有効化

1. 「APIとサービス」→「ライブラリ」
2. 「Google Sheets API」を検索
3. 「有効にする」をクリック

## 3. サービスアカウント作成

1. 「APIとサービス」→「認証情報」
2. 「認証情報を作成」→「サービスアカウント」
3. サービスアカウント名: `restaurant-voice-ai-sa`
4. 役割: なし（Sheetsレベルで権限付与）
5. 「完了」をクリック

## 4. JSON鍵ダウンロード

1. 作成したサービスアカウントをクリック
2. 「キー」タブ →「鍵を追加」→「JSON」
3. ダウンロードしたJSONファイルを安全な場所に保存

## 5. スプレッドシート作成

1. [Google Sheets](https://sheets.google.com/) で新規スプレッドシート作成
2. シート名: `Restaurant Reservations`
3. 1行目にヘッダー追加:
   ```
   timestamp_iso | caller_number | transcript_log | reservation_date | reservation_time | party_size | customer_name | contact_number | special_request | status
   ```text

## 6. スプレッドシート共有

1. スプレッドシート右上の「共有」をクリック
2. サービスアカウントのメールアドレス（`xxx@xxx.iam.gserviceaccount.com`）を入力
3. 権限: 「編集者」
4. 「送信」をクリック

## 7. 環境変数設定

```bash
# .env に追記
GOOGLE_SA_KEY='<JSON鍵の内容を1行に>'
GOOGLE_SHEET_PARENT_FOLDER_ID='<Drive フォルダ ID>'
# 既存シートを手動で用意する場合のみ設定
GOOGLE_SHEET_ID='<スプレッドシートのID（URLから取得）>'
```

**スプレッドシート/フォルダ ID の取得方法**:
- シート: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit` の `{SHEET_ID}` をコピー
- フォルダ: `https://drive.google.com/drive/folders/{FOLDER_ID}` の `{FOLDER_ID}` をコピー

## トラブルシューティング

### 403 Forbidden エラー

- スプレッドシートがサービスアカウントと共有されているか確認
- 権限が「編集者」になっているか確認

### 自動プロビジョニング

- `scripts/create-customer-sheet.ts` を実行すると、フォルダ内にテンプレートなしシートが作成され共有設定が自動化されます
- 生成結果の `spreadsheetId` を `.env.local` の `GOOGLE_SHEET_ID` に転記するか、アプリケーション設定ストアに保存してください
```

**完了条件**:
- `docs/howto/google-sheets-setup.md` が作成されている
- セットアップ手順が詳細に記載されている
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

### Task 15: docs/notes/phase2.md 作成

**前提タスク**: Task 12
**対象ファイル**: `implementation/docs/notes/phase2.md`
**作業内容**:
Phase2 完了報告を作成:
```markdown
# Phase 2 完了報告

**完了日**: YYYY-MM-DD
**担当**: Codex (開発)、GitHub操作エージェント、レビューAI

## 実施内容

- Google サービスアカウント認証実装
- Sheets API クライアント実装（書き込み・読み込み・空席確認）
- 指数バックオフによるリトライロジック実装
- 予約データマッピングロジック実装
- 手動テストスクリプト作成
- 統合テスト（実Sheets API）実装

## テスト結果

- ユニットテスト: ✅ 6/6 成功
- 統合テスト: ✅ 2/2 成功（実Sheets API）
- 手動テスト: ✅ 書き込み・読み込み成功

## レート制限テスト結果

- 429エラー発生時: ✅ 3回リトライで成功
- バックオフ時間: 1s → 2s → 4s

## 未決課題

- なし

## 次フェーズへのTODO

- Phase3: Twilio統合（音声会話 + Sheets連携）
- Phase1とPhase2を統合し、会話終了時にSheets書き込み
```

**完了条件**:
- `docs/notes/phase2.md` が作成されている
- 実施内容・テスト結果・課題が記載されている
- state.md が `done` に更新

**state.md遷移**: coding → pr_preparation → review → integration → done

---

## 5. フェーズ完了チェックリスト

- [ ] 全12タスクが `done` ステータスに到達
- [ ] `npm test` が成功
- [ ] `npm exec tsx implementation/scripts/create-customer-sheet.ts -- --name Sample --customer-id sample` が成功（シート自動生成）
- [ ] `npm exec tsx implementation/scripts/test-sheets-write.ts` が成功（実Sheets書き込み）
- [ ] `npm exec tsx implementation/scripts/test-sheets-read.ts` が成功（実Sheets読み込み）
- [ ] `npm exec vitest run implementation/tests/integration/sheets-api.test.ts` が成功
- [ ] `docs/notes/phase2.md` が作成され、Slack #restaurant-voice-ai-dev に共有
- [ ] 全PRがレビュー承認済み・マージ済み

---

**次フェーズ**: Phase3 (Twilio統合 + Phase1/Phase2統合) へ進む
