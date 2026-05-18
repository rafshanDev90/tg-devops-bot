import cron from 'node-cron';
import mongoose from 'mongoose';
import { Student } from '../models/Student.js';
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

    const students = await safeExecute(async () => {
      return Student.find({
        'metadata.isActive': true,
        'metadata.onboardingCompleted': true,
        'preferences.dailyReminderEnabled': true,
      }).lean();
    }, []);

    if (!students.length) {
      logger.info('DailyRoutineJob', 'No active students with reminders enabled');
      return;
    }

    let sentCount = 0;
    let failCount = 0;
    let noClassCount = 0;

    for (const student of students) {
      try {
        const classes = await this.service.getTodayClasses(
          student.telegramId,
          student.academic.university,
          student.academic.department,
          student.academic.batch
        );

        if (!classes.length) {
          noClassCount++;
          continue;
        }

        const message = this._buildMessage(dayName, classes, student.academic.department, student.academic.batch);
        await this.bot.telegram.sendMessage(student.telegramId, message, { parse_mode: 'HTML' });
        sentCount++;
      } catch (err) {
        failCount++;
        logger.error('DailyRoutineJob', `Failed to send to ${student.telegramId}`, { error: err.message });
      }
    }

    logger.info('DailyRoutineJob', `Notifications complete — Sent: ${sentCount}, No classes: ${noClassCount}, Failed: ${failCount}`);
  }

  _buildMessage(dayName, classes, department, batch) {
    const emojis = {
      '08': '🕗', '09': '🕘', '10': '🕙', '11': '🕚', '12': '🕛',
      '13': '🕐', '14': '🕑', '15': '🕒', '16': '🕓', '17': '🕔',
    };

    const header = `<b>📅 ${department} Batch ${batch} — ${dayName}</b>\n\n`;

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

  _getCurrentDayBDT() {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const now = new Date();
    const bdtTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
    return days[bdtTime.getDay()];
  }
}
