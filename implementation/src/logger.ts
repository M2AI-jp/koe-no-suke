import pino from 'pino';
import { loadConfig } from './config';

const config = loadConfig();

export const logger = pino({
  level: config.LOG_LEVEL,
});

export function createLogger(correlationId: string) {
  return logger.child({ correlationId });
}
