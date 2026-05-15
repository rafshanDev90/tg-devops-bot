// index.js
import { Telegraf } from 'telegraf';

import dotenv from "dotenv"
dotenv.config()

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => ctx.reply('🚀 DevOps Bot Active! Use /status to check system health.'));
bot.command('status', (ctx) => {
    ctx.reply(`✅ System Status: Healthy\n⏰ Server Time: ${new Date().toISOString()}`);
});

bot.launch().then(() => console.log('🤖 Bot is running...'));

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
