/* Minimal structured logger, can be swapped for pino/winston later */
import { config } from '../config/env.js';

const levels = ['debug', 'info', 'warn', 'error'];

function log(level, message, meta) {
  if (!levels.includes(level)) level = 'info';
  const payload = {
    level,
    message,
    time: new Date().toISOString(),
    ...meta,
  };
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](JSON.stringify(payload));
}

export const logger = {
  debug: (message, meta = {}) => {
    if (config.logLevel === 'debug') log('debug', message, meta);
  },
  info: (message, meta = {}) => log('info', message, meta),
  warn: (message, meta = {}) => log('warn', message, meta),
  error: (message, meta = {}) => log('error', message, meta),
};


