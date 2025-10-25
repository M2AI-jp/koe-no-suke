import { google } from 'googleapis';
import { loadConfig } from '../../src/config.ts';
import { getAuthClient } from '../../src/google/auth.ts';

async function main() {
  const config = loadConfig();
  if (!config.GOOGLE_SHEET_PARENT_FOLDER_ID) {
    console.error('GOOGLE_SHEET_PARENT_FOLDER_ID not set');
    process.exit(1);
  }
  const drive = google.drive({ version: 'v3', auth: getAuthClient() });
  const res = await drive.files.get({
    fileId: config.GOOGLE_SHEET_PARENT_FOLDER_ID,
    fields: 'id, name, driveId, parents',
    supportsAllDrives: true,
  });
  console.log(res.data);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
