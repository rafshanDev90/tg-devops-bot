import { logger } from '../utils/logger.js';

const TIMEOUT_MS = 15 * 60 * 1000;

class MultiLineSessionManager {
  constructor() {
    this.sessions = new Map();
    this.cleanupInterval = setInterval(() => this._cleanup(), TIMEOUT_MS);
  }

  start(telegramId, type, title = '', submitLabel = 'Submit') {
    this.end(telegramId);
    const timer = setTimeout(() => this.end(telegramId), TIMEOUT_MS);
    this.sessions.set(telegramId, { type, text: '', title, submitLabel, createdAt: Date.now(), timer });
    logger.info('MultiLineSession', `Started: ${type}`, { telegramId });
  }

  get(telegramId) {
    return this.sessions.get(telegramId) || null;
  }

  append(telegramId, text) {
    const session = this.sessions.get(telegramId);
    if (!session) return false;
    session.text += (session.text ? '\n' : '') + text;
    clearTimeout(session.timer);
    session.timer = setTimeout(() => this.end(telegramId), TIMEOUT_MS);
    return true;
  }

  clear(telegramId) {
    const session = this.sessions.get(telegramId);
    if (!session) return;
    session.text = '';
    clearTimeout(session.timer);
    session.timer = setTimeout(() => this.end(telegramId), TIMEOUT_MS);
  }

  end(telegramId) {
    const session = this.sessions.get(telegramId);
    if (session) {
      clearTimeout(session.timer);
      this.sessions.delete(telegramId);
      logger.info('MultiLineSession', `Ended: ${session.type}`, { telegramId });
    }
  }

  _cleanup() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.createdAt > TIMEOUT_MS) {
        this.end(id);
      }
    }
  }

  stop() {
    clearInterval(this.cleanupInterval);
  }
}

export const multiLineSessionManager = new MultiLineSessionManager();
