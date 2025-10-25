import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../config';
import type { Logger } from 'pino';

const loadConfigMock = vi.fn<[], Config>();
const getSheetsClientMock = vi.fn();

vi.mock('../config', () => ({
  loadConfig: loadConfigMock,
}));

vi.mock('./auth', () => ({
  getSheetsClient: () => getSheetsClientMock(),
}));

const { SheetsClient } = await import('./sheets');

const createLoggerStub = (): Logger =>
  ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as Logger);

const baseConfig: Config = {
  OPENAI_API_KEY: 'openai-key',
  OPENAI_REALTIME_MODEL: 'gpt-test',
  AUDIO_SAMPLE_RATE: 16000,
  LOG_LEVEL: 'info',
  GOOGLE_SA_KEY: '{}',
  GOOGLE_SHEET_ID: 'sheet-id',
};

beforeEach(() => {
  loadConfigMock.mockReturnValue(baseConfig);
  getSheetsClientMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('SheetsClient', () => {
  it('appendReservation() で予約情報を追記', async () => {
    const appendMock = vi.fn().mockResolvedValue({});
    getSheetsClientMock.mockReturnValue({
      spreadsheets: {
        values: {
          append: appendMock,
        },
      },
    });

    const logger = createLoggerStub();
    const client = new SheetsClient(logger);
    const reservation = {
      timestamp_iso: '2025-02-23T12:00:00Z',
      caller_number: '+819012345678',
      transcript_log: 'log',
      reservation_date: '2025-02-24',
      reservation_time: '19:00',
      party_size: 4,
      customer_name: '山田太郎',
      contact_number: '+819011122233',
      special_request: 'window seat',
      status: 'accepted' as const,
    };

    await expect(client.appendReservation(reservation)).resolves.not.toThrow();

    expect(appendMock).toHaveBeenCalledTimes(1);
    expect(appendMock).toHaveBeenCalledWith({
      spreadsheetId: 'sheet-id',
      range: 'Sheet1!A:J',
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          [
            reservation.timestamp_iso,
            reservation.caller_number,
            reservation.transcript_log,
            reservation.reservation_date,
            reservation.reservation_time,
            reservation.party_size,
            reservation.customer_name,
            reservation.contact_number,
            reservation.special_request,
            reservation.status,
          ],
        ],
      },
    });
    expect((logger.info as vi.Mock).mock.calls.length).toBeGreaterThan(0);
  });

  it('appendReservation() が失敗した場合にリトライ', async () => {
    const error = Object.assign(new Error('429'), { response: { status: 429 } });
    const appendMock = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({});

    getSheetsClientMock.mockReturnValue({
      spreadsheets: {
        values: {
          append: appendMock,
        },
      },
    });

    const logger = createLoggerStub();
    const client = new SheetsClient(logger);

    await expect(
      client.appendReservation({
        timestamp_iso: '2025-02-23T12:00:00Z',
        caller_number: '+819012345678',
        reservation_date: '2025-02-24',
        reservation_time: '19:00',
        party_size: 2,
        customer_name: '佐藤',
        contact_number: '+819033344455',
        status: 'pending',
      })
    ).resolves.not.toThrow();

    expect(appendMock).toHaveBeenCalledTimes(2);
    expect((logger.warn as vi.Mock).mock.calls.length).toBeGreaterThan(0);
  });

  it('listReservations() でヘッダー行以外をReservation配列に変換', async () => {
    const getMock = vi.fn().mockResolvedValue({
      data: {
        values: [
          ['timestamp_iso', 'caller_number', 'transcript', 'reservation_date', 'reservation_time', 'party_size', 'customer_name', 'contact_number', 'special_request', 'status'],
          ['2025-02-23T12:00:00Z', '+819012345678', '', '2025-02-24', '19:00', '2', '田中', '+819011122233', '', 'accepted'],
          ['2025-02-23T13:00:00Z', '+819011122233', 'call', '2025-02-24', '20:00', '3', '鈴木', '+819022233344', 'allergy', 'pending'],
        ],
      },
    });

    getSheetsClientMock.mockReturnValue({
      spreadsheets: {
        values: {
          get: getMock,
        },
      },
    });

    const logger = createLoggerStub();
    const client = new SheetsClient(logger);

    const reservations = await client.listReservations();

    expect(getMock).toHaveBeenCalledWith({
      spreadsheetId: 'sheet-id',
      range: 'Sheet1!A:J',
    });
    expect(reservations).toEqual([
      {
        timestamp_iso: '2025-02-23T12:00:00Z',
        caller_number: '+819012345678',
        transcript_log: undefined,
        reservation_date: '2025-02-24',
        reservation_time: '19:00',
        party_size: 2,
        customer_name: '田中',
        contact_number: '+819011122233',
        special_request: undefined,
        status: 'accepted',
      },
      {
        timestamp_iso: '2025-02-23T13:00:00Z',
        caller_number: '+819011122233',
        transcript_log: 'call',
        reservation_date: '2025-02-24',
        reservation_time: '20:00',
        party_size: 3,
        customer_name: '鈴木',
        contact_number: '+819022233344',
        special_request: 'allergy',
        status: 'pending',
      },
    ]);
  });

  it('findAvailability() で指定日時の予約数を返す', async () => {
    const logger = createLoggerStub();
    const client = new SheetsClient(logger);
    const listSpy = vi.spyOn(client, 'listReservations').mockResolvedValue([
      {
        timestamp_iso: '2025-02-23T12:00:00Z',
        caller_number: '+8190',
        reservation_date: '2025-02-24',
        reservation_time: '19:00',
        party_size: 2,
        customer_name: '田中',
        contact_number: '+8190',
        status: 'accepted',
      },
      {
        timestamp_iso: '2025-02-23T13:00:00Z',
        caller_number: '+8191',
        reservation_date: '2025-02-24',
        reservation_time: '19:00',
        party_size: 4,
        customer_name: '佐藤',
        contact_number: '+8191',
        status: 'pending',
      },
      {
        timestamp_iso: '2025-02-23T14:00:00Z',
        caller_number: '+8192',
        reservation_date: '2025-02-24',
        reservation_time: '20:00',
        party_size: 3,
        customer_name: '鈴木',
        contact_number: '+8192',
        status: 'manual',
      },
    ]);

    const count = await client.findAvailability('2025-02-24', '19:00');

    expect(count).toBe(2);
    expect(listSpy).toHaveBeenCalledTimes(1);
  });
});
