import { logger } from '../../utils/logger.js';

const NOTE_CREATION_TIMEOUT_MS = 10 * 60 * 1000;

const STEPS = {
  IDLE: 'idle',
  AWAITING_TITLE: 'awaiting_title',
  AWAITING_CATEGORY: 'awaiting_category',
  AWAITING_CONTENT: 'awaiting_content',
  AWAITING_TAGS: 'awaiting_tags',
  AWAITING_ENCRYPT: 'awaiting_encrypt',
};

class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), NOTE_CREATION_TIMEOUT_MS);
  }

  startNoteCreation(telegramId) {
    this.sessions.set(telegramId, {
      step: STEPS.AWAITING_TITLE,
      data: {},
      createdAt: Date.now(),
    });
    logger.info('NoteSession', 'Creation started', { telegramId });
  }

  getSession(telegramId) {
    return this.sessions.get(telegramId);
  }

  advanceStep(telegramId, step, value) {
    const session = this.sessions.get(telegramId);
    if (!session) return null;

    session.data[step] = value;

    const stepOrder = [
      STEPS.AWAITING_TITLE,
      STEPS.AWAITING_CATEGORY,
      STEPS.AWAITING_CONTENT,
      STEPS.AWAITING_TAGS,
      STEPS.AWAITING_ENCRYPT,
    ];

    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex < stepOrder.length - 1) {
      session.step = stepOrder[currentIndex + 1];
    } else {
      session.step = 'completed';
    }

    session.createdAt = Date.now();
    return session;
  }

  completeSession(telegramId) {
    const session = this.sessions.get(telegramId);
    if (!session || session.step !== 'completed') return null;

    this.sessions.delete(telegramId);
    logger.info('NoteSession', 'Creation completed', { telegramId });
    return session.data;
  }

  cancelSession(telegramId) {
    this.sessions.delete(telegramId);
    logger.info('NoteSession', 'Creation cancelled', { telegramId });
  }

  cleanup() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.createdAt > NOTE_CREATION_TIMEOUT_MS) {
        this.sessions.delete(id);
        logger.info('NoteSession', 'Session expired', { telegramId: id });
      }
    }
  }

  stop() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
  }

  getSteps() {
    return STEPS;
  }
}

export const noteSessionManager = new SessionManager();
export { STEPS };
