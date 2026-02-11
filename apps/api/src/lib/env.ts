import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default("clearn-images"),
  R2_ENDPOINT: z.string().url().optional(),
  R2_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  REVENUECAT_WEBHOOK_SECRET: z.string().optional(),
  FREE_SCAN_LIMIT_PER_MONTH: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_FREE_PER_MINUTE: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_PRO_PER_MINUTE: z.coerce.number().int().positive().default(240)
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }

  return cachedEnv;
}
