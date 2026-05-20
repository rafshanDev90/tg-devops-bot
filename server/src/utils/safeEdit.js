import { logger } from './logger.js';

export async function safeEdit(ctx, text, extra = {}) {
  try {
    return await ctx.editMessageText(text, extra);
  } catch (err) {
    const isNotModified = err.message?.includes('message is not modified');
    if (isNotModified) {
      logger.debug('SafeEdit', 'Message not modified, skipping');
      return;
    }
    throw err;
  }
}

export async function safeEditReplyMarkup(ctx, replyMarkup) {
  try {
    return await ctx.editMessageReplyMarkup(replyMarkup);
  } catch (err) {
    const isNotModified = err.message?.includes('message is not modified');
    if (isNotModified) {
      logger.debug('SafeEdit', 'Reply markup not modified, skipping');
      return;
    }
    throw err;
  }
}
