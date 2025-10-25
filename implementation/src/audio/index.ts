export interface IAudioSource {
  start(): Promise<void>;
  stop(): Promise<void>;
  onData(callback: (chunk: Buffer) => void): void;
}

export interface IAudioSink {
  start(): Promise<void>;
  stop(): Promise<void>;
  write(chunk: Buffer): void;
}
