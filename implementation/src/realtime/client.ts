import { EventEmitter } from 'events';
import OpenAI from 'openai';
import pRetry from 'p-retry';
import { OpenAIRealtimeWS } from 'openai/beta/realtime/ws';
import type {
  ConversationItemInputAudioTranscriptionCompletedEvent,
  RealtimeResponse,
  ResponseDoneEvent,
} from 'openai/resources/beta/realtime/realtime';
import type { Logger } from 'pino';

type ResponseDonePayload = unknown;

type RealtimeConnection = {
  on(event: string, listener: (payload: any) => void): void;
  once(event: string, listener: (...args: any[]) => void): void;
  send(event: Record<string, unknown>): void;
  close(): Promise<void>;
};

type TurnDetectionConfig = {
  type: string;
  threshold?: number;
  prefix_padding_ms?: number;
  silence_duration_ms?: number;
  [key: string]: unknown;
};

type InputAudioTranscriptionConfig = {
  model: string;
  [key: string]: unknown;
};

export type SessionConfiguration = {
  instructions: string;
  voice?: string;
  input_audio_format?: string;
  output_audio_format?: string;
  input_audio_transcription?: InputAudioTranscriptionConfig;
  turn_detection?: TurnDetectionConfig;
  [key: string]: unknown;
};

const DEFAULT_SESSION_CONFIGURATION: SessionConfiguration = {
  instructions: `あなたは日本国内の飲食店「レストラン桜」の電話予約受付AIアシスタントです。

会話の最初に、必ず以下のように挨拶してください：
「お電話ありがとうございます。レストラン桜でございます。ご予約のお電話でしょうか？」

その後、丁寧で親しみやすい口調で、以下の情報を順番に確認してください：
1. お客様のお名前
2. 予約日時（日付と時間）
3. 人数
4. その他のご要望（コース料理、アレルギー、席の希望など）

すべての情報を確認したら、予約内容を復唱して確認をお願いします。
日本語で自然な会話を心がけてください。`,
  voice: 'alloy',
  input_audio_format: 'pcm16',
  output_audio_format: 'pcm16',
  input_audio_transcription: {
    model: 'whisper-1',
  },
  turn_detection: {
    type: 'server_vad',
    threshold: 0.6,
    prefix_padding_ms: 300,
    silence_duration_ms: 1000,
  },
};

async function connectRealtimeSocket(apiKey: string, model: string): Promise<RealtimeConnection> {
  const client = new OpenAI({ apiKey });
  const socket = new OpenAIRealtimeWS({ model }, client);

  await new Promise<void>((resolve, reject) => {
    const handleOpen = () => {
      cleanup();
      resolve();
    };
    const handleError = (error: unknown) => {
      cleanup();
      reject(error instanceof Error ? error : new Error('WebSocket connection failed'));
    };
    const cleanup = () => {
      socket.socket.removeListener('open', handleOpen);
      socket.socket.removeListener('error', handleError);
    };

    socket.socket.once('open', handleOpen);
    socket.socket.once('error', handleError);
  });

  return {
    on: (event, listener) => {
      socket.on(event, listener);
    },
    once: (event, listener) => {
      socket.once(event, listener);
    },
    send: (event) => {
      socket.send(event);
    },
    close: () =>
      new Promise<void>((resolve) => {
        socket.once('close', () => resolve());
        socket.close();
      }),
  };
}

export declare interface RealtimeClient {
  on(event: 'audio.delta', listener: (delta: Buffer) => void): this;
  on(event: 'response.done', listener: (payload: ResponseDonePayload) => void): this;
  emit(event: 'audio.delta', delta: Buffer): boolean;
  emit(event: 'response.done', payload: ResponseDonePayload): boolean;
}

export class RealtimeClient extends EventEmitter {
  private connection: RealtimeConnection | null = null;
  private pendingResponse = false;
  private audioChunkCount = 0;
  private commitTimer: ReturnType<typeof setTimeout> | null = null;
  private hasBufferedAudio = false;
  private readonly sessionConfig: SessionConfiguration;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly logger: Logger,
    sessionConfig: SessionConfiguration = DEFAULT_SESSION_CONFIGURATION
  ) {
    super();
    this.sessionConfig = sessionConfig;
  }

  async start(): Promise<void> {
    await pRetry(
      async () => {
        this.connection = await connectRealtimeSocket(this.apiKey, this.model);
        this.setupEventHandlers();
        this.registerSessionLifecycleHandlers();
        this.pendingResponse = false;
        this.clearCommitTimer();
        this.audioChunkCount = 0;
        this.logger.info('Realtime API connected');
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: 500,
        maxTimeout: 5000,
      }
    );
  }

  private configureSession(): void {
    if (!this.connection) {
      return;
    }

    this.connection.send({
      type: 'session.update',
      session: { ...this.sessionConfig },
    });

    this.logger.info('Realtime session configured');

    // Request initial greeting
    this.connection.send({
      type: 'response.create',
    });

    this.logger.info('Initial greeting requested');
  }

  private setupEventHandlers(): void {
    if (!this.connection) {
      return;
    }

    this.connection.on('response.audio.delta', (event: { delta: string | Buffer }) => {
      const delta = typeof event.delta === 'string' ? Buffer.from(event.delta, 'base64') : event.delta;
      this.emit('audio.delta', delta as Buffer);
    });

    this.connection.on('conversation.item.input_audio_transcription.completed', (event: ConversationItemInputAudioTranscriptionCompletedEvent) => {
      if (!event?.transcript) {
        return;
      }

      this.logger.info(
        {
          role: 'user',
          transcript: event.transcript,
          itemId: event.item_id,
          contentIndex: event.content_index,
          eventId: event.event_id,
        },
        'User audio transcript captured'
      );
    });

    this.connection.on('response.done', (event: ResponseDoneEvent) => {
      this.clearCommitTimer();
      this.pendingResponse = false;
      this.audioChunkCount = 0;
      if (this.hasBufferedAudio) {
        this.hasBufferedAudio = false;
        this.scheduleAudioCommit(true);
      }
      this.logAssistantTranscript(event.response);
      this.emit('response.done', event);
    });

    this.connection.on('error', (error: unknown) => {
      this.logger.error({ err: error }, 'Realtime client error');
    });
  }

  private registerSessionLifecycleHandlers(): void {
    if (!this.connection) {
      return;
    }

    this.connection.once('session.created', () => {
      this.configureSession();
    });
  }

  sendAudio(chunk: Buffer): void {
    if (!this.connection) {
      throw new Error('WebSocket not connected');
    }

    this.connection.send({
      type: 'input_audio_buffer.append',
      audio: chunk.toString('base64'),
    });

    this.audioChunkCount++;
    if (this.audioChunkCount % 100 === 0) {
      this.logger.debug({ chunks: this.audioChunkCount }, 'Audio chunks sent');
    }

    if (this.pendingResponse) {
      this.hasBufferedAudio = true;
      return;
    }

    this.scheduleAudioCommit();
  }

  async stop(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.logger.info('Realtime API disconnected');
      this.connection = null;
    }
    this.clearCommitTimer();
  }

  private logAssistantTranscript(response: RealtimeResponse | undefined): void {
    if (!response) {
      return;
    }

    const transcripts = this.extractAssistantTranscripts(response);
    if (transcripts.length === 0) {
      return;
    }

    const transcriptText = transcripts.map((part) => part.trim()).filter((part) => part.length > 0).join(' ');

    this.logger.info(
      {
        role: 'assistant',
        responseId: response.id,
        status: response.status,
        transcript: transcriptText,
        transcriptSegments: transcripts,
      },
      'Assistant transcript captured'
    );
  }

  private extractAssistantTranscripts(response: RealtimeResponse): string[] {
    if (!Array.isArray(response.output)) {
      return [];
    }

    const transcripts: string[] = [];
    for (const item of response.output) {
      if (!item || item.role !== 'assistant' || !Array.isArray(item.content)) {
        continue;
      }

      for (const contentPart of item.content) {
        if (!contentPart) {
          continue;
        }

        if (typeof contentPart.text === 'string' && contentPart.text.trim().length > 0) {
          transcripts.push(contentPart.text);
        } else if (typeof contentPart.transcript === 'string' && contentPart.transcript.trim().length > 0) {
          transcripts.push(contentPart.transcript);
        }
      }
    }

    return transcripts;
  }

  private scheduleAudioCommit(force = false): void {
    if ((!force && this.pendingResponse) || this.commitTimer || !this.connection) {
      return;
    }

    this.commitTimer = setTimeout(() => {
      if (!this.connection) {
        this.commitTimer = null;
        return;
      }

      this.connection.send({
        type: 'input_audio_buffer.commit',
      });
      this.connection.send({
        type: 'response.create',
      });
      this.pendingResponse = true;
      this.hasBufferedAudio = false;
      this.commitTimer = null;
    }, 0);
  }

  private clearCommitTimer(): void {
    if (this.commitTimer) {
      clearTimeout(this.commitTimer);
      this.commitTimer = null;
    }
  }
}
