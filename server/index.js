// index.js
import { Telegraf } from 'telegraf';
import http from 'http';

import dotenv from "dotenv"
dotenv.config()

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => ctx.reply('🚀 DevOps Bot Active! Use /status to check system health.'));
bot.command('status', (ctx) => {
    ctx.reply(`✅ System Status: Healthy\n⏰ Server Time: ${new Date().toISOString()}`);
});

bot.launch().then(() => console.log('🤖 Bot is running...'));
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is alive\n');
});

server.listen(PORT, () => {
    console.log(`🌐 Health check server listening on port ${PORT}`);
});

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
