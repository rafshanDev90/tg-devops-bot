import 'dotenv/config';
import { Telegraf } from 'telegraf';
import http from 'http';
import mongoose from 'mongoose';

import { registerCommands } from './src/bot/commands.js';
import { initRoutine } from './src/bot/handlers.js';
import { onboardingManager } from './src/services/onboardingManager.js';
import { noteSessionManager } from './src/notes/managers/sessionManager.js';
import { botSessionManager } from './src/bot/botSessionManager.js';
import { multiLineSessionManager } from './src/bot/multiLineSessionManager.js';
import { codeSessionManager } from './src/bot/codeSessionManager.js';
import { AIService } from './src/services/aiServices.js';
import { RoutineAgent } from './src/agents/routineAgent.js';
import { RoutineService } from './src/services/routineService.js';
import { DailyRoutineJob } from './src/jobs/dailyRoutine.js';
import { supabase } from './src/db/supabase.js';
import { executionService } from './src/services/executionService.js';
import { logger } from './src/utils/logger.js';

// Global error handlers prevent crashes on unhandled rejections
process.on('unhandledRejection', (reason) => {
  logger.error('Process', 'Unhandled rejection', { error: reason?.message || String(reason) });
});
process.on('uncaughtException', (err) => {
  logger.error('Process', 'Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

const { BOT_TOKEN, MONGODB_URI, GROQ_API_KEY, GEMINI_API_KEY } = process.env;
const PORT = parseInt(process.env.PORT, 10) || 3000;

if (!BOT_TOKEN || !MONGODB_URI || !GROQ_API_KEY || !GEMINI_API_KEY) {
  logger.error('Boot', 'Missing required environment variables');
  process.exit(1);
}
if (!process.env.E2B_API_KEY) logger.warn('Boot', 'E2B_API_KEY not set — /run disabled');
if (!process.env.TAVILY_API_KEY) logger.warn('Boot', 'TAVILY_API_KEY not set — web search disabled');
if (!process.env.NOTES_ENCRYPTION_KEY) logger.warn('Boot', 'NOTES_ENCRYPTION_KEY not set — notes encryption disabled');
if (!process.env.SUPABASE_API_URL) logger.warn('Boot', 'SUPABASE_API_URL not set — Supabase features disabled');
if (!process.env.SUPABASE_SERVICE_KEY) logger.warn('Boot', 'SUPABASE_SERVICE_KEY not set — Supabase features disabled');

// ── Database ──────────────────────────────────────────────────────────────────
mongoose.connect(MONGODB_URI, {
  maxPoolSize: 50,
  minPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 30000,
  heartbeatFrequencyMS: 10000,
}).then(() => logger.info('MongoDB', 'Connected'))
  .catch((err) => { logger.error('MongoDB', 'Connection failed', { error: err.message }); process.exit(1); });

supabase.init();

// ── Services ──────────────────────────────────────────────────────────────────
const bot = new Telegraf(BOT_TOKEN);


const aiService = new AIService();
const routineAgent = new RoutineAgent(aiService);
const routineService = new RoutineService(routineAgent);
const dailyJob = new DailyRoutineJob(bot, routineService);

// ── Bot ───────────────────────────────────────────────────────────────────────

initRoutine(routineService, dailyJob);
dailyJob.start();

registerCommands(bot);

bot.telegram.setMyCommands([
  { command: 'start',   description: 'Main menu' },
  { command: 'help',    description: 'Command guide' },
  { command: 'profile', description: 'Profile & settings' },
  { command: 'study',   description: 'Study assistant' },
  { command: 'search',  description: 'Web search with AI' },
  { command: 'learn',   description: 'Learning roadmap' },
  { command: 'run',     description: 'Run Python code in sandbox' },
  { command: 'status',  description: 'System health' },
]).catch((err) => logger.warn('Bot', 'setMyCommands failed (retrying on next launch)', { error: err.message }));

bot.launch()
  .then(() => logger.info('Bot', 'Running'))
  .catch((err) => { logger.error('Bot', 'Launch failed', { error: err.message }); process.exit(1); });

// ── HTTP health endpoint ──────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    const healthy = mongoose.connection.readyState === 1;
    res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: healthy ? 'ok' : 'degraded', uptime: process.uptime(), supabase: supabase.isReady }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is alive\n');
  }
});

server.listen(PORT, () => logger.info('HTTP', `Listening on port ${PORT}`));

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal) {
  logger.info('Bot', `Received ${signal}, shutting down…`);
  bot.stop(signal);
  await mongoose.disconnect();
  dailyJob.stop();
  onboardingManager.stop();
  noteSessionManager.stop();
  botSessionManager.stop();
  multiLineSessionManager.stop();
  codeSessionManager.stop();
  await executionService.killAll();
  await new Promise((resolve) => server.close(resolve));
  process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
