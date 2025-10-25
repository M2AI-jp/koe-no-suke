import type { IAudioSink, IAudioSource } from './index';

export class FakeAudioSource implements IAudioSource {
  private callback: ((chunk: Buffer) => void) | null = null;
  private interval: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    this.interval = setInterval(() => {
      if (this.callback) {
        const dummyChunk = Buffer.alloc(320);
        this.callback(dummyChunk);
      }
    }, 20);
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  onData(callback: (chunk: Buffer) => void): void {
    this.callback = callback;
  }
}

export class FakeAudioSink implements IAudioSink {
  private readonly chunks: Buffer[] = [];

  async start(): Promise<void> {
    // no-op for fake sink
  }

  async stop(): Promise<void> {
    // no-op for fake sink
  }

  write(chunk: Buffer): void {
    this.chunks.push(chunk);
  }

  getChunks(): Buffer[] {
    return this.chunks;
  }
}
