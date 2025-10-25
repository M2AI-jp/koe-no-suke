import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { createTestLogger } from '../../tests/helpers/testLogger';

class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;

  kill(signal?: string) {
    this.killed = true;
    return true;
  }
}

let mockProcess: MockChildProcess;
const spawnMock = vi.fn(() => mockProcess);

vi.mock('child_process', () => ({
  spawn: spawnMock,
}));

beforeEach(() => {
  mockProcess = new MockChildProcess();
  spawnMock.mockClear();
});

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('Microphone', () => {
  it('start()でsoxプロセスを起動', async () => {
    const { Microphone } = await import('./microphone');
    const mic = new Microphone(16000, await createTestLogger());

    await expect(mic.start()).resolves.not.toThrow();
    expect(spawnMock).toHaveBeenCalledWith('sox', [
      '-d',
      '-t', 'raw',
      '-b', '16',
      '-e', 'signed-integer',
      '-c', '1',
      '-r', '16000',
      '-',
    ]);
  });

  it('stop()でsoxプロセスを停止', async () => {
    const { Microphone } = await import('./microphone');
    const mic = new Microphone(16000, await createTestLogger());
    await mic.start();

    await expect(mic.stop()).resolves.not.toThrow();
    expect(mockProcess.killed).toBe(true);
  });
});
