import 'dotenv/config';
import { Telegraf } from 'telegraf';
import http from 'http';
import mongoose from 'mongoose';

import { registerCommands } from './src/bot/commands.js';
import { initRoutine } from './src/bot/handlers.js';
import { onboardingManager } from './src/services/onboardingManager.js';
import { noteSessionManager } from './src/notes/managers/sessionManager.js';
import { botSessionManager } from './src/bot/botSessionManager.js';
import { AIService } from './src/services/aiServices.js';
import { RoutineAgent } from './src/agents/routineAgent.js';
import { RoutineService } from './src/services/routineService.js';
import { DailyRoutineJob } from './src/jobs/dailyRoutine.js';
import { supabase } from './src/db/supabase.js';
import { executionService } from './src/services/executionService.js';
import { logger } from './src/utils/logger.js';

const { BOT_TOKEN, MONGODB_URI, GROQ_API_KEY, GEMINI_API_KEY } = process.env;
const PORT = parseInt(process.env.PORT, 10) || 3000;

if (!BOT_TOKEN || !MONGODB_URI || !GROQ_API_KEY || !GEMINI_API_KEY) {
  logger.error('Boot', 'Missing required environment variables');
  process.exit(1);
}
if (!process.env.E2B_API_KEY) logger.warn('Boot', 'E2B_API_KEY not set — /run disabled');
if (!process.env.TAVILY_API_KEY) logger.warn('Boot', 'TAVILY_API_KEY not set — web search disabled');

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
  { command: 'routine', description: 'Class schedule' },
  { command: 'notes',   description: 'Knowledge vault' },
  { command: 'learn',   description: 'Learning roadmap' },
  { command: 'run',     description: 'Run Python code in sandbox' },
  { command: 'status',  description: 'System health' },
]);

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
  mongoose.disconnect();
  dailyJob.stop();
  onboardingManager.stop();
  noteSessionManager.stop();
  botSessionManager.stop();
  await executionService.killAll();
  server.close();
  process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
