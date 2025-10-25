import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';

// Load environment variables from .env file
dotenvConfig();

const optionalEnvString = z
  .preprocess((val) => {
    if (typeof val === 'string' && val.trim().length === 0) {
      return undefined;
    }
    return val;
  }, z.string().min(1))
  .optional();

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_REALTIME_MODEL: z.string().default('gpt-realtime-2025-08-28'),
  AUDIO_SAMPLE_RATE: z.coerce.number().default(16000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  GOOGLE_SA_KEY: z.string().optional(),
  GOOGLE_SHEET_ID: optionalEnvString,
  GOOGLE_SHEET_PARENT_FOLDER_ID: optionalEnvString,
  GOOGLE_TEMPLATE_SHEET_ID: optionalEnvString,
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Environment validation failed:', result.error.format());
    process.exit(1);
  }
  return result.data;
}
