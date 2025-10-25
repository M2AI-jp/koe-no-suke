import pRetry from 'p-retry';
import type { Logger } from 'pino';
import { loadConfig } from '../config';
import { getSheetsClient } from './auth';

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
  private readonly sheetId: string;

  constructor(private readonly logger: Logger, sheetId?: string) {
    const config = loadConfig();
    const resolvedSheetId = sheetId ?? config.GOOGLE_SHEET_ID;
    if (!resolvedSheetId) {
      throw new Error('GOOGLE_SHEET_ID is not set');
    }
    this.sheetId = resolvedSheetId;
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

        this.logger.info(
          { reservation_date: reservation.reservation_date, reservation_time: reservation.reservation_time },
          'Reservation appended'
        );
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 5000,
        onFailedAttempt: (error) => {
          this.logger.warn(
            {
              attempt: error.attemptNumber,
              retriesLeft: error.retriesLeft,
              message: error.message,
            },
            'Sheets API retry'
          );
        },
      }
    );
  }

  async listReservations(range = 'Sheet1!A:J'): Promise<Reservation[]> {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return [];
    }

    return rows.slice(1).map((row) => ({
      timestamp_iso: row[0],
      caller_number: row[1],
      transcript_log: row[2] || undefined,
      reservation_date: row[3],
      reservation_time: row[4],
      party_size: Number.parseInt(row[5], 10),
      customer_name: row[6],
      contact_number: row[7],
      special_request: row[8] || undefined,
      status: row[9] as 'accepted' | 'pending' | 'manual',
    }));
  }

  async findAvailability(date: string, time: string): Promise<number> {
    const reservations = await this.listReservations();
    return reservations.filter(
      (r) => r.reservation_date === date && r.reservation_time === time
    ).length;
  }
}
