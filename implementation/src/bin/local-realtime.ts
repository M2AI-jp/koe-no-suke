#!/usr/bin/env node
import { Command } from 'commander';
import { loadConfig } from '../config';
import { createLogger } from '../logger';
import { RealtimeClient } from '../realtime/client';
import { FakeRealtimeClient } from '../realtime/fakeClient';
import { Microphone } from '../audio/microphone';
import { Speakers } from '../audio/speakers';
import { FakeAudioSink, FakeAudioSource } from '../audio/fake';
import { LocalOrchestrator } from '../conversation/localOrchestrator';

const program = new Command();

program
  .name('local-realtime')
  .option('--dry-run', 'Use fake audio I/O for testing')
  .option('--model <model>', 'OpenAI model to use')
  .parse();

const options = program.opts<{
  dryRun?: boolean;
  model?: string;
}>();

const config = loadConfig();
const logger = createLogger('cli');
const model = options.model || config.OPENAI_REALTIME_MODEL;

const realtimeClient = options.dryRun
  ? new FakeRealtimeClient()
  : new RealtimeClient(config.OPENAI_API_KEY, model, logger);

const audioSource = options.dryRun
  ? new FakeAudioSource()
  : new Microphone(config.AUDIO_SAMPLE_RATE, logger);

const audioSink = options.dryRun
  ? new FakeAudioSink()
  : new Speakers(config.AUDIO_SAMPLE_RATE, logger);

if (options.dryRun) {
  logger.info('Using fake audio I/O');
} else {
  logger.info('Using real audio I/O');
}

const orchestrator = new LocalOrchestrator(
  realtimeClient,
  audioSource,
  audioSink,
  logger,
  Boolean(options.dryRun)
);

async function main() {
  await orchestrator.start();

  process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    await orchestrator.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error(error, 'Fatal error');
  process.exit(1);
});
