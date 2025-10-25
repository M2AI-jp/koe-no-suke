import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('createLogger', () => {
  it('correlationIdを持つ子ロガーを作成', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');

    const { createLogger } = await import('./logger');

    const childLogger = createLogger('test-session-123');

    expect(childLogger.bindings()).toMatchObject({
      correlationId: 'test-session-123',
    });
  });
});
