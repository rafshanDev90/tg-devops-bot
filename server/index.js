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
} from './src/bot/handlers.js';

const PORT = parseInt(process.env.PORT, 10) || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!BOT_TOKEN || !MONGODB_URI || !GROQ_API_KEY || !GEMINI_API_KEY) {
  console.error('Missing required environment variables:');
  if (!BOT_TOKEN) console.error('- BOT_TOKEN');
  if (!MONGODB_URI) console.error('- MONGODB_URI');
  if (!GROQ_API_KEY) console.error('- GROQ_API_KEY');
  if (!GEMINI_API_KEY) console.error('- GEMINI_API_KEY');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

mongoose.connect(MONGODB_URI, {
  maxPoolSize: 50,
  minPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 30000,
  heartbeatFrequencyMS: 10000,
}).then(() => console.log('MongoDB connected'))
  .catch((err) => { console.error('MongoDB connection error:', err); process.exit(1); });

bot.start(handleStart);
bot.command('status', handleStatus);
bot.command('ask', handleAsk);
bot.command('assignments', handleAssignments);
bot.command('help', handleHelp);
bot.catch(handleError);

bot.launch().then(() => console.log('Bot is running...'))
  .catch((err) => { console.error('Bot launch failed:', err); process.exit(1); });

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    const healthy = mongoose.connection.readyState === 1;
    res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: healthy ? 'ok' : 'degraded', uptime: process.uptime() }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is alive\n');
  }
});

server.listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`);
});

process.once('SIGINT', () => { bot.stop('SIGINT'); mongoose.disconnect(); server.close(); process.exit(0); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); mongoose.disconnect(); server.close(); process.exit(0); });
