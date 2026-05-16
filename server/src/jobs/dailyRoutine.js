import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { safeExecute } from '../utils/asyncHandler.js';

export class DailyRoutineJob {
  constructor(bot, routineService) {
    this.bot = bot;
    this.service = routineService;
    this.cronTask = null;
  }

  start() {
    if (this.cronTask) {
      logger.warn('DailyRoutineJob', 'Cron job already running');
      return;
    }

    this.cronTask = cron.schedule('0 6 * * *', async () => {
      await this._sendDailyNotifications();
    }, {
      timezone: 'Asia/Dhaka',
    });

    logger.info('DailyRoutineJob', 'Started — runs daily at 6:00 AM BDT');
  }

  stop() {
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
      logger.info('DailyRoutineJob', 'Stopped');
    }
  }

  async runNow() {
    logger.info('DailyRoutineJob', 'Manual trigger');
    await this._sendDailyNotifications();
  }

  async _sendDailyNotifications() {
    const dayName = this._getCurrentDayBDT();
    logger.info('DailyRoutineJob', `Sending notifications for ${dayName}`);

    const allClasses = await safeExecute(async () => {
      return this.service.getAllUsersForDay(dayName);
    }, []);

    if (!allClasses.length) {
      logger.info('DailyRoutineJob', `No classes found for ${dayName}`);
      return;
    }

    const grouped = this._groupByTelegramId(allClasses);

    for (const [telegramId, classes] of grouped) {
      await safeExecute(async () => {
        const message = this._buildMessage(dayName, classes);
        await this.bot.telegram.sendMessage(telegramId, message, { parse_mode: 'HTML' });
        logger.debug('DailyRoutineJob', `Sent to ${telegramId} (${classes.length} classes)`);
      });
    }

    logger.info('DailyRoutineJob', `Notifications sent to ${grouped.size} users`);
  }

  _buildMessage(dayName, classes) {
    const emojis = {
      '08': '🕗', '09': '🕘', '10': '🕙', '11': '🕚', '12': '🕛',
      '13': '🕐', '14': '🕑', '15': '🕒', '16': '🕓', '17': '🕔',
    };

    const header = `<b>📅 Today's Schedule — ${dayName}</b>\n\n`;

    const lines = classes.map((c) => {
      const hour = c.start_time.slice(0, 2);
      const emoji = emojis[hour] || '⏰';
      const type = c.is_lab ? '🧪' : '📖';
      const teacher = c.teacher_name ? `| ${c.teacher_name}` : '';
      const room = c.room_number ? `| Room ${c.room_number}` : '';
      return `${emoji} ${c.start_time}-${c.end_time} ${type} <b>${c.subject_name}</b> ${room} ${teacher}`;
    });

    const nextClass = this._getNextClassInfo(classes);
    const footer = nextClass ? `\n⏰ <i>Next class in ${nextClass}</i>` : '';

    return header + lines.join('\n') + footer;
  }

  _getNextClassInfo(classes) {
    const now = new Date();
    const bdtTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
    const currentMinutes = bdtTime.getHours() * 60 + bdtTime.getMinutes();

    for (const c of classes) {
      const [h, m] = c.start_time.split(':').map(Number);
      const classMinutes = h * 60 + m;
      const diff = classMinutes - currentMinutes;
      if (diff > 0) {
        if (diff < 60) return `${diff} minutes`;
        const hours = Math.floor(diff / 60);
        const mins = diff % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours} hours`;
      }
    }
    return null;
  }

  _groupByTelegramId(classes) {
    const map = new Map();
    for (const c of classes) {
      const id = c.telegram_id;
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(c);
    }
    return map;
  }

  _getCurrentDayBDT() {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const now = new Date();
    const bdtTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
    return days[bdtTime.getDay()];
  }
}
