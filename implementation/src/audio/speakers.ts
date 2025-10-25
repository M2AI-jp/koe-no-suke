import Speaker from 'speaker';
import type { Logger } from 'pino';
import type { IAudioSink } from './index';

export class Speakers implements IAudioSink {
  private speaker: Speaker | null = null;

  constructor(
    private readonly sampleRate: number,
    private readonly logger: Logger
  ) {}

  async start(): Promise<void> {
    this.speaker = new Speaker({
      channels: 1,
      bitDepth: 16,
      sampleRate: this.sampleRate,
    });

    this.logger.info('Speakers started');
  }

  async stop(): Promise<void> {
    if (this.speaker) {
      this.speaker.end();
      this.logger.info('Speakers stopped');
    }
  }

  write(chunk: Buffer): void {
    if (this.speaker) {
      this.speaker.write(chunk);
    }
  }
}
