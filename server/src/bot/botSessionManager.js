import { logger } from '../utils/logger.js';

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

class BotSessionManager {
  constructor() {
    this.sessions = new Map();
    this.cleanupInterval = setInterval(() => this._cleanup(), TIMEOUT_MS);
  }

  start(telegramId, type, data = {}) {
    this.sessions.set(telegramId, { type, data, createdAt: Date.now() });
    logger.info('BotSession', `Started session: ${type}`, { telegramId });
  }

  get(telegramId) {
    return this.sessions.get(telegramId) || null;
  }

  end(telegramId) {
    this.sessions.delete(telegramId);
  }

  _cleanup() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.createdAt > TIMEOUT_MS) {
        this.sessions.delete(id);
        logger.info('BotSession', `Session expired: ${session.type}`, { telegramId: id });
      }
    }
  }

  stop() {
    clearInterval(this.cleanupInterval);
  }
}

export const botSessionManager = new BotSessionManager();
