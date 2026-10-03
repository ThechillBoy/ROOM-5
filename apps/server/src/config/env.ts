import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  SESSION_SECRET: z.string().min(32),
  CLIENT_URL: z.string().url(),
  REDIS_URL: z.string().url().refine(
    (value) => value.startsWith("redis://") || value.startsWith("rediss://"),
    "REDIS_URL must use redis:// or rediss://",
  ).optional(),
}).superRefine((config, ctx) => {
  if (config.NODE_ENV === "production" && !config.REDIS_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["REDIS_URL"],
      message: "REDIS_URL is required in production for durable sessions",
    });
  }
});

export const env = envSchema.parse(process.env);
