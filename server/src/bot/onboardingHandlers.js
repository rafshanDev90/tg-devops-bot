import { Student } from '../models/Student.js';
import { onboardingManager, STEPS } from '../services/onboardingManager.js';
import { StudentService } from '../services/studentService.js';
import { logger } from '../utils/logger.js';

const studentService = new StudentService();

export async function handleStart(ctx) {
  const existingStudent = await Student.findOne({ telegramId: ctx.from.id });

  if (existingStudent && existingStudent.metadata.onboardingCompleted) {
    return ctx.reply(
      `👋 Welcome back, ${escapeHtml(existingStudent.name)}!\n\n` +
      `🏛️ ${escapeHtml(existingStudent.academic.university)}\n` +
      `🎓 ${escapeHtml(existingStudent.academic.department)} | Batch ${existingStudent.academic.batch}\n` +
      `🆔 ID: ${escapeHtml(existingStudent.academic.universityId || 'Not set')}\n\n` +
      `Use /help to see available commands.`,
      { parse_mode: 'HTML' }
    );
  }

  if (existingStudent) {
    await Student.deleteOne({ telegramId: ctx.from.id });
  }

  onboardingManager.startSession(ctx.from.id);

  ctx.reply(
    `🎓 <b>Welcome to AMUST Hub!</b>\n\n` +
    `I'm your student assistant bot. Let's set up your profile first.\n\n` +
    `This will take less than 1 minute. You'll need to provide:\n` +
    `1️⃣ Your full name\n` +
    `2️⃣ Your university\n` +
    `3️⃣ Your department\n` +
    `4️⃣ Your batch number\n` +
    `5️⃣ Your university ID\n\n` +
    `<b>Let's begin!</b>\n\n` +
    `What's your full name?`,
    { parse_mode: 'HTML' }
  );
}

export async function handleOnboardingMessage(ctx) {
  const telegramId = ctx.from.id;
  const session = onboardingManager.getSession(telegramId);

  if (!session) {
    logger.warn('Onboarding', 'Received text but no active session', { telegramId });
    return;
  }

  const text = ctx.message?.text?.trim();
  if (!text) return;

  logger.info('Onboarding', `Processing step: ${session.step}`, { telegramId, text: text.substring(0, 20) });

  try {
    switch (session.step) {
      case STEPS.NAME:
        await handleNameStep(ctx, telegramId, text);
        break;
      case STEPS.UNIVERSITY:
        await ctx.reply('⚠️ Please select your university using the buttons below.');
        break;
      case STEPS.DEPARTMENT:
        await ctx.reply('⚠️ Please select your department using the buttons below.');
        break;
      case STEPS.BATCH:
        await handleBatchStep(ctx, telegramId, text);
        break;
      case STEPS.UNIVERSITY_ID:
        await handleUniversityIdStep(ctx, telegramId, text);
        break;
      default:
        logger.warn('Onboarding', 'Unknown step', { telegramId, step: session.step });
        await ctx.reply('⚠️ Something went wrong. Please use /setup_profile to restart.');
        onboardingManager.cancelSession(telegramId);
    }
  } catch (err) {
    logger.error('Onboarding', 'Error in onboarding message handler', { telegramId, error: err.message, stack: err.stack });
    await ctx.reply('❌ Something went wrong. Please use /setup_profile to try again.');
  }
}

export async function handleUniversityCallback(ctx) {
  const telegramId = ctx.from.id;
  const session = onboardingManager.getSession(telegramId);

  if (!session || session.step !== STEPS.UNIVERSITY) {
    return ctx.answerCbQuery('⚠️ Please use /start to begin setup first.');
  }

  const callbackData = ctx.callbackQuery.data;
  const uniCode = callbackData.replace('uni_', '');

  await ctx.answerCbQuery();

  onboardingManager.advanceStep(telegramId, STEPS.UNIVERSITY, uniCode);

  const keyboard = onboardingManager.getDepartmentKeyboard();

  await ctx.reply(
    `✅ University: <b>${escapeHtml(uniCode)}</b>\n\n` +
    `Now select your <b>department</b>:`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: keyboard,
      },
    }
  );
}

export async function handleDepartmentCallback(ctx) {
  const telegramId = ctx.from.id;
  const session = onboardingManager.getSession(telegramId);

  if (!session || session.step !== STEPS.DEPARTMENT) {
    return ctx.answerCbQuery('⚠️ Please use /start to begin setup first.');
  }

  const callbackData = ctx.callbackQuery.data;
  const deptCode = callbackData.replace('dept_', '');

  await ctx.answerCbQuery();

  onboardingManager.advanceStep(telegramId, STEPS.DEPARTMENT, deptCode);

  ctx.reply(
    `✅ Department: <b>${escapeHtml(deptCode)}</b>\n\n` +
    `Now enter your <b>batch number</b>.\n\n` +
    `Example: 47, 48, 49, etc.\n` +
    `(Enter just the number)`,
    { parse_mode: 'HTML' }
  );
}

async function handleNameStep(ctx, telegramId, name) {
  if (name.length < 2) {
    return ctx.reply('❌ Name must be at least 2 characters. Please enter your full name.');
  }

  onboardingManager.advanceStep(telegramId, STEPS.NAME, name);

  const keyboard = onboardingManager.getUniversityKeyboard();

  await ctx.reply(
    `✅ Name: <b>${escapeHtml(name)}</b>\n\n` +
    `Now select your <b>university</b>:\n` +
    `<i>(AMUST is pre-selected for most users)</i>`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: keyboard,
      },
    }
  );
}

async function handleBatchStep(ctx, telegramId, text) {
  const batch = parseInt(text);

  if (isNaN(batch) || batch < 1 || batch > 100) {
    return ctx.reply('❌ Please enter a valid batch number (e.g., 47, 48, 49).');
  }

  onboardingManager.advanceStep(telegramId, STEPS.BATCH, batch);

  await ctx.reply(
    `✅ Batch: <b>${batch}</b>\n\n` +
    `Finally, enter your <b>university ID</b>.\n\n` +
    `Example: 202401001, 0123456, etc.\n` +
    `(This is your official student ID)`,
    { parse_mode: 'HTML' }
  );
}

async function handleUniversityIdStep(ctx, telegramId, text) {
  const universityId = text.trim();

  if (universityId.length < 3) {
    return ctx.reply('❌ University ID seems too short. Please enter a valid ID.');
  }

  onboardingManager.advanceStep(telegramId, STEPS.UNIVERSITY_ID, universityId);

  logger.info('Onboarding', 'Completing session', { telegramId });
  const sessionData = onboardingManager.completeSession(telegramId);
  if (!sessionData) {
    logger.warn('Onboarding', 'Session data missing or expired', { telegramId });
    return ctx.reply('❌ Session expired. Please use /start to begin again.');
  }

  logger.info('Onboarding', 'Session data retrieved', { telegramId, data: sessionData });

  const existingWithId = await Student.findOne({ 'academic.universityId': universityId });
  if (existingWithId) {
    return ctx.reply(
      `❌ This university ID is already registered.\n\n` +
      `If this is your account, contact support.`
    );
  }

  logger.info('Onboarding', 'Creating student record', { telegramId });

  const student = await Student.create({
    telegramId,
    name: sessionData.name,
    username: ctx.from.username,
    academic: {
      university: sessionData.university,
      department: sessionData.department,
      batch: sessionData.batch,
      universityId,
      status: 'ACTIVE',
    },
    metadata: {
      isActive: true,
      lastActiveAt: new Date(),
      onboardingCompleted: true,
    },
  });

  logger.info('Onboarding', 'Student registered', {
    telegramId,
    name: student.name,
    university: student.academic.university,
    department: student.academic.department,
    batch: student.academic.batch,
  });

  await studentService.syncStudent(student);

  await ctx.reply(
    `🎉 <b>Profile Created Successfully!</b>\n\n` +
    `──────────────────\n` +
    `🏛️ <b>University:</b> ${escapeHtml(student.academic.university)}\n` +
    `👤 <b>Name:</b> ${escapeHtml(student.name)}\n` +
    `🎓 <b>Department:</b> ${escapeHtml(student.academic.department)}\n` +
    `📚 <b>Batch:</b> ${student.academic.batch}\n` +
    `🆔 <b>ID:</b> ${escapeHtml(student.academic.universityId)}\n` +
    `──────────────────\n\n` +
    `You're all set! Here's what I can help you with:\n\n` +
    `📖 Study questions — /ask\n` +
    `📅 Class routine — /today, /routine\n` +
    `📝 Assignments — /assignments\n` +
    `👤 Your profile — /profile\n\n` +
    `Use /help for full command list.\n` +
    `Use /edit_profile to update your info anytime.`,
    { parse_mode: 'HTML' }
  );
}

export async function handleSetupProfile(ctx) {
  const existingStudent = await Student.findOne({ telegramId: ctx.from.id });
  if (existingStudent && existingStudent.metadata.onboardingCompleted) {
    return ctx.reply('✅ Your profile is already set up. Use /edit_profile to make changes.');
  }

  if (existingStudent) {
    await Student.deleteOne({ telegramId: ctx.from.id });
  }

  onboardingManager.startSession(ctx.from.id);

  ctx.reply(
    `📝 <b>Let's set up your profile!</b>\n\n` +
    `What's your full name?`,
    { parse_mode: 'HTML' }
  );
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
