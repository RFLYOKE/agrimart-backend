import { env } from '../config/env';

/**
 * Logger Utility
 * 
 * Simple logger with colored output for development
 * TODO: Replace with winston or pino for production logging
 */

enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

const colors = {
  reset: '\x1b[0m',
  info: '\x1b[36m',    // Cyan
  warn: '\x1b[33m',    // Yellow
  error: '\x1b[31m',   // Red
  debug: '\x1b[35m',   // Magenta
  timestamp: '\x1b[90m', // Gray
};

const getTimestamp = (): string => {
  return new Date().toISOString();
};

const formatMessage = (level: LogLevel, message: string, color: string): string => {
  return `${colors.timestamp}[${getTimestamp()}]${colors.reset} ${color}[${level}]${colors.reset} ${message}`;
};

export const logger = {
  info: (message: string, ...args: unknown[]): void => {
    console.log(formatMessage(LogLevel.INFO, message, colors.info), ...args);
  },

  warn: (message: string, ...args: unknown[]): void => {
    console.warn(formatMessage(LogLevel.WARN, message, colors.warn), ...args);
  },

  error: (message: string, ...args: unknown[]): void => {
    console.error(formatMessage(LogLevel.ERROR, message, colors.error), ...args);
  },

  debug: (message: string, ...args: unknown[]): void => {
    if (env.isDevelopment) {
      console.debug(formatMessage(LogLevel.DEBUG, message, colors.debug), ...args);
    }
  },
};

export default logger;
