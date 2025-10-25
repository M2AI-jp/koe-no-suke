import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

const onMock = vi.fn();
const onceMock = vi.fn();
const sendMock = vi.fn();
const closeMock = vi.fn();
const socketOnceMock = vi.fn();
const socketRemoveListenerMock = vi.fn();
const eventHandlers: Record<string, Array<(...args: any[]) => void>> = {};

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    apiKey: 'mock-api-key',
    baseURL: 'https://api.openai.com/v1',
  })),
}));

vi.mock('openai/beta/realtime/ws', () => {
  class MockRealtimeWS {
    private closeListener: ((...args: any[]) => void) | null = null;

    socket = {
      once: (event: string, listener: (...args: any[]) => void) => {
        socketOnceMock(event, listener);
        if (event === 'open') {
          listener();
        }
        return this.socket;
      },
      removeListener: (event: string, listener: (...args: any[]) => void) => {
        socketRemoveListenerMock(event, listener);
        return this.socket;
      },
    };

    on(event: string, listener: (...args: any[]) => void): this {
      onMock(event, listener);
      eventHandlers[event] ??= [];
      eventHandlers[event].push(listener);
      return this;
    }

    once(event: string, listener: (...args: any[]) => void): this {
      onceMock(event, listener);
      if (event === 'close') {
        this.closeListener = listener;
      }
      return this;
    }

    send(event: unknown): void {
      sendMock(event);
    }

    close(): void {
      closeMock();
      this.closeListener?.();
    }
  }

  return { OpenAIRealtimeWS: MockRealtimeWS };
});

const createStubLogger = (): Logger =>
  ({
    info: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      error: vi.fn(),
    }),
  } as unknown as Logger);

beforeEach(() => {
  vi.useFakeTimers();
  onMock.mockClear();
  onceMock.mockClear();
  sendMock.mockClear();
  closeMock.mockClear();
  socketOnceMock.mockClear();
  socketRemoveListenerMock.mockClear();
  Object.keys(eventHandlers).forEach((key) => {
    eventHandlers[key] = [];
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('RealtimeClient', () => {
  it('start()でWebSocket接続を確立', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const { RealtimeClient } = await import('./client');

    const client = new RealtimeClient('test-api-key', 'test-model', createStubLogger());

    await expect(client.start()).resolves.not.toThrow();
    expect(socketOnceMock).toHaveBeenCalledWith('open', expect.any(Function));
    expect(socketOnceMock).toHaveBeenCalledWith('error', expect.any(Function));
    expect(onMock).toHaveBeenCalledWith('response.audio.delta', expect.any(Function));
    expect(onMock).toHaveBeenCalledWith('response.done', expect.any(Function));
    expect(socketRemoveListenerMock).toHaveBeenCalledWith('open', expect.any(Function));
    expect(socketRemoveListenerMock).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('stop()で接続を閉じる', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const { RealtimeClient } = await import('./client');

    const client = new RealtimeClient('test-api-key', 'test-model', createStubLogger());
    await client.start();

    await expect(client.stop()).resolves.not.toThrow();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('sendAudio()が音声チャンクを送信', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const { RealtimeClient } = await import('./client');

    const client = new RealtimeClient('test-api-key', 'test-model', createStubLogger());
    await client.start();

    const chunk = Buffer.from([0, 1, 2]);
    client.sendAudio(chunk);

    expect(sendMock).toHaveBeenNthCalledWith(1, {
      type: 'input_audio_buffer.append',
      audio: chunk.toString('base64'),
    });
    expect(sendMock).toHaveBeenCalledTimes(1);

    vi.runOnlyPendingTimers();

    expect(sendMock).toHaveBeenNthCalledWith(2, {
      type: 'input_audio_buffer.commit',
    });
    expect(sendMock).toHaveBeenNthCalledWith(3, {
      type: 'response.create',
    });

    const doneHandler = eventHandlers['response.done']?.[0];
    expect(doneHandler).toBeDefined();
    doneHandler?.({});

    sendMock.mockClear();
    client.sendAudio(chunk);

    expect(sendMock).toHaveBeenNthCalledWith(1, {
      type: 'input_audio_buffer.append',
      audio: chunk.toString('base64'),
    });
    vi.runOnlyPendingTimers();
    expect(sendMock).toHaveBeenNthCalledWith(2, {
      type: 'input_audio_buffer.commit',
    });
    expect(sendMock).toHaveBeenNthCalledWith(3, {
      type: 'response.create',
    });

    // while a response is pending, commit/res shouldn't fire again until done
    client.sendAudio(chunk);
    expect(sendMock).toHaveBeenNthCalledWith(4, {
      type: 'input_audio_buffer.append',
      audio: chunk.toString('base64'),
    });
    expect(sendMock).toHaveBeenCalledTimes(4);

    doneHandler?.({});
    vi.runOnlyPendingTimers();
    expect(sendMock).toHaveBeenNthCalledWith(5, {
      type: 'input_audio_buffer.commit',
    });
    expect(sendMock).toHaveBeenNthCalledWith(6, {
      type: 'response.create',
    });
  });
});
