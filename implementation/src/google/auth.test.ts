import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../config';

const sheetsMock = vi.fn();
const driveMock = vi.fn();
const jwtConstructorMock = vi.fn();

vi.mock('googleapis', () => ({
  google: {
    sheets: sheetsMock,
    drive: driveMock,
  },
}));

vi.mock('google-auth-library', () => ({
  JWT: vi.fn().mockImplementation((options) => {
    jwtConstructorMock(options);
    return { options };
  }),
}));

const loadConfigMock = vi.fn<[], Config>();

vi.mock('../config', () => ({
  loadConfig: loadConfigMock,
}));

const { getAuthClient, getSheetsClient, getDriveClient, __resetAuthClientForTests } = await import('./auth');

const baseConfig: Config = {
  OPENAI_API_KEY: 'openai-key',
  OPENAI_REALTIME_MODEL: 'model',
  AUDIO_SAMPLE_RATE: 16000,
  LOG_LEVEL: 'info',
  GOOGLE_SA_KEY: undefined,
};

const createServiceAccountKey = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    client_email: 'service@example.com',
    private_key: '-----BEGIN PRIVATE KEY-----\\nline1\\nline2\\n-----END PRIVATE KEY-----\\n',
    ...overrides,
  });

beforeEach(() => {
  jwtConstructorMock.mockClear();
  sheetsMock.mockClear();
  driveMock.mockClear();
  loadConfigMock.mockReset();
  __resetAuthClientForTests();
});

describe('getAuthClient', () => {
  it('サービスアカウントキーをパースしてJWTクライアントを生成', () => {
    loadConfigMock.mockReturnValue({
      ...baseConfig,
      GOOGLE_SA_KEY: createServiceAccountKey(),
    });

    const authClient = getAuthClient();

    expect(jwtConstructorMock).toHaveBeenCalledTimes(1);
    expect(jwtConstructorMock).toHaveBeenCalledWith({
      email: 'service@example.com',
      key: '-----BEGIN PRIVATE KEY-----\nline1\nline2\n-----END PRIVATE KEY-----\n',
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
      ],
    });

    const cachedClient = getAuthClient();
    expect(cachedClient).toBe(authClient);
    expect(jwtConstructorMock).toHaveBeenCalledTimes(1);
  });

  it('GOOGLE_SA_KEY が未設定の場合はエラー', () => {
    loadConfigMock.mockReturnValue({
      ...baseConfig,
      GOOGLE_SA_KEY: undefined,
    });

    expect(() => getAuthClient()).toThrowError('GOOGLE_SA_KEY is not set');
  });

  it('GOOGLE_SA_KEY が不正なJSONの場合はエラー', () => {
    loadConfigMock.mockReturnValue({
      ...baseConfig,
      GOOGLE_SA_KEY: 'not-json',
    });

    expect(() => getAuthClient()).toThrowError('GOOGLE_SA_KEY is not valid JSON');
  });

  it('必要なフィールドが欠けている場合はエラー', () => {
    loadConfigMock.mockReturnValue({
      ...baseConfig,
      GOOGLE_SA_KEY: createServiceAccountKey({ client_email: undefined }),
    });

    expect(() => getAuthClient()).toThrowError('GOOGLE_SA_KEY is missing required fields');
  });
});

describe('getSheetsClient', () => {
  it('認証クライアントを使ってSheetsクライアントを生成', () => {
    const sheetsClient = { spreadsheets: {} };
    sheetsMock.mockReturnValueOnce(sheetsClient);

    loadConfigMock.mockReturnValue({
      ...baseConfig,
      GOOGLE_SA_KEY: createServiceAccountKey(),
    });

    const result = getSheetsClient();

    expect(result).toBe(sheetsClient);
    expect(sheetsMock).toHaveBeenCalledWith({
      version: 'v4',
      auth: expect.any(Object),
    });
  });
});

describe('getDriveClient', () => {
  it('認証クライアントを使ってDriveクライアントを生成', () => {
    const driveClient = { files: {} };
    driveMock.mockReturnValueOnce(driveClient);

    loadConfigMock.mockReturnValue({
      ...baseConfig,
      GOOGLE_SA_KEY: createServiceAccountKey(),
    });

    const result = getDriveClient();

    expect(result).toBe(driveClient);
    expect(driveMock).toHaveBeenCalledWith({
      version: 'v3',
      auth: expect.any(Object),
    });
  });
});
