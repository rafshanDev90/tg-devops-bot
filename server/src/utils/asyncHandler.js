import { AppError } from './errors.js';

export function asyncHandler(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      const err = error.isOperational
        ? error
        : new AppError(error.message || 'Internal server error', 500, {
            originalError: error.name,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          });

      console.error(`[asyncHandler] ${err.name}:`, err.message, err.context ? JSON.stringify(err.context) : '');

      const ctx = args[args.length - 1];
      if (ctx && typeof ctx.reply === 'function') {
        const userMessage = err.statusCode >= 500
          ? 'Something went wrong. Please try again in a moment.'
          : err.message;
        ctx.reply(userMessage).catch(() => {});
      }

      return null;
    }
  };
}

export async function safeExecute(fn, fallback = null) {
  try {
    return await fn();
  } catch (error) {
    console.error(`[safeExecute] ${error.name}:`, error.message);
    return typeof fallback === 'function' ? fallback(error) : fallback;
  }
}
