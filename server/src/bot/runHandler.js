import { executionService } from '../services/executionService.js';
import { Student } from '../models/Student.js';
import { requireAdmin } from '../middleware/admin.js';
import { logger } from '../utils/logger.js';
import { escapeHtml } from '../utils/html.js';
import { codeSessionManager } from './codeSessionManager.js';
import { safeEdit } from '../utils/safeEdit.js';

const DAILY_QUOTA_RESET_HOURS = 24;

export function codeKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '▶ Execute', callback_data: 'run_execute' }],
      [
        { text: '🗑 Clear', callback_data: 'run_clear' },
        { text: '❌ Cancel', callback_data: 'run_cancel' },
      ],
    ],
  };
}

async function checkAccess(telegramId) {
  const student = await Student.findOne({ telegramId });
  if (!student) return { allowed: false, reason: 'Profile not found. Use /setup_profile first.' };
  if (student.role === 'admin') return { allowed: true, student };

  const quota = student.runQuota;
  if (!quota || quota.limit === 0) {
    return { allowed: false, reason: '🔒 Code execution is not enabled for your account.\n\nAsk an admin to grant you access with /run_grant.' };
  }

  const hoursSinceReset = (Date.now() - new Date(quota.resetAt).getTime()) / 3600000;
  if (hoursSinceReset >= DAILY_QUOTA_RESET_HOURS) {
    student.runQuota.used = 0;
    student.runQuota.resetAt = new Date();
    await student.save();
  }

  if (student.runQuota.used >= quota.limit) {
    return { allowed: false, reason: `⏳ Daily limit reached (${quota.limit} runs/day). Resets in ${Math.ceil(DAILY_QUOTA_RESET_HOURS - hoursSinceReset)}h.` };
  }

  return { allowed: true, student };
}

export async function handleRun(ctx) {
  const telegramId = ctx.from.id;
  const { allowed, reason, student } = await checkAccess(telegramId);
  if (!allowed) return ctx.reply(reason);

  const existing = ctx.message?.text?.replace(/^\/run\s*/i, '').trim();
  if (existing) {
    codeSessionManager.start(telegramId);
    codeSessionManager.append(telegramId, existing);
  } else {
    codeSessionManager.start(telegramId);
  }

  const code = codeSessionManager.get(telegramId)?.code || '';
  const codeDisplay = code
    ? `<pre>${escapeHtml(code)}</pre>\n\n<i>Lines: ${code.split('\n').length}</i>`
    : '<i>Type your Python code below. Each message is appended.</i>';

  return ctx.reply(
    `💻 <b>Python Lab</b>\n\n${codeDisplay}\n\n<b>Actions:</b>\n• Type code line by line\n• Press ▶ Execute to run\n• Press 🗑 Clear to reset\n• Press ❌ Cancel to exit`,
    { parse_mode: 'HTML', reply_markup: codeKeyboard() }
  );
}

export async function handleRunExecute(ctx) {
  const telegramId = ctx.from.id;
  const session = codeSessionManager.get(telegramId);

  if (!session || !session.code) {
    return ctx.answerCbQuery('⚠️ No code to execute. Type something first!');
  }

  const { allowed, reason, student } = await checkAccess(telegramId);
  if (!allowed) {
    codeSessionManager.end(telegramId);
    await ctx.answerCbQuery('⛔ Access denied');
    return safeEdit(ctx, reason);
  }

  await ctx.answerCbQuery('⚙️ Running…');

  const code = session.code;
  codeSessionManager.end(telegramId);

  const result = await executionService.run(telegramId, code);

  if (student.role !== 'admin') {
    student.runQuota.used += 1;
    await student.save();
  }

  const header = result.error ? '⚠️ <b>Output (with errors)</b>' : '✅ <b>Output</b>';

  if (result.truncated) {
    await safeEdit(ctx,
      `${header}\n\n<pre>${escapeHtml(result.shortOutput)}</pre>\n\n<i>Output truncated. Full output attached.</i>`,
      { parse_mode: 'HTML' }
    );
    return ctx.replyWithDocument(
      { source: Buffer.from(result.fullOutput, 'utf8'), filename: 'output.txt' },
      { caption: '📄 Full execution output' }
    );
  }

  return safeEdit(ctx,
    `${header}\n\n<pre>${escapeHtml(result.shortOutput)}</pre>`,
    { parse_mode: 'HTML' }
  );
}

export async function handleRunClear(ctx) {
  const telegramId = ctx.from.id;
  codeSessionManager.clear(telegramId);
  await ctx.answerCbQuery('🗑 Code cleared');
  return safeEdit(ctx,
    `💻 <b>Python Lab</b>\n\n<i>Type your Python code below. Each message is appended.</i>\n\n<b>Actions:</b>\n• Type code line by line\n• Press ▶ Execute to run\n• Press 🗑 Clear to reset\n• Press ❌ Cancel to exit`,
    { parse_mode: 'HTML', reply_markup: codeKeyboard() }
  );
}

export async function handleRunCancel(ctx) {
  const telegramId = ctx.from.id;
  codeSessionManager.end(telegramId);
  await ctx.answerCbQuery('❌ Session cancelled');
  return safeEdit(ctx,'❌ Python Lab session cancelled.');
}

export async function handleRunStatus(ctx) {
  const student = await Student.findOne({ telegramId: ctx.from.id });
  if (!student) return ctx.reply('⚠️ Use /setup_profile first.');

  if (student.role === 'admin') {
    const active = executionService.hasSession(ctx.from.id);
    return ctx.reply(
      `💻 <b>Python Lab — Admin</b>\n\n✅ Unlimited runs\nSandbox: ${active ? '🟢 Active' : '⚫ Idle'}`,
      { parse_mode: 'HTML' }
    );
  }

  const quota = student.runQuota;
  if (!quota || quota.limit === 0) {
    return ctx.reply('🔒 Code execution not enabled. Ask an admin to grant access.');
  }

  const used = quota.used || 0;
  const limit = quota.limit;
  const resetIn = Math.max(0, DAILY_QUOTA_RESET_HOURS - (Date.now() - new Date(quota.resetAt).getTime()) / 3600000);
  const bar = '█'.repeat(Math.round((used / limit) * 10)) + '░'.repeat(10 - Math.round((used / limit) * 10));
  const active = executionService.hasSession(ctx.from.id);

  return ctx.reply(
    `💻 <b>Python Lab — Status</b>\n\n` +
    `Quota: ${bar} ${used}/${limit}\n` +
    `Resets in: ${Math.ceil(resetIn)}h\n` +
    `Sandbox: ${active ? '🟢 Active (warm)' : '⚫ Idle'}`,
    { parse_mode: 'HTML' }
  );
}

export async function handleRunGrant(ctx, args) {
  return requireAdmin(ctx, async () => {
    const [targetId, limitStr] = args;
    const limit = parseInt(limitStr, 10);

    if (!targetId || isNaN(limit) || limit < 0) {
      return ctx.reply('Usage: /run_grant <telegramId> <daily_limit>\nExample: /run_grant 123456789 10');
    }

    const student = await Student.findOneAndUpdate(
      { telegramId: parseInt(targetId, 10) },
      { 'runQuota.limit': limit, 'runQuota.used': 0, 'runQuota.resetAt': new Date() },
      { new: true }
    );

    if (!student) return ctx.reply('❌ User not found.');
    logger.info('RunGrant', 'Quota updated', { targetId, limit, grantedBy: ctx.from.id });
    return ctx.reply(`✅ @${student.username || student.name} granted ${limit} runs/day.`);
  });
}
