import crypto from "crypto";
import { logger } from "../logger.ts";

/**
 * Validates GitHub Webhook payloads using HMAC-SHA256 signature verification.
 * Compares computed signature with X-Hub-Signature-256 using timingSafeEqual to avoid timing attacks.
 */
export function verifyGitHubWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  const parts = signatureHeader.split("sha256=");
  if (parts.length !== 2) {
    return false;
  }

  const expectedSignature = parts[1];

  try {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(typeof rawBody === "string" ? rawBody : Buffer.from(rawBody));
    const computedSignature = hmac.digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const computedBuffer = Buffer.from(computedSignature, "utf8");

    if (expectedBuffer.length !== computedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, computedBuffer);
  } catch (err: unknown) {
    logger.error("Error during webhook HMAC verification", err);
    return false;
  }
}
