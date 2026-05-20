import { Student } from '../models/Student.js';
import { logger } from '../utils/logger.js';

const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID ? parseInt(process.env.ADMIN_TELEGRAM_ID) : null;

export async function requireAdmin(ctx, next) {
  const student = await Student.findOne({ telegramId: ctx.from.id });
  if (!student || student.role !== 'admin') {
    if (ADMIN_TELEGRAM_ID && ctx.from.id === ADMIN_TELEGRAM_ID) {
      if (student) {
        student.role = 'admin';
        await student.save();
        logger.info('AdminMiddleware', 'Auto-promoted admin from env variable', { telegramId: ctx.from.id });
      }
      ctx.state.admin = student;
      return await next();
    }
    logger.warn('AdminMiddleware', 'Unauthorized admin access attempt', { telegramId: ctx.from.id });
    return ctx.reply('🚫 You do not have permission to use this command.');
  }
  ctx.state.admin = student;
  return await next();
}

export async function requireModeratorOrAdmin(ctx, next) {
  const student = await Student.findOne({ telegramId: ctx.from.id });
  if (!student || !['admin', 'moderator'].includes(student.role)) {
    return ctx.reply('🚫 You do not have permission to use this command.');
  }
  ctx.state.moderator = student;
  return next();
}

export async function trackActivity(ctx, next) {
  if (ctx.message && ctx.message.text) {
    const command = ctx.message.text.split(' ')[0];
    if (command.startsWith('/')) {
      try {
        const student = await Student.findOne({ telegramId: ctx.from.id });
        if (student) {
          await student.trackCommand(command);
        }
      } catch (err) {
        logger.error('TrackActivity', 'Failed to track command', { error: err.message });
      }
    }
  }
  return next();
}
