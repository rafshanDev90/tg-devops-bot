import { MenuBuilder } from './menuBuilder.js';
import { Student } from '../models/Student.js';
import { requireAdmin } from '../middleware/admin.js';
import { logger } from '../utils/logger.js';

export async function handleMenuCallback(ctx) {
  const data = ctx.callbackQuery.data;

  switch (data) {
    case 'menu_back':
      return ctx.editMessageText(MenuBuilder.mainMenu().text, {
        parse_mode: 'HTML',
        reply_markup: MenuBuilder.mainMenu().reply_markup,
      }).then(() => ctx.answerCbQuery());

    case 'menu_study':
      return ctx.editMessageText(MenuBuilder.studyMenu().text, {
        parse_mode: 'HTML',
        reply_markup: MenuBuilder.studyMenu().reply_markup,
      }).then(() => ctx.answerCbQuery());

    case 'menu_routine':
      return ctx.editMessageText(MenuBuilder.routineMenu().text, {
        parse_mode: 'HTML',
        reply_markup: MenuBuilder.routineMenu().reply_markup,
      }).then(() => ctx.answerCbQuery());

    case 'menu_notes':
      return ctx.editMessageText(MenuBuilder.notesMenu().text, {
        parse_mode: 'HTML',
        reply_markup: MenuBuilder.notesMenu().reply_markup,
      }).then(() => ctx.answerCbQuery());

    case 'menu_profile':
      return handleProfileMenu(ctx);

    case 'menu_status':
      return handleStatusAction(ctx);

    case 'study_ask':
      return ctx.answerCbQuery('Use /study ask <question> to ask AI');

    case 'study_assign':
      return ctx.answerCbQuery('Loading assignments...').then(async () => {
        const { handleAssignments } = await import('./handlers.js');
        return handleAssignments(ctx);
      });

    case 'routine_today':
      return ctx.answerCbQuery('Loading today\'s classes...').then(async () => {
        const { handleToday } = await import('./handlers.js');
        return handleToday(ctx);
      });

    case 'routine_week':
      return ctx.answerCbQuery('Loading weekly routine...').then(async () => {
        const { handleRoutine } = await import('./handlers.js');
        return handleRoutine(ctx);
      });

    case 'routine_upload':
      return ctx.answerCbQuery('Send your routine with /routine upload').then(() => {
        ctx.reply('📤 Send your routine as:\n• Image with caption\n• Text message\n• .txt file\n\nUse: /routine upload');
      });

    case 'routine_clear':
      return ctx.answerCbQuery('Clearing routine...').then(async () => {
        const { handleClearRoutine } = await import('./handlers.js');
        return handleClearRoutine(ctx);
      });

    case 'notes_add':
      return ctx.answerCbQuery('Starting note creation...').then(async () => {
        const { handleAddNote } = await import('../notes/handlers/noteCommands.js');
        return handleAddNote(ctx);
      });

    case 'notes_list':
      return ctx.answerCbQuery('Loading notes...').then(async () => {
        const { handleListNotes } = await import('../notes/handlers/noteCommands.js');
        return handleListNotes(ctx);
      });

    case 'notes_search':
      return ctx.answerCbQuery('Use /notes search <keyword>');

    case 'notes_tags':
      return ctx.answerCbQuery('Loading tags...').then(async () => {
        const { handleListTags } = await import('../notes/handlers/noteCommands.js');
        return handleListTags(ctx);
      });

    case 'notes_cancel':
      return ctx.answerCbQuery('Creation cancelled.').then(async () => {
        const { noteSessionManager } = await import('../notes/managers/sessionManager.js');
        noteSessionManager.cancelSession(ctx.from.id);
        return ctx.editMessageText('❌ Note creation cancelled.');
      });

    case 'profile_edit':
      return ctx.answerCbQuery('Use /profile edit to update');

    case 'profile_stats':
      return ctx.answerCbQuery('Loading stats...').then(async () => {
        const { handleProfileStats } = await import('./handlers.js');
        return handleProfileStats(ctx);
      });

    case 'admin_dashboard':
      return handleAdminAction(ctx, 'dashboard');

    case 'admin_users':
      return handleAdminAction(ctx, 'users');

    case 'admin_broadcast':
      return handleAdminAction(ctx, 'broadcast');

    case 'admin_stats':
      return handleAdminAction(ctx, 'stats');

    default:
      return ctx.answerCbQuery();
  }
}

async function handleProfileMenu(ctx) {
  await ctx.answerCbQuery();
  const student = await Student.findOne({ telegramId: ctx.from.id });
  if (!student) {
    return ctx.reply('⚠️ Please use /setup_profile first.');
  }
  return ctx.editMessageText(MenuBuilder.profileMenu(student).text, {
    parse_mode: 'HTML',
    reply_markup: MenuBuilder.profileMenu(student).reply_markup,
  });
}

async function handleStatusAction(ctx) {
  await ctx.answerCbQuery();
  const mongoose = await import('mongoose');
  const mongoState = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  return ctx.editMessageText(
    `ℹ️ <b>System Status</b>\n\n` +
    `Bot: ✅ Running\n` +
    `MongoDB: ${mongoState === 'Connected' ? '✅' : '❌'} ${mongoState}\n` +
    `Uptime: ${formatUptime(process.uptime())}`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu_back' }]],
      },
    }
  );
}

async function handleAdminAction(ctx, action) {
  await ctx.answerCbQuery();
  try {
    await requireAdmin(ctx, async () => {
      const {
        _handleAdmin: handleAdmin,
        _handleAdminUsers: handleAdminUsers,
        _handleAdminBroadcast: handleAdminBroadcast,
        _handleAdminStats: handleAdminStats,
      } = await import('./handlers.js');

      const actions = {
        dashboard: handleAdmin,
        users: handleAdminUsers,
        broadcast: handleAdminBroadcast,
        stats: handleAdminStats,
      };

      const handler = actions[action];
      if (handler) {
        await handler(ctx, () => {});
      }
    });
  } catch {
    // requireAdmin already replied
  }
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
