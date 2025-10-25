import type { Logger } from 'pino';
import { vi } from 'vitest';

export function stubOpenAIApiKey(value = 'test-key'): void {
  vi.stubEnv('OPENAI_API_KEY', value);
}

export async function createTestLogger(correlationId = 'test'): Promise<Logger> {
  stubOpenAIApiKey();
  const { createLogger } = await import('../../src/logger');
  return createLogger(correlationId);
}
