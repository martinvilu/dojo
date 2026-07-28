/**
 * Firebase App Hosting & Cloud Run Server-Side Structured Logger.
 * Emits structured JSON events compatible with Google Cloud Logging and Firebase Console.
 */

export interface LogContext {
  [key: string]: any;
}

export const logger = {
  info: (message: string, context?: LogContext) => {
    if (typeof window !== "undefined") return;
    const entry = {
      severity: "INFO",
      message,
      timestamp: new Date().toISOString(),
      ...(context || {})
    };
    console.log(JSON.stringify(entry));
  },

  warn: (message: string, context?: LogContext) => {
    if (typeof window !== "undefined") return;
    const entry = {
      severity: "WARNING",
      message,
      timestamp: new Date().toISOString(),
      ...(context || {})
    };
    console.warn(JSON.stringify(entry));
  },

  error: (message: string, error?: any, context?: LogContext) => {
    if (typeof window !== "undefined") return;
    const entry = {
      severity: "ERROR",
      message,
      errorDetails: error?.stack || error?.message || String(error || ""),
      timestamp: new Date().toISOString(),
      ...(context || {})
    };
    console.error(JSON.stringify(entry));
  },

  debug: (message: string, context?: LogContext) => {
    if (typeof window !== "undefined") return;
    const entry = {
      severity: "DEBUG",
      message,
      timestamp: new Date().toISOString(),
      ...(context || {})
    };
    console.debug(JSON.stringify(entry));
  }
};
