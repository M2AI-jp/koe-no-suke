import { spawn, ChildProcess } from 'child_process';
import type { Logger } from 'pino';
import type { IAudioSource } from './index';

export class Microphone implements IAudioSource {
  private process: ChildProcess | null = null;
  private callback: ((chunk: Buffer) => void) | null = null;

  constructor(
    private readonly sampleRate: number,
    private readonly logger: Logger
  ) {}

  async start(): Promise<void> {
    // Use sox to capture audio from default microphone
    // Output: 16-bit PCM, mono, specified sample rate
    this.process = spawn('sox', [
      '-d',                    // default audio device (microphone)
      '-t', 'raw',            // output type: raw PCM
      '-b', '16',             // 16-bit
      '-e', 'signed-integer', // signed integer encoding
      '-c', '1',              // mono (1 channel)
      '-r', this.sampleRate.toString(), // sample rate
      '-',                    // output to stdout
    ]);

    if (!this.process.stdout) {
      throw new Error('Failed to start sox process');
    }

    this.process.stdout.on('data', (chunk: Buffer) => {
      this.logger.debug({ chunkSize: chunk.length }, 'Microphone data received');
      if (this.callback) {
        this.callback(chunk);
      }
    });

    this.process.stderr?.on('data', (data) => {
      this.logger.debug({ stderr: data.toString() }, 'sox stderr');
    });

    this.process.on('error', (error) => {
      this.logger.error({ err: error }, 'sox process error');
    });

    this.process.on('exit', (code, signal) => {
      this.logger.warn({ code, signal }, 'sox process exited');
    });

    this.logger.info('Microphone started (sox)');
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
      this.logger.info('Microphone stopped');
    }
  }

  onData(callback: (chunk: Buffer) => void): void {
    this.callback = callback;
  }
}
