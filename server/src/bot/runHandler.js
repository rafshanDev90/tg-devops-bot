import { executionService } from '../services/executionService.js';
import { Student } from '../models/Student.js';
import { requireAdmin } from '../middleware/admin.js';
import { logger } from '../utils/logger.js';
import { escapeHtml } from '../utils/html.js';

const DAILY_QUOTA_RESET_HOURS = 24;

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

function extractCode(text) {
  const fenced = text.match(/```(?:python|py)?\n?([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const afterCmd = text.replace(/^\/run\s*/i, '').trim();
  return afterCmd || null;
}

export async function handleRun(ctx) {
  const telegramId = ctx.from.id;
  const { allowed, reason, student } = await checkAccess(telegramId);
  if (!allowed) return ctx.reply(reason);

  const code = extractCode(ctx.message?.text || '');
  if (!code) {
    return ctx.reply(
      '💻 <b>Python Lab</b>\n\n' +
      'Send Python code to execute in a secure sandbox.\n\n' +
      '<b>Usage:</b>\n' +
      '<pre>/run print("hello world")</pre>\n\n' +
      'Or with a code block:\n' +
      '<pre>/run\n```python\nimport torch\nprint(torch.__version__)\n```</pre>\n\n' +
      'Use /run_status to check your quota.',
      { parse_mode: 'HTML' }
    );
  }

  const statusMsg = await ctx.reply('⚙️ Running…');
  const result = await executionService.run(telegramId, code);

  if (student.role !== 'admin') {
    student.runQuota.used += 1;
    await student.save();
  }

  if (!result.success) {
    return ctx.telegram.editMessageText(
      ctx.chat.id, statusMsg.message_id, null,
      `❌ <b>Execution Error</b>\n\n<pre>${escapeHtml(result.error)}</pre>`,
      { parse_mode: 'HTML' }
    );
  }

  const header = result.error ? '⚠️ <b>Output (with errors)</b>' : '✅ <b>Output</b>';

  if (result.truncated) {
    await ctx.telegram.editMessageText(
      ctx.chat.id, statusMsg.message_id, null,
      `${header}\n\n<pre>${escapeHtml(result.shortOutput)}</pre>\n\n<i>Output truncated. Full output attached.</i>`,
      { parse_mode: 'HTML' }
    );
    return ctx.replyWithDocument(
      { source: Buffer.from(result.fullOutput, 'utf8'), filename: 'output.txt' },
      { caption: '📄 Full execution output' }
    );
  }

  return ctx.telegram.editMessageText(
    ctx.chat.id, statusMsg.message_id, null,
    `${header}\n\n<pre>${escapeHtml(result.shortOutput)}</pre>`,
    { parse_mode: 'HTML' }
  );
}

// Show user their current quota
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

// Admin-only: /run_grant <telegramId> <daily_limit>
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
