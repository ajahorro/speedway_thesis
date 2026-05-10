/**
 * Centralized Production-Grade Logger Utility
 * Handles scoped logging, environment gating, and consistent formatting.
 */

const isDev = import.meta.env.DEV;

const formatMessage = (scope, message) => `[${scope.toUpperCase()}] ${message}`;

export const logger = {
  auth: (message, ...args) => {
    if (isDev) console.log(`%c${formatMessage('auth', message)}`, 'color: #3b82f6; font-weight: bold;', ...args);
  },

  admin: (message, ...args) => {
    if (isDev) console.log(`%c${formatMessage('admin', message)}`, 'color: #a855f7; font-weight: bold;', ...args);
  },

  api: (message, ...args) => {
    if (isDev) console.log(`%c${formatMessage('api', message)}`, 'color: #10b981; font-weight: bold;', ...args);
  },

  debug: (message, ...args) => {
    if (isDev) console.debug(`%c${formatMessage('debug', message)}`, 'color: #6b7280; font-style: italic;', ...args);
  },

  warn: (message, ...args) => {
    if (isDev) console.warn(formatMessage('warn', message), ...args);
  },

  error: (message, ...args) => {
    // Errors are always logged, even in production, for debugging purposes
    console.error(`%c${formatMessage('error', message)}`, 'color: #ef4444; font-weight: bold;', ...args);
  }
};
