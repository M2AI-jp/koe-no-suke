import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestLogger, stubOpenAIApiKey } from '../helpers/testLogger';
import type { Reservation } from '../../src/google/sheets';

type AppendParams = {
  requestBody?: {
    values?: Array<Array<string | number | undefined>>;
  };
};

const headerRow = [
  'timestamp_iso',
  'caller_number',
  'transcript_log',
  'reservation_date',
  'reservation_time',
  'party_size',
  'customer_name',
  'contact_number',
  'special_request',
  'status',
] as const;

let sheetRows: Array<Array<string | number | undefined>>;

const appendMock = vi.fn(async ({ requestBody }: AppendParams) => {
  const values = requestBody?.values ?? [];
  values.forEach((row) => {
    sheetRows.push([...row]);
  });
  return {};
});

const getMock = vi.fn(async () => ({
  data: {
    values: sheetRows,
  },
}));

const getSheetsClientMock = vi.fn(() => ({
  spreadsheets: {
    values: {
      append: appendMock,
      get: getMock,
    },
  },
}));

vi.mock('../../src/google/auth', () => ({
  getSheetsClient: () => getSheetsClientMock(),
}));

describe('Sheets API integration', () => {
  beforeEach(() => {
    sheetRows = [Array.from(headerRow)];
    appendMock.mockClear();
    getMock.mockClear();
    getSheetsClientMock.mockClear();
    getSheetsClientMock.mockReturnValue({
      spreadsheets: {
        values: {
          append: appendMock,
          get: getMock,
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it(
    '予約データを書き込み・読み込みして空き状況を取得できる',
    async () => {
      stubOpenAIApiKey('integration-test-key');

      const { SheetsClient } = await import('../../src/google/sheets');
      const { mapToReservation } = await import('../../src/conversation/reservationMapper');

      const logger = await createTestLogger('sheets-integration');
      const client = new SheetsClient(logger, 'integration-sheet');

      const rawInput = {
        date: '2025-03-01',
        time: '19:30',
        party_size: 2,
        customer_name: 'テスト次郎',
        contact_number: '+819012345678',
        special_request: 'テスト席希望',
      };

      const mapping = mapToReservation(rawInput, rawInput.contact_number);
      expect(mapping.success).toBe(true);

      const reservation = mapping.reservation as Reservation;

      await client.appendReservation(reservation);

      expect(appendMock).toHaveBeenCalledTimes(1);
      expect(sheetRows).toHaveLength(2);

      const reservations = await client.listReservations();
      expect(getMock).toHaveBeenCalled();
      expect(reservations).toHaveLength(1);
      expect(reservations[0]).toMatchObject({
        reservation_date: rawInput.date,
        reservation_time: rawInput.time,
        party_size: rawInput.party_size,
        customer_name: rawInput.customer_name,
        contact_number: rawInput.contact_number,
        status: 'accepted',
      });

      const availability = await client.findAvailability(rawInput.date, rawInput.time);
      expect(availability).toBe(1);
    },
    10_000
  );
});
