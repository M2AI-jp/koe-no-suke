import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { drive_v3 } from 'googleapis';

vi.mock('./auth', () => ({
  getDriveClient: vi.fn(),
  getSheetsClient: vi.fn(),
}));

const { getDriveClient, getSheetsClient } = vi.mocked(await import('./auth'));
const { SheetsProvisioner } = await import('./sheetsProvisioner');

beforeEach(() => {
  vi.resetAllMocks();
});

describe('SheetsProvisioner', () => {
  it('テンプレートなしでシートを作成しフォルダに移動', async () => {
    const updateMock = vi.fn().mockResolvedValue({});
    const createMock = vi.fn().mockResolvedValue({
      data: {
        id: 'sheet-123',
        webViewLink: 'https://example.com/sheet-123',
      },
    });

    getDriveClient.mockReturnValue({
      files: {
        create: createMock,
      },
    } as unknown as drive_v3.Drive);
    getSheetsClient.mockReturnValue({
      spreadsheets: {
        values: {
          update: updateMock,
        },
      },
    } as unknown as sheets_v4.Sheets);

    const provisioner = new SheetsProvisioner({ parentFolderId: 'folder-1' });
    const result = await provisioner.createSpreadsheet('New Sheet');

    expect(result).toEqual({
      spreadsheetId: 'sheet-123',
      url: 'https://example.com/sheet-123',
    });
    expect(createMock).toHaveBeenCalledWith({
      requestBody: {
        name: 'New Sheet',
        mimeType: 'application/vnd.google-apps.spreadsheet',
        parents: ['folder-1'],
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith({
      spreadsheetId: 'sheet-123',
      range: 'Sheet1!A1:J1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          [
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
          ],
        ],
      },
    });
  });

  it('テンプレートからシートを複製', async () => {
    const updateMock = vi.fn();
    const copyMock = vi.fn().mockResolvedValue({
      data: {
        id: 'copied-456',
        webViewLink: 'https://example.com/copied-456',
      },
    });

    getDriveClient.mockReturnValue({
      files: {
        copy: copyMock,
      },
    } as unknown as drive_v3.Drive);
    getSheetsClient.mockReturnValue({
      spreadsheets: {
        values: {
          update: updateMock,
        },
      },
    } as unknown as sheets_v4.Sheets);

    const provisioner = new SheetsProvisioner({
      parentFolderId: 'folder-2',
      templateSheetId: 'template-9',
    });

    const result = await provisioner.createSpreadsheet('From Template');

    expect(result).toEqual({
      spreadsheetId: 'copied-456',
      url: 'https://example.com/copied-456',
    });
    expect(copyMock).toHaveBeenCalledWith({
      fileId: 'template-9',
      requestBody: {
        name: 'From Template',
        parents: ['folder-2'],
      },
      supportsAllDrives: true,
      fields: 'id, webViewLink',
    });
    expect(updateMock).not.toHaveBeenCalled();
  });
});
