/**
 * Firebase App Hosting & Cloud Run Server-Side Structured Logger.
 * Emits structured JSON events compatible with Google Cloud Logging and Firebase Console on the server,
 * and clean formatted messages in the browser.
 */

export interface LogContext {
  [key: string]: unknown;
}

export const logger = {
  info: (message: string, context?: LogContext) => {
    if (typeof window !== "undefined") {
      if (process.env.NODE_ENV !== "production") {
        console.info(`[INFO] ${message}`, context || "");
      }
      return;
    }
    const entry = {
      severity: "INFO",
      message,
      timestamp: new Date().toISOString(),
      ...(context || {}),
    };
    console.log(JSON.stringify(entry));
  },

  warn: (message: string, context?: LogContext) => {
    if (typeof window !== "undefined") {
      console.warn(`[WARN] ${message}`, context || "");
      return;
    }
    const entry = {
      severity: "WARNING",
      message,
      timestamp: new Date().toISOString(),
      ...(context || {}),
    };
    console.warn(JSON.stringify(entry));
  },

  error: (message: string, error?: unknown, context?: LogContext) => {
    const errorDetails =
      error instanceof Error
        ? error.stack || error.message
        : typeof error === "object" && error !== null
        ? JSON.stringify(error)
        : String(error || "");

    if (typeof window !== "undefined") {
      console.error(`[ERROR] ${message}`, errorDetails, context || "");
      return;
    }
    const entry = {
      severity: "ERROR",
      message,
      errorDetails,
      timestamp: new Date().toISOString(),
      ...(context || {}),
    };
    console.error(JSON.stringify(entry));
  },

  debug: (message: string, context?: LogContext) => {
    if (process.env.NODE_ENV === "production") return;
    if (typeof window !== "undefined") {
      console.debug(`[DEBUG] ${message}`, context || "");
      return;
    }
    const entry = {
      severity: "DEBUG",
      message,
      timestamp: new Date().toISOString(),
      ...(context || {}),
    };
    console.debug(JSON.stringify(entry));
  },
};
