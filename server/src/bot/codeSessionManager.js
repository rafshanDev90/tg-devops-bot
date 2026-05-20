import { logger } from '../utils/logger.js';

const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

class CodeSessionManager {
  constructor() {
    this.sessions = new Map(); // userId -> { code: string, createdAt: number, timer }
    this.cleanupInterval = setInterval(() => this._cleanup(), TIMEOUT_MS);
  }

  start(telegramId) {
    this.end(telegramId);
    const timer = setTimeout(() => this.end(telegramId), TIMEOUT_MS);
    this.sessions.set(telegramId, { code: '', createdAt: Date.now(), timer });
    logger.info('CodeSession', 'Started', { telegramId });
  }

  get(telegramId) {
    return this.sessions.get(telegramId) || null;
  }

  append(telegramId, text) {
    const session = this.sessions.get(telegramId);
    if (!session) return false;
    session.code += (session.code ? '\n' : '') + text;
    clearTimeout(session.timer);
    session.timer = setTimeout(() => this.end(telegramId), TIMEOUT_MS);
    return true;
  }

  clear(telegramId) {
    const session = this.sessions.get(telegramId);
    if (!session) return;
    session.code = '';
    clearTimeout(session.timer);
    session.timer = setTimeout(() => this.end(telegramId), TIMEOUT_MS);
    logger.info('CodeSession', 'Cleared', { telegramId });
  }

  end(telegramId) {
    const session = this.sessions.get(telegramId);
    if (session) {
      clearTimeout(session.timer);
      this.sessions.delete(telegramId);
      logger.info('CodeSession', 'Ended', { telegramId });
    }
  }

  _cleanup() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.createdAt > TIMEOUT_MS) {
        this.end(id);
        logger.info('CodeSession', 'Expired', { telegramId: id });
      }
    }
  }

  stop() {
    clearInterval(this.cleanupInterval);
  }
}

export const codeSessionManager = new CodeSessionManager();
