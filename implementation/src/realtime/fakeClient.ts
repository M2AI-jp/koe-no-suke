import { EventEmitter } from 'events';

type ResponseDonePayload = {
  reason: 'fake';
};

export declare interface FakeRealtimeClient {
  on(event: 'audio.delta', listener: (delta: Buffer) => void): this;
  on(event: 'response.done', listener: (payload: ResponseDonePayload) => void): this;
  emit(event: 'audio.delta', delta: Buffer): boolean;
  emit(event: 'response.done', payload: ResponseDonePayload): boolean;
}

export class FakeRealtimeClient extends EventEmitter {
  private started = false;

  async start(): Promise<void> {
    this.started = true;
  }

  async stop(): Promise<void> {
    this.started = false;
  }

  sendAudio(chunk: Buffer): void {
    if (!this.started) {
      throw new Error('FakeRealtimeClient not started');
    }
    this.emit('audio.delta', chunk);
    setImmediate(() => {
      if (this.started) {
        this.emit('response.done', { reason: 'fake' });
      }
    });
  }
}
