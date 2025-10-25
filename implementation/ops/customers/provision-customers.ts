#!/usr/bin/env tsx
import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createLogger } from '../../src/logger';
import { loadConfig } from '../../src/config';
import { SheetsProvisioner } from '../../src/google/sheetsProvisioner';
import { getDriveClient } from '../../src/google/auth';

type CustomerEntry = {
  customerId: string;
  name: string;
  share?: string[];
  spreadsheetId?: string | null;
  url?: string | null;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const customersPath = resolve(__dirname, 'customers.json');

const logger = createLogger('provision-customers');

function loadCustomers(): CustomerEntry[] {
  if (!existsSync(customersPath)) {
    throw new Error(`customers.json not found at ${customersPath}`);
  }

  const content = readFileSync(customersPath, 'utf-8').trim();
  if (content.length === 0) {
    return [];
  }

  try {
    const data = JSON.parse(content);
    if (!Array.isArray(data)) {
      throw new Error('customers.json must contain an array');
    }
    return data as CustomerEntry[];
  } catch (error) {
    throw new Error(`Failed to parse customers.json: ${(error as Error).message}`);
  }
}

function persistCustomers(customers: CustomerEntry[]): void {
  writeFileSync(customersPath, `${JSON.stringify(customers, null, 2)}\n`, 'utf-8');
}

async function main() {
  const program = new Command();
  program
    .option('--customer <id...>', 'Provision only the specified customer IDs')
    .option('--share <email...>', 'Email addresses to grant edit access for new sheets')
    .option('--parent-folder-id <id>', 'Override parent folder ID (Drive folder or shared drive root)')
    .option('--force', 'Re-provision even if spreadsheetId is already set');
  program.parse();

  const options = program.opts<{
    customer?: string[];
    share?: string[];
    parentFolderId?: string;
    force?: boolean;
  }>();

  const config = loadConfig();
  const parentFolderId = options.parentFolderId ?? config.GOOGLE_SHEET_PARENT_FOLDER_ID;
  if (!parentFolderId) {
    throw new Error('GOOGLE_SHEET_PARENT_FOLDER_ID must be set to provision customer sheets');
  }

  const customers = loadCustomers();
  if (customers.length === 0) {
    logger.warn('No customers defined in customers.json');
    return;
  }

  const customerFilter = options.customer?.length ? new Set(options.customer) : null;
  const provisioner = new SheetsProvisioner({
    parentFolderId,
    templateSheetId: config.GOOGLE_TEMPLATE_SHEET_ID ?? undefined,
  });

  const drive = getDriveClient();
  let updated = false;

  for (const entry of customers) {
    if (customerFilter && !customerFilter.has(entry.customerId)) {
      logger.info({ customerId: entry.customerId }, 'Skipping (not in --customer list)');
      continue;
    }

    if (!entry.customerId || !entry.name) {
      logger.warn({ entry }, 'Skipping entry missing customerId or name');
      continue;
    }

    if (entry.spreadsheetId && !options.force) {
      logger.info({ customerId: entry.customerId, spreadsheetId: entry.spreadsheetId }, 'Sheet already provisioned, skipping');
      continue;
    }

    if (entry.spreadsheetId && options.force) {
      logger.warn({ customerId: entry.customerId, spreadsheetId: entry.spreadsheetId }, 'Re-provisioning due to --force flag');
    }

    logger.info({ customerId: entry.customerId }, 'Provisioning spreadsheet');
    const { spreadsheetId, url } = await provisioner.createSpreadsheet(entry.name);
    entry.spreadsheetId = spreadsheetId;
    entry.url = url;
    updated = true;

    const sourceShare = options.share?.length
      ? options.share
      : Array.isArray(entry.share)
        ? entry.share
        : [];
    const shareList = sourceShare.filter((email) => typeof email === 'string' && email.trim().length > 0);

    if (shareList.length > 0) {
      await Promise.all(
        shareList.map((email) =>
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
      logger.info({ customerId: entry.customerId, share: shareList }, 'Granted spreadsheet access');
      if (options.share?.length) {
        entry.share = Array.from(new Set(shareList));
      }
    }

    logger.info({ customerId: entry.customerId, spreadsheetId, url }, 'Sheet provisioned successfully');
  }

  if (updated) {
    persistCustomers(customers);
    logger.info('customers.json updated');
  } else {
    logger.info('No updates performed');
  }
}

void main().catch((error) => {
  logger.error({ err: error }, 'Failed to provision customer sheets');
  process.exit(1);
});
