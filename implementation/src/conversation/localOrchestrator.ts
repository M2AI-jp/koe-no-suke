import { randomUUID } from 'crypto';
import type { EventEmitter } from 'events';
import type { Logger } from 'pino';
import type { IAudioSink, IAudioSource } from '../audio';

type RealtimeClientLike = EventEmitter & {
  start(): Promise<void>;
  stop(): Promise<void>;
  sendAudio(chunk: Buffer): void;
  on(event: 'audio.delta', listener: (delta: Buffer) => void): this;
  on(event: 'response.done', listener: (payload: unknown) => void): this;
};

type LocalOrchestratorListeners = {
  onAiAudioChunk?: (delta: Buffer) => void;
  onAiResponseDone?: (event: unknown) => void;
};

export class LocalOrchestrator {
  private readonly correlationId = randomUUID();
  private startTime = 0;
  private isStopping = false;
  private hasStopped = false;
  private isAiSpeaking = false;

  constructor(
    private readonly realtimeClient: RealtimeClientLike,
    private readonly audioSource: IAudioSource,
    private readonly audioSink: IAudioSink,
    private readonly logger: Logger,
    private readonly autoStopOnDone = false,
    private readonly listeners: LocalOrchestratorListeners = {}
  ) {}

  async start(): Promise<void> {
    this.startTime = Date.now();
    this.logger.info(
      { correlationId: this.correlationId },
      'Session started'
    );

    await this.realtimeClient.start();

    this.audioSource.onData((chunk) => {
      // Only send audio when AI is not speaking
      if (!this.isAiSpeaking) {
        this.realtimeClient.sendAudio(chunk);
      }
    });

    this.realtimeClient.on('audio.delta', (delta: Buffer) => {
      // AI started speaking - pause microphone input
      if (!this.isAiSpeaking) {
        this.isAiSpeaking = true;
        this.logger.info({ correlationId: this.correlationId }, 'AI started speaking - pausing microphone');
      }
      this.audioSink.write(delta);
      this.listeners.onAiAudioChunk?.(delta);
    });

    this.realtimeClient.on('response.done', (event: unknown) => {
      // AI finished speaking - resume microphone input
      if (this.isAiSpeaking) {
        this.isAiSpeaking = false;
        this.logger.info({ correlationId: this.correlationId }, 'AI finished speaking - resuming microphone');
      }

      this.listeners.onAiResponseDone?.(event);

      if (this.autoStopOnDone) {
        this.logger.info(
          { correlationId: this.correlationId, event },
          'Auto stopping session after response.done'
        );
        void this.stop().catch((error) => {
          this.logger.error(
            { correlationId: this.correlationId, err: error },
            'Failed to auto stop session'
          );
        });
      }
    });

    await this.audioSource.start();
    await this.audioSink.start();
  }

  async stop(): Promise<void> {
    if (this.hasStopped || this.isStopping) {
      return;
    }
    this.isStopping = true;
    await this.audioSource.stop();
    await this.audioSink.stop();
    await this.realtimeClient.stop();

    const duration = Date.now() - this.startTime;
    this.logger.info(
      {
        correlationId: this.correlationId,
        duration_ms: duration,
        status: 'completed',
      },
      'Session ended'
    );
    this.hasStopped = true;
    this.isStopping = false;
  }
}
