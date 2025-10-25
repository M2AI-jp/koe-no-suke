import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const writeMock = vi.fn();
const endMock = vi.fn();

vi.mock('speaker', () => ({
  default: vi.fn().mockImplementation(() => ({
    write: writeMock,
    end: endMock,
  })),
}));

const createTestLogger = async () => {
  vi.stubEnv('OPENAI_API_KEY', 'test-key');
  const { createLogger } = await import('../logger');
  return createLogger('test');
};

beforeEach(() => {
  writeMock.mockClear();
  endMock.mockClear();
});

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('Speakers', () => {
  it('start()でスピーカーを起動', async () => {
    const { Speakers } = await import('./speakers');
    const speakers = new Speakers(16000, await createTestLogger());

    await expect(speakers.start()).resolves.not.toThrow();
  });

  it('stop()でスピーカーを停止', async () => {
    const { Speakers } = await import('./speakers');
    const speakers = new Speakers(16000, await createTestLogger());
    await speakers.start();

    await expect(speakers.stop()).resolves.not.toThrow();
    expect(endMock).toHaveBeenCalledTimes(1);
  });

  it('write()でスピーカーに書き込む', async () => {
    const { Speakers } = await import('./speakers');
    const speakers = new Speakers(16000, await createTestLogger());
    await speakers.start();

    const chunk = Buffer.from([1, 2, 3]);
    speakers.write(chunk);

    expect(writeMock).toHaveBeenCalledWith(chunk);
  });
});
