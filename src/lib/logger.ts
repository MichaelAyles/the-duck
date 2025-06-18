/**
 * Production-safe logging utility
 * Only logs in development mode, silent in production
 */

export const logger = {
  /**
   * Development-only logging - completely silent in production
   */
  dev: {
    log: (...args: unknown[]) => {
      if (process.env.NODE_ENV === 'development') console.log(...args);
    },
    warn: (...args: unknown[]) => {
      if (process.env.NODE_ENV === 'development') console.warn(...args);
    },
    info: (...args: unknown[]) => {
      if (process.env.NODE_ENV === 'development') console.info(...args);
    },
  },

  /**
   * Production logging - always logs for monitoring/debugging
   */
  error: (...args: unknown[]) => console.error(...args),
  
  /**
   * Production warnings - always logs for important notices
   */
  warn: (...args: unknown[]) => console.warn(...args),
  
  /**
   * API usage and security logging - always logs for monitoring
   */
  security: (...args: unknown[]) => console.log(...args),
};