#!/usr/bin/env tsx
import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { SheetsClient } from '../src/google/sheets';
import { mapToReservation } from '../src/conversation/reservationMapper';
import { createLogger } from '../src/logger';
import { loadConfig } from '../src/config';

type CustomerEntry = {
  customerId: string;
  spreadsheetId?: string;
};

const program = new Command();
program
  .option('--sheet-id <id>', 'Spreadsheet ID to write to')
  .option('--customer-id <id>', 'Customer ID to resolve sheet ID from customers.json');
program.parse();

const options = program.opts<{
  sheetId?: string;
  customerId?: string;
}>();

const logger = createLogger('test-sheets-write');

function resolveSheetId(): string | undefined {
  if (options.sheetId) {
    return options.sheetId;
  }

  if (!options.customerId) {
    return undefined;
  }

  const customersPath = resolve(process.cwd(), 'ops/customers/customers.json');
  if (!existsSync(customersPath)) {
    logger.warn({ customersPath }, 'customers.json not found; falling back to environment');
    return undefined;
  }

  try {
    const content = readFileSync(customersPath, 'utf-8');
    const customers = JSON.parse(content) as CustomerEntry[];
    const entry = customers.find((item) => item.customerId === options.customerId);
    if (!entry?.spreadsheetId) {
      logger.warn({ customerId: options.customerId }, 'Spreadsheet ID not found for customer');
      return undefined;
    }
    return entry.spreadsheetId;
  } catch (error) {
    logger.error({ err: error }, 'Failed to read customers.json');
    return undefined;
  }
}

async function main() {
  const sheetId = resolveSheetId();
  const config = loadConfig();
  const targetSheetId = sheetId ?? config.GOOGLE_SHEET_ID;

  if (!targetSheetId) {
    logger.error({ sheetId }, 'No spreadsheet ID provided via option, customers.json, or GOOGLE_SHEET_ID');
    process.exit(1);
    return;
  }

  const client = new SheetsClient(logger, targetSheetId);

  const rawData = {
    date: '2025-01-25',
    time: '18:00',
    party_size: 4,
    customer_name: 'テスト太郎',
    contact_number: '+819012345678',
    special_request: 'テストデータ',
  };

  const result = mapToReservation(rawData, '+819012345678');

  if (!result.success) {
    logger.error({ missingFields: result.missingFields }, 'Mapping failed');
    process.exit(1);
    return;
  }

  try {
    await client.appendReservation(result.reservation);
    logger.info(
      { customerId: options.customerId, sheetId: targetSheetId },
      'Test reservation written successfully'
    );
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, 'Failed to write test reservation');
    process.exit(1);
  }
}

void main();
