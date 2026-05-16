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
} from './src/bot/handlers.js';
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

bot.start(handleStart);
bot.command('status', handleStatus);
bot.command('ask', handleAsk);
bot.command('assignments', handleAssignments);
bot.command('help', handleHelp);
bot.command('upload_routine', handleUploadRoutine);
bot.command('today', handleToday);
bot.command('routine', handleRoutine);
bot.command('clear_routine', handleClearRoutine);

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

// Set bot commands for auto-suggestion
bot.telegram.setMyCommands([
  { command: 'start', description: 'Start the bot' },
  { command: 'today', description: 'Show today\'s classes' },
  { command: 'routine', description: 'Show weekly routine' },
  { command: 'upload_routine', description: 'Upload routine (image/text)' },
  { command: 'ask', description: 'Ask a study question' },
  { command: 'assignments', description: 'View assignments' },
  { command: 'status', description: 'Check system status' },
  { command: 'clear_routine', description: 'Clear your routine' },
  { command: 'help', description: 'Show help message' },
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
  server.close();
  process.exit(0);
});

process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  mongoose.disconnect();
  dailyJob.stop();
  server.close();
  process.exit(0);
});
