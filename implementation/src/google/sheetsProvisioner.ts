import type { drive_v3, sheets_v4 } from 'googleapis';
import { getDriveClient, getSheetsClient } from './auth';

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
        supportsAllDrives: true,
        fields: 'id, webViewLink',
      });
      if (!response.data.id || !response.data.webViewLink) {
        throw new Error('Failed to copy template spreadsheet');
      }
      return { spreadsheetId: response.data.id, url: response.data.webViewLink };
    }

    const response = await this.drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.spreadsheet',
        parents: this.options.parentFolderId ? [this.options.parentFolderId] : undefined,
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });

    if (!response.data.id || !response.data.webViewLink) {
      throw new Error('Failed to create spreadsheet');
    }

    await this.ensureHeaderRow(response.data.id);

    return {
      spreadsheetId: response.data.id,
      url: response.data.webViewLink,
    };
  }

  private async ensureHeaderRow(spreadsheetId: string): Promise<void> {
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
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1:J1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [headerRow],
      },
    });
  }
}
