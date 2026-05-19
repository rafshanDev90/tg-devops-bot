import 'dotenv/config';
import { Telegraf } from 'telegraf';
import http from 'http';
import mongoose from 'mongoose';

import {
  handleStart,
  handleStatus,
  handleAsk,
  handleAssignments,
  handleHelp,
  handleError,
  handleUploadRoutine,
  handleToday,
  handleRoutine,
  handleClearRoutine,
  initRoutine,
  handleProfile,
  handleEditProfile,
  handleProfileStats,
  handleMakeAdmin,
  handleStudyMenu,
  handleStudyAsk,
  handleStudyAssign,
  handleRoutineMenu,
  handleRoutineToday,
  handleRoutineWeek,
  handleRoutineUpload,
  handleRoutineClear,
  handleProfileMenu,
  handleProfileEdit,
  handleNotesMenu,
  handleNotesAdd,
  handleNotesList,
  handleNotesSearch,
  handleNotesTags,
  handleAdminMenu,
  handleAdminPromote,
  _handleAdminUsers,
  _handleAdminBroadcast,
  _handleAdminStats,
  _handleAdminSuspend,
  _handleAdminActivate,
} from './src/bot/handlers.js';
import {
  handleStart as handleOnboardingStart,
  handleOnboardingMessage,
  handleDepartmentCallback,
  handleUniversityCallback,
  handleSetupProfile,
} from './src/bot/onboardingHandlers.js';
import { handleMenuCallback } from './src/bot/menuHandler.js';
import {
  handleNotesCommand,
  handleNoteViewCommand,
  handleNoteCallback,
} from './src/notes/handlers/noteCommands.js';
import { handleNoteCreationMessage } from './src/notes/handlers/noteOnboarding.js';
import { noteSessionManager } from './src/notes/managers/sessionManager.js';
import { trackActivity } from './src/middleware/admin.js';
import { onboardingManager } from './src/services/onboardingManager.js';
import { AIService } from './src/services/aiServices.js';
import { RoutineAgent } from './src/agents/routineAgent.js';
import { RoutineService } from './src/services/routineService.js';
import { DailyRoutineJob } from './src/jobs/dailyRoutine.js';
import { supabase } from './src/db/supabase.js';
import { logger } from './src/utils/logger.js';

const PORT = parseInt(process.env.PORT, 10) || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!BOT_TOKEN || !MONGODB_URI || !GROQ_API_KEY || !GEMINI_API_KEY) {
  logger.error('Boot', 'Missing required environment variables');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

mongoose.connect(MONGODB_URI, {
  maxPoolSize: 50,
  minPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 30000,
  heartbeatFrequencyMS: 10000,
}).then(() => logger.info('MongoDB', 'Connected'))
  .catch((err) => { logger.error('MongoDB', 'Connection failed', { error: err.message }); process.exit(1); });

supabase.init();

const aiService = new AIService();
const routineAgent = new RoutineAgent(aiService);
const routineService = new RoutineService(routineAgent);
const dailyJob = new DailyRoutineJob(bot, routineService);

initRoutine(routineService, dailyJob);
dailyJob.start();

bot.use(trackActivity);

bot.start(handleOnboardingStart);
bot.command('setup_profile', handleSetupProfile);
bot.command('help', handleHelp);

bot.command('study', handleStudyMenu);
bot.command('study_ask', (ctx) => handleStudyAsk(ctx, ctx.message.text.replace('/study_ask', '').trim().split(' ')));
bot.command('study_assign', handleStudyAssign);

bot.command('routine', handleRoutineMenu);
bot.command('routine_today', handleRoutineToday);
bot.command('routine_week', handleRoutineWeek);
bot.command('routine_upload', handleRoutineUpload);
bot.command('routine_clear', handleRoutineClear);

bot.command('profile', handleProfileMenu);
bot.command('profile_edit', (ctx) => handleProfileEdit(ctx, ctx.message.text.replace('/profile_edit', '').trim().split(' ')));
bot.command('profile_stats', handleProfileStats);

bot.command('notes', handleNotesCommand);
bot.command('notes_add', handleNotesAdd);
bot.command('notes_list', (ctx) => handleNotesList(ctx, ctx.message.text.replace('/notes_list', '').trim().split(' ')));
bot.command('notes_search', (ctx) => handleNotesSearch(ctx, ctx.message.text.replace('/notes_search', '').trim().split(' ')));
bot.command('notes_tags', handleNotesTags);
bot.command('view_note', handleNoteViewCommand);

bot.command('admin', handleAdminMenu);
bot.command('admin_users', (ctx) => handleAdminUsers(ctx, ctx.message.text.replace('/admin_users', '').trim().split(' ')));
bot.command('admin_broadcast', (ctx) => handleAdminBroadcast(ctx, ctx.message.text.replace('/admin_broadcast', '').trim().split(' ')));
bot.command('admin_stats', _handleAdminStats);
bot.command('admin_suspend', (ctx) => handleAdminSuspend(ctx, ctx.message.text.replace('/admin_suspend', '').trim().split(' ')));
bot.command('admin_activate', (ctx) => handleAdminActivate(ctx, ctx.message.text.replace('/admin_activate', '').trim().split(' ')));
bot.command('admin_promote', (ctx) => handleAdminPromote(ctx, ctx.message.text.replace('/admin_promote', '').trim().split(' ')));

bot.command('status', handleStatus);
bot.command('ask', handleAsk);
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

bot.on('callback_query', (ctx) => {
  const data = ctx.callbackQuery.data;
  if (data.startsWith('menu_') || data.startsWith('study_') || data.startsWith('routine_') ||
      data.startsWith('profile_') || data.startsWith('notes_') || data.startsWith('admin_')) {
    return handleMenuCallback(ctx);
  }
  if (data.startsWith('uni_')) {
    return handleUniversityCallback(ctx);
  }
  if (data.startsWith('dept_')) {
    return handleDepartmentCallback(ctx);
  }
  if (data.startsWith('reveal_') || data.startsWith('copy_') || data.startsWith('edit_') ||
      data.startsWith('confirm_delete_') || data.startsWith('delete_') || data.startsWith('cancel_delete_') ||
      data.startsWith('cat_') || data.startsWith('encrypt_')) {
    return handleNoteCallback(ctx);
  }
  return ctx.answerCbQuery();
});

bot.on('text', async (ctx) => {
  if (ctx.message.text && !ctx.message.text.startsWith('/')) {
    await handleOnboardingMessage(ctx);
    await handleNoteCreationMessage(ctx);
  }
});

// Register handleUploadRoutine for photo and document as well, to support captions
bot.on('photo', (ctx) => {
  if (ctx.message.caption && ctx.message.caption.startsWith('/upload_routine')) {
    return handleUploadRoutine(ctx);
  }
});

bot.on('document', (ctx) => {
  if (ctx.message.caption && ctx.message.caption.startsWith('/upload_routine')) {
    return handleUploadRoutine(ctx);
  }
});

bot.catch(handleError);

// Set bot commands for auto-suggestion (clean menu)
bot.telegram.setMyCommands([
  { command: 'start', description: 'Main menu' },
  { command: 'help', description: 'Command guide' },
  { command: 'profile', description: 'Profile & settings' },
  { command: 'study', description: 'Study assistant' },
  { command: 'routine', description: 'Class schedule' },
  { command: 'notes', description: 'Knowledge vault' },
  { command: 'status', description: 'System health' },
]);

bot.launch().then(() => logger.info('Bot', 'Running'))
  .catch((err) => { logger.error('Bot', 'Launch failed', { error: err.message }); process.exit(1); });

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    const healthy = mongoose.connection.readyState === 1;
    res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: healthy ? 'ok' : 'degraded',
      uptime: process.uptime(),
      supabase: supabase.isReady,
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is alive\n');
  }
});

server.listen(PORT, () => {
  logger.info('HTTP', `Listening on port ${PORT}`);
});

process.once('SIGINT', () => {
  bot.stop('SIGINT');
  mongoose.disconnect();
  dailyJob.stop();
  onboardingManager.stop();
  noteSessionManager.stop();
  server.close();
  process.exit(0);
});

process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  mongoose.disconnect();
  dailyJob.stop();
  onboardingManager.stop();
  noteSessionManager.stop();
  server.close();
  process.exit(0);
});
