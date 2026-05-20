/**
 * src/bot/commands.js
 * Registers all bot commands, callbacks, and message handlers.
 * Keeps index.js clean — only bootstrap logic lives there.
 */
import {
  handleHelp,
  handleError,
  handleStatus,
  handleAsk,
  handleAssignments,
  handleUploadRoutine,
  handleToday,
  handleClearRoutine,
  handleEditProfile,
  handleMakeAdmin,
  handleStudyMenu,
  handleStudyAsk,
  handleStudyAssign,
  handleSearch,
  handleRoutineMenu,
  handleRoutineToday,
  handleRoutineWeek,
  handleRoutineUpload,
  handleRoutineClear,
  handleProfileMenu,
  handleProfileEdit,
  handleProfileStats,
  handleNotesMenu,
  handleNotesAdd,
  handleNotesList,
  handleNotesSearch,
  handleNotesTags,
  handleAdminMenu,
  handleAdminUsers,
  handleAdminBroadcast,
  handleAdminSuspend,
  handleAdminActivate,
  handleAdminPromote,
  _handleAdminUsers,
  _handleAdminBroadcast,
  _handleAdminStats,
  _handleAdminSuspend,
  _handleAdminActivate,
} from './handlers.js';
import {
  handleStart as handleOnboardingStart,
  handleOnboardingMessage,
  handleDepartmentCallback,
  handleUniversityCallback,
  handleSetupProfile,
} from './onboardingHandlers.js';
import { handleMenuCallback, handleBotSession } from './menuHandler.js';
import { botSessionManager } from './botSessionManager.js';
import {
  handleNotesCommand,
  handleNoteViewCommand,
  handleNoteCallback,
} from '../notes/handlers/noteCommands.js';
import { handleNoteCreationMessage } from '../notes/handlers/noteOnboarding.js';
import {
  handleLearn,
  handleLearnAdd,
  handleLearnStatus,
} from '../learning/handlers/learningCommands.js';
import { handleRun, handleRunGrant } from './runHandler.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { trackActivity } from '../middleware/admin.js';

const aiLimit = rateLimit({ max: 10, windowMs: 60_000, message: '⏳ AI limit: 10 requests/min. Please wait.' });
const runLimit = rateLimit({ max: 5, windowMs: 60_000, message: '⏳ Run limit: 5 executions/min. Please wait.' });

function args(ctx, cmd) {
  return ctx.message.text.replace(cmd, '').trim().split(' ');
}

export function registerCommands(bot) {
  bot.use(trackActivity);

  // Onboarding
  bot.start(handleOnboardingStart);
  bot.command('setup_profile', handleSetupProfile);
  bot.command('help', handleHelp);

  // Study
  bot.command('study', handleStudyMenu);
  bot.command('study_ask', aiLimit, (ctx) => handleStudyAsk(ctx, args(ctx, '/study_ask')));
  bot.command('study_assign', handleStudyAssign);
  bot.command('search', aiLimit, (ctx) => handleSearch(ctx, args(ctx, '/search')));

  // Routine
  bot.command('routine', handleRoutineMenu);
  bot.command('routine_today', handleRoutineToday);
  bot.command('routine_week', handleRoutineWeek);
  bot.command('routine_upload', handleRoutineUpload);
  bot.command('routine_clear', handleRoutineClear);

  // Profile
  bot.command('profile', handleProfileMenu);
  bot.command('profile_edit', (ctx) => handleProfileEdit(ctx, args(ctx, '/profile_edit')));
  bot.command('profile_stats', handleProfileStats);

  // Notes
  bot.command('notes', handleNotesCommand);
  bot.command('notes_add', handleNotesAdd);
  bot.command('notes_list', (ctx) => handleNotesList(ctx, args(ctx, '/notes_list')));
  bot.command('notes_search', (ctx) => handleNotesSearch(ctx, args(ctx, '/notes_search')));
  bot.command('notes_tags', handleNotesTags);
  bot.command('view_note', handleNoteViewCommand);

  // Admin
  bot.command('admin', handleAdminMenu);
  bot.command('admin_users', (ctx) => handleAdminUsers(ctx, args(ctx, '/admin_users')));
  bot.command('admin_broadcast', (ctx) => handleAdminBroadcast(ctx, args(ctx, '/admin_broadcast')));
  bot.command('admin_stats', _handleAdminStats);
  bot.command('admin_suspend', (ctx) => handleAdminSuspend(ctx, args(ctx, '/admin_suspend')));
  bot.command('admin_activate', (ctx) => handleAdminActivate(ctx, args(ctx, '/admin_activate')));
  bot.command('admin_promote', (ctx) => handleAdminPromote(ctx, args(ctx, '/admin_promote')));

  // Legacy aliases (kept for backward compat)
  bot.command('status', handleStatus);
  bot.command('ask', aiLimit, handleAsk);
  bot.command('assignments', handleAssignments);
  bot.command('upload_routine', handleUploadRoutine);
  bot.command('today', handleToday);
  bot.command('clear_routine', handleClearRoutine);
  bot.command('edit_profile', handleEditProfile);
  bot.command('admin_users_legacy', _handleAdminUsers);
  bot.command('admin_broadcast_legacy', _handleAdminBroadcast);
  bot.command('admin_suspend_legacy', _handleAdminSuspend);
  bot.command('admin_activate_legacy', _handleAdminActivate);
  bot.command('admin_make_admin', handleMakeAdmin);

  // Learning
  bot.command('learn', handleLearn);
  bot.command('learn_add', (ctx) => handleLearnAdd(ctx, args(ctx, '/learn_add')));
  bot.command('learn_status', (ctx) => handleLearnStatus(ctx, args(ctx, '/learn_status')));

  // Python Lab
  bot.command('run', runLimit, handleRun);
  bot.command('run_grant', (ctx) => handleRunGrant(ctx, args(ctx, '/run_grant')));

  // Callbacks
  bot.on('callback_query', (ctx) => {
    const data = ctx.callbackQuery.data;
    if (data.startsWith('menu_') || data.startsWith('study_') || data.startsWith('routine_') ||
        data.startsWith('profile_') || data.startsWith('notes_') || data.startsWith('admin_') ||
        data.startsWith('learn_') || data.startsWith('run_') || data.startsWith('session_')) {
      return handleMenuCallback(ctx);
    }
    if (data.startsWith('uni_')) return handleUniversityCallback(ctx);
    if (data.startsWith('dept_')) return handleDepartmentCallback(ctx);
    if (data.startsWith('reveal_') || data.startsWith('copy_') || data.startsWith('edit_') ||
        data.startsWith('confirm_delete_') || data.startsWith('delete_') || data.startsWith('cancel_delete_') ||
        data.startsWith('cat_') || data.startsWith('encrypt_')) {
      return handleNoteCallback(ctx);
    }
    return ctx.answerCbQuery();
  });

  // Text messages
  bot.on('text', async (ctx) => {
    if (!ctx.message.text.startsWith('/')) {
      const handled = await handleBotSession(ctx);
      if (handled) return;
      await handleOnboardingMessage(ctx);
      await handleNoteCreationMessage(ctx);
    }
  });

  // Media
  bot.on('photo', (ctx) => {
    const session = botSessionManager.get(ctx.from.id);
    if (session?.type === 'routine_upload') {
      botSessionManager.end(ctx.from.id);
      return handleUploadRoutine(ctx);
    }
    if (ctx.message.caption?.startsWith('/upload_routine')) return handleUploadRoutine(ctx);
  });

  bot.on('document', (ctx) => {
    const session = botSessionManager.get(ctx.from.id);
    if (session?.type === 'routine_upload') {
      botSessionManager.end(ctx.from.id);
      return handleUploadRoutine(ctx);
    }
    if (ctx.message.caption?.startsWith('/upload_routine')) return handleUploadRoutine(ctx);
  });

  bot.catch(handleError);
}
