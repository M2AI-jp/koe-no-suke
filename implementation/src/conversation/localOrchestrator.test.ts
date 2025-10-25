import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import type { IAudioSink, IAudioSource } from '../audio';

const startMock = vi.fn();
const stopMock = vi.fn();
const sendAudioMock = vi.fn();
const onMock = vi.fn();
const listeners: Record<string, Array<(...args: any[]) => void>> = {};

vi.mock('../realtime/client', () => ({
  RealtimeClient: vi.fn().mockImplementation(() => {
    const instance = {
      start: startMock,
      stop: stopMock,
      sendAudio: sendAudioMock,
      on(event: 'audio.delta' | 'response.done', handler: (...args: any[]) => void) {
        onMock(event, handler);
        (listeners[event] ||= []).push(handler);
        return instance;
      },
    };
    return instance;
  }),
}));

const createTestLogger = async (): Promise<Logger> => {
  vi.stubEnv('OPENAI_API_KEY', 'test-key');
  const { createLogger } = await import('../logger');
  return createLogger('test');
};

class TestAudioSource implements IAudioSource {
  private handler: ((chunk: Buffer) => void) | null = null;

  async start(): Promise<void> {}

  async stop(): Promise<void> {}

  onData(callback: (chunk: Buffer) => void): void {
    this.handler = callback;
  }

  emit(chunk: Buffer): void {
    this.handler?.(chunk);
  }
}

class TestAudioSink implements IAudioSink {
  chunks: Buffer[] = [];

  async start(): Promise<void> {}

  async stop(): Promise<void> {}

  write(chunk: Buffer): void {
    this.chunks.push(chunk);
  }
}

beforeEach(() => {
  startMock.mockClear();
  stopMock.mockClear();
  sendAudioMock.mockClear();
  onMock.mockClear();
  Object.keys(listeners).forEach((key) => {
    listeners[key] = [];
  });
});

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('LocalOrchestrator', () => {
  it('start()でセッションを開始し、stop()で終える', async () => {
    const { RealtimeClient } = await import('../realtime/client');
    const { LocalOrchestrator } = await import('./localOrchestrator');

    const client = new RealtimeClient('test-key', 'test-model', await createTestLogger());
    const source = new TestAudioSource();
    const sink = new TestAudioSink();
    const orchestrator = new LocalOrchestrator(client, source, sink, await createTestLogger());

    await expect(orchestrator.start()).resolves.not.toThrow();
    source.emit(Buffer.from([0x00, 0x01]));

    expect(startMock).toHaveBeenCalledTimes(1);
    expect(onMock).toHaveBeenCalledWith('audio.delta', expect.any(Function));
    expect(sendAudioMock).toHaveBeenCalled();

    await expect(orchestrator.stop()).resolves.not.toThrow();
    expect(stopMock).toHaveBeenCalledTimes(1);
  });

  it('autoStopOnDone=true で response.done 受信時に停止する', async () => {
    const { FakeRealtimeClient } = await import('../realtime/fakeClient');
    const { LocalOrchestrator } = await import('./localOrchestrator');

    class InstrumentedFakeRealtimeClient extends FakeRealtimeClient {
      stopCalls = 0;

      override async stop(): Promise<void> {
        this.stopCalls += 1;
        await super.stop();
      }
    }

    const realtime = new InstrumentedFakeRealtimeClient();
    const source = new TestAudioSource();
    const sink = new TestAudioSink();
    const logger = await createTestLogger();

    const orchestrator = new LocalOrchestrator(realtime, source, sink, logger, true);

    await orchestrator.start();
    source.emit(Buffer.from([0xaa]));
    await new Promise((resolve) => setImmediate(resolve));
    await Promise.resolve();

    expect(sink.chunks.length).toBeGreaterThan(0);
    expect(realtime.stopCalls).toBe(1);

    await orchestrator.stop();
    expect(realtime.stopCalls).toBe(1);
  });
});
