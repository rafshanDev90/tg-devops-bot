import { logger } from '../utils/logger.js';

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OUTPUT_CHARS = 3000;

class ExecutionService {
  constructor() {
    this.sessions = new Map(); // userId -> { sandbox, lastUsedAt, timer }
    this.enabled = Boolean(process.env.E2B_API_KEY);
    if (!this.enabled) {
      logger.warn('ExecutionService', 'E2B_API_KEY not set. Code execution disabled.');
    }
  }

  async run(userId, code) {
    if (!this.enabled) {
      return { success: false, error: 'Code execution is not configured.' };
    }

    try {
      const sandbox = await this._getOrCreateSandbox(userId);
      const result = await sandbox.runCode(code);

      this._resetTimer(userId);

      const stdout = result.logs?.stdout?.join('') || '';
      const stderr = result.logs?.stderr?.join('') || '';
      const output = stdout + (stderr ? `\n[stderr]\n${stderr}` : '');

      logger.info('ExecutionService', 'Code executed', { userId, outputLen: output.length });

      return {
        success: true,
        output: output || '(no output)',
        truncated: output.length > MAX_OUTPUT_CHARS,
        fullOutput: output.length > MAX_OUTPUT_CHARS ? output : null,
        shortOutput: output.length > MAX_OUTPUT_CHARS ? output.substring(0, MAX_OUTPUT_CHARS) : output,
        error: result.error ? String(result.error) : null,
      };
    } catch (err) {
      logger.error('ExecutionService', 'Execution failed', { userId, error: err.message });
      // Kill broken session so next call gets a fresh one
      await this._killSession(userId);
      return { success: false, error: err.message };
    }
  }

  async _getOrCreateSandbox(userId) {
    const existing = this.sessions.get(userId);
    if (existing) {
      return existing.sandbox;
    }

    // Lazy import so the app starts even if @e2b/code-interpreter isn't installed
    const { Sandbox } = await import('@e2b/code-interpreter');
    const sandbox = await Sandbox.create({ apiKey: process.env.E2B_API_KEY });

    const timer = setTimeout(() => this._killSession(userId), IDLE_TIMEOUT_MS);
    this.sessions.set(userId, { sandbox, lastUsedAt: Date.now(), timer });
    logger.info('ExecutionService', 'Sandbox created', { userId });
    return sandbox;
  }

  _resetTimer(userId) {
    const session = this.sessions.get(userId);
    if (!session) return;
    clearTimeout(session.timer);
    session.timer = setTimeout(() => this._killSession(userId), IDLE_TIMEOUT_MS);
    session.lastUsedAt = Date.now();
  }

  async _killSession(userId) {
    const session = this.sessions.get(userId);
    if (!session) return;
    clearTimeout(session.timer);
    try { await session.sandbox.close(); } catch { /* already dead */ }
    this.sessions.delete(userId);
    logger.info('ExecutionService', 'Sandbox closed', { userId });
  }

  async killAll() {
    for (const userId of this.sessions.keys()) {
      await this._killSession(userId);
    }
  }

  hasSession(userId) {
    return this.sessions.has(userId);
  }
}

export const executionService = new ExecutionService();
