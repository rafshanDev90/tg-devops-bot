const levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const level = process.env.LOG_LEVEL || 'INFO';

function format(level, module, message, meta) {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] ${level} [${module}] ${message}${metaStr}`;
}

export const logger = {
  debug: (module, message, meta) => {
    if (levels[level] <= levels.DEBUG) console.debug(format('DEBUG', module, message, meta));
  },
  info: (module, message, meta) => {
    if (levels[level] <= levels.INFO) console.info(format('INFO', module, message, meta));
  },
  warn: (module, message, meta) => {
    if (levels[level] <= levels.WARN) console.warn(format('WARN', module, message, meta));
  },
  error: (module, message, meta) => {
    if (levels[level] <= levels.ERROR) console.error(format('ERROR', module, message, meta));
  },
};
