import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from './config';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('loadConfig', () => {
  it('必須変数が欠けている場合はprocess.exitを呼ぶ', () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => {
        throw new Error(`process.exit called with ${code}`);
      }) as never);
    vi.stubEnv('OPENAI_API_KEY', '');

    expect(() => loadConfig()).toThrowError('process.exit called with 1');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('デフォルト値が適用される', () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');

    const config = loadConfig();

    expect(config.OPENAI_REALTIME_MODEL).toBe('gpt-realtime-2025-08-28');
    expect(config.AUDIO_SAMPLE_RATE).toBe(16000);
    expect(config.LOG_LEVEL).toBe('info');
  });
});
