#!/usr/bin/env tsx
import { Command } from 'commander';
import { createLogger } from '../src/logger';
import { loadConfig } from '../src/config';
import { SheetsProvisioner } from '../src/google/sheetsProvisioner';
import { getDriveClient } from '../src/google/auth';

const program = new Command();
program
  .requiredOption('--name <name>', 'Spreadsheet display name')
  .requiredOption('--customer-id <id>', 'Unique customer identifier')
  .option('--share <email...>', 'Emails to grant edit access')
  .option('--parent-folder-id <id>', 'Override parent folder ID (Drive folder or shared drive root)');
program.parse();

const options = program.opts<{
  name: string;
  customerId: string;
  share?: string[];
  parentFolderId?: string;
}>();

const logger = createLogger('create-customer-sheet');
const config = loadConfig();

async function main() {
  const parentFolderId = options.parentFolderId ?? config.GOOGLE_SHEET_PARENT_FOLDER_ID;
  if (!parentFolderId) {
    logger.error('Parent folder ID must be provided via --parent-folder-id or GOOGLE_SHEET_PARENT_FOLDER_ID');
    process.exit(1);
    return;
  }

  const provisioner = new SheetsProvisioner({
    parentFolderId,
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
