import { z } from "zod";
import { logger } from "./logger.ts";

/**
 * Validation schema for runtime and build environment variables.
 */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().optional(),
});

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  FIREBASE_CONFIG: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
});

export function validateEnv() {
  const clientResult = clientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });

  if (!clientResult.success) {
    logger.warn("Client environment variables validation warnings:", {
      errors: clientResult.error.flatten().fieldErrors,
    });
  }

  const serverResult = serverEnvSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    FIREBASE_CONFIG: process.env.FIREBASE_CONFIG,
    GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET,
  });

  if (!serverResult.success) {
    logger.warn("Server environment variables validation warnings:", {
      errors: serverResult.error.flatten().fieldErrors,
    });
  }

  return {
    client: clientResult.success ? clientResult.data : null,
    server: serverResult.success ? serverResult.data : null,
    isValid: clientResult.success && serverResult.success,
  };
}
