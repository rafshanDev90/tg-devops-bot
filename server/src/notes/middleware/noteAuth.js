import { Student } from '../../models/Student.js';
import { logger } from '../../utils/logger.js';

const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID ? parseInt(process.env.ADMIN_TELEGRAM_ID) : null;

export async function requireNoteAccess(ctx, next) {
  const telegramId = ctx.from.id;

  if (ADMIN_TELEGRAM_ID && telegramId === ADMIN_TELEGRAM_ID) {
    return next();
  }

  const student = await Student.findOne({ telegramId });
  if (!student || student.role !== 'admin') {
    logger.warn('NoteAuth', 'Unauthorized access attempt', { telegramId });
    return ctx.reply('🚫 You do not have permission to use this feature.');
  }

  return next();
}
