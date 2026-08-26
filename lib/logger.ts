/**
 * Structured logger for GuruPRO
 *
 * Format: JSON in production, human-readable in development.
 * Levels: debug, info, warn, error, fatal
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

function shouldLog(level: LogLevel): boolean {
  const envLevel = (process.env.LOG_LEVEL || 'info') as LogLevel;
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[envLevel];
}

function formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const pid = process.pid;

  if (process.env.NODE_ENV === 'production') {
    const entry = {
      timestamp,
      level,
      message,
      pid,
      ...(meta && { meta }),
    };
    return JSON.stringify(entry);
  }

  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

function print(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (!shouldLog(level)) return;

  const formatted = formatMessage(level, message, meta);

  switch (level) {
    case 'debug':
      if (process.env.NODE_ENV !== 'production') console.debug(formatted);
      break;
    case 'info':
      console.info(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
    case 'fatal':
      console.error(formatted);
      break;
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => print('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => print('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => print('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => print('error', message, meta),
  fatal: (message: string, meta?: Record<string, unknown>) => print('fatal', message, meta),

  child: (defaults: Record<string, unknown>) => ({
    debug: (message: string, meta?: Record<string, unknown>) => print('debug', message, { ...defaults, ...meta }),
    info: (message: string, meta?: Record<string, unknown>) => print('info', message, { ...defaults, ...meta }),
    warn: (message: string, meta?: Record<string, unknown>) => print('warn', message, { ...defaults, ...meta }),
    error: (message: string, meta?: Record<string, unknown>) => print('error', message, { ...defaults, ...meta }),
    fatal: (message: string, meta?: Record<string, unknown>) => print('fatal', message, { ...defaults, ...meta }),
  }),
};
