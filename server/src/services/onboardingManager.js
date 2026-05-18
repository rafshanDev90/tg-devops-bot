import { logger } from '../utils/logger.js';

const ONBOARDING_TIMEOUT_MS = 10 * 60 * 1000;

const UNIVERSITIES = [
  { code: 'AMUST', name: 'Ahsanullah University of Science & Technology' },
  { code: 'BUET', name: 'Bangladesh University of Engineering & Technology' },
  { code: 'DU', name: 'University of Dhaka' },
  { code: 'NSU', name: 'North South University' },
  { code: 'BRACU', name: 'BRAC University' },
  { code: 'AIUB', name: 'American International University-Bangladesh' },
  { code: 'IUB', name: 'Independent University Bangladesh' },
  { code: 'JUST', name: 'Jashore University of Science & Technology' },
  { code: 'OTHER', name: 'Other' },
];

const DEPARTMENTS = [
  { code: 'CSE', name: 'Computer Science & Engineering' },
  { code: 'EEE', name: 'Electrical & Electronic Engineering' },
  { code: 'ME', name: 'Mechanical Engineering' },
  { code: 'CE', name: 'Civil Engineering' },
  { code: 'BME', name: 'Biomedical Engineering' },
  { code: 'IPE', name: 'Industrial & Production Engineering' },
  { code: 'ARCH', name: 'Architecture' },
  { code: 'URP', name: 'Urban & Regional Planning' },
  { code: 'MATH', name: 'Mathematics' },
  { code: 'PHY', name: 'Physics' },
  { code: 'CHEM', name: 'Chemistry' },
  { code: 'STAT', name: 'Statistics' },
];

const STEPS = {
  NAME: 'name',
  UNIVERSITY: 'university',
  DEPARTMENT: 'department',
  BATCH: 'batch',
  UNIVERSITY_ID: 'university_id',
};

class OnboardingManager {
  constructor() {
    this.sessions = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), ONBOARDING_TIMEOUT_MS);
  }

  startSession(telegramId) {
    this.sessions.set(telegramId, {
      step: STEPS.NAME,
      data: { university: 'AMUST' },
      createdAt: Date.now(),
    });
    logger.info('Onboarding', 'Session started', { telegramId });
  }

  getSession(telegramId) {
    return this.sessions.get(telegramId);
  }

  advanceStep(telegramId, step, value) {
    const session = this.sessions.get(telegramId);
    if (!session) return null;

    session.data[step] = value;

    const stepOrder = [STEPS.NAME, STEPS.UNIVERSITY, STEPS.DEPARTMENT, STEPS.BATCH, STEPS.UNIVERSITY_ID];
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
    logger.info('Onboarding', 'Session completed', { telegramId });
    return session.data;
  }

  cancelSession(telegramId) {
    this.sessions.delete(telegramId);
    logger.info('Onboarding', 'Session cancelled', { telegramId });
  }

  cleanup() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.createdAt > ONBOARDING_TIMEOUT_MS) {
        this.sessions.delete(id);
        logger.info('Onboarding', 'Session expired', { telegramId: id });
      }
    }
  }

  stop() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
  }

  getUniversities() {
    return UNIVERSITIES;
  }

  getDepartments() {
    return DEPARTMENTS;
  }

  getUniversityKeyboard() {
    const keyboard = [];
    for (let i = 0; i < UNIVERSITIES.length; i += 2) {
      const row = [UNIVERSITIES[i]];
      if (UNIVERSITIES[i + 1]) row.push(UNIVERSITIES[i + 1]);
      keyboard.push(row.map(u => ({
        text: u.code,
        callback_data: `uni_${u.code}`,
      })));
    }
    return keyboard;
  }

  getDepartmentKeyboard() {
    const keyboard = [];
    for (let i = 0; i < DEPARTMENTS.length; i += 2) {
      const row = [DEPARTMENTS[i]];
      if (DEPARTMENTS[i + 1]) row.push(DEPARTMENTS[i + 1]);
      keyboard.push(row.map(d => ({
        text: d.code,
        callback_data: `dept_${d.code}`,
      })));
    }
    return keyboard;
  }
}

export const onboardingManager = new OnboardingManager();
export { STEPS, UNIVERSITIES, DEPARTMENTS };
