import { describe, expect, it } from 'vitest';
import { FakeAudioSink, FakeAudioSource } from './fake';

describe('FakeAudioSource', () => {
  it('start()後にダミーデータを生成', async () => {
    const source = new FakeAudioSource();
    const chunks: Buffer[] = [];

    source.onData((chunk) => chunks.push(chunk));
    await source.start();

    await new Promise((resolve) => setTimeout(resolve, 50));
    await source.stop();

    expect(chunks.length).toBeGreaterThan(0);
  });
});

describe('FakeAudioSink', () => {
  it('write()でデータを保存', async () => {
    const sink = new FakeAudioSink();
    await sink.start();

    const chunk = Buffer.from('test');
    sink.write(chunk);

    expect(sink.getChunks()).toHaveLength(1);
    expect(sink.getChunks()[0]).toEqual(chunk);
  });
});
