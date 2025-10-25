import { google, type drive_v3, type sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';
import { loadConfig } from '../config';

type ServiceAccountKey = {
  client_email?: string;
  private_key?: string;
};

let authClient: JWT | null = null;

function parseServiceAccountKey(rawKey: string | undefined): ServiceAccountKey {
  if (!rawKey) {
    throw new Error('GOOGLE_SA_KEY is not set');
  }

  let parsed: ServiceAccountKey;
  try {
    parsed = JSON.parse(rawKey);
  } catch (error) {
    throw new Error('GOOGLE_SA_KEY is not valid JSON');
  }

  return parsed;
}

function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, '\n');
}

export function getAuthClient(): JWT {
  if (authClient) {
    return authClient;
  }

  const config = loadConfig();
  const credentials = parseServiceAccountKey(config.GOOGLE_SA_KEY);

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('GOOGLE_SA_KEY is missing required fields');
  }

  authClient = new JWT({
    email: credentials.client_email,
    key: normalizePrivateKey(credentials.private_key),
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });

  return authClient;
}

export function getSheetsClient(): sheets_v4.Sheets {
  const auth = getAuthClient();
  return google.sheets({ version: 'v4', auth });
}

export function getDriveClient(): drive_v3.Drive {
  const auth = getAuthClient();
  return google.drive({ version: 'v3', auth });
}

export function __resetAuthClientForTests(): void {
  authClient = null;
}
