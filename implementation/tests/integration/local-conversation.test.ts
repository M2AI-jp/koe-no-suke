import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../src/config';
import { createLogger } from '../../src/logger';
import { FakeAudioSink, FakeAudioSource } from '../../src/audio/fake';
import { LocalOrchestrator } from '../../src/conversation/localOrchestrator';
import type { RealtimeClient } from '../../src/realtime/client';

const startMock = vi.fn();
const stopMock = vi.fn();
const sendAudioMock = vi.fn();
const onMock = vi.fn();

type ListenerMap = Record<string, Array<(...args: any[]) => void>>;
const listeners: ListenerMap = {};

vi.mock('../../src/realtime/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/realtime/client')>(
    '../../src/realtime/client'
  );

  class MockRealtimeClient implements Pick<RealtimeClient, 'start' | 'stop' | 'sendAudio' | 'on'> {
    start = startMock;
    stop = stopMock;
    sendAudio = sendAudioMock;

    on(event: 'audio.delta' | 'response.done', listener: (...args: any[]) => void) {
      onMock(event, listener);
      listeners[event] ??= [];
      listeners[event].push(listener);
      return this;
    }
  }

  return {
    ...actual,
    RealtimeClient: MockRealtimeClient,
  };
});

afterEach(() => {
  startMock.mockReset();
  stopMock.mockReset();
  sendAudioMock.mockReset();
  onMock.mockReset();
  Object.keys(listeners).forEach((key) => {
    listeners[key] = [];
  });
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('Local Conversation Integration', () => {
  it(
    'フェイク音声I/Oで会話セッションを開始・終了',
    async () => {
      vi.stubEnv('OPENAI_API_KEY', 'test-key');
      const config = loadConfig();
      const logger = createLogger('integration-test');
      const { RealtimeClient } = await import('../../src/realtime/client');

      const client = new RealtimeClient(config.OPENAI_API_KEY, config.OPENAI_REALTIME_MODEL, logger);
      const source = new FakeAudioSource();
      const sink = new FakeAudioSink();
      const orchestrator = new LocalOrchestrator(client, source, sink, logger);

      await orchestrator.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const deltaListeners = listeners['audio.delta'] ?? [];
      deltaListeners.forEach((listener) => listener(Buffer.from('test')));

      await orchestrator.stop();

      expect(startMock).toHaveBeenCalledTimes(1);
      expect(stopMock).toHaveBeenCalledTimes(1);
      expect(sendAudioMock).toHaveBeenCalled();
      expect(sink.getChunks().length).toBeGreaterThan(0);
    },
    10_000
  );
});
