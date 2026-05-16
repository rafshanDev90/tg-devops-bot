import { supabase } from '../db/supabase.js';
import { cache } from '../utils/cache.js';
import { SupabaseError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { safeExecute } from '../utils/asyncHandler.js';

const CACHE_TTL = 300;
const CACHE_PREFIX = 'routine:';

export class RoutineService {
  constructor(routineAgent) {
    this.agent = routineAgent;
  }

  async uploadRoutine(telegramId, text, fileType = 'text') {
    if (!supabase.isReady) {
      throw new SupabaseError('Supabase is not configured');
    }

    const parsed = await this.agent.parseRoutine(text);
    if (!parsed.length) {
      throw new ValidationError('No valid classes found in routine');
    }

    const rows = parsed.map((entry) => ({
      telegram_id: telegramId,
      ...entry,
    }));

    const inserted = await supabase.insert('routines', rows);

    await safeExecute(async () => {
      await supabase.insert('routine_uploads', [{
        telegram_id: telegramId,
        file_type: fileType,
        status: 'parsed',
      }]);
    });

    cache.invalidatePrefix(`${CACHE_PREFIX}${telegramId}`);
    logger.info('RoutineService', `Uploaded ${inserted.length} classes for user ${telegramId}`);

    return {
      success: true,
      classesAdded: inserted.length,
      classes: inserted,
    };
  }

  async getTodayClasses(telegramId) {
    if (!supabase.isReady) return [];

    const cacheKey = `${CACHE_PREFIX}${telegramId}:today`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const dayName = this._getCurrentDayBDT();

    const classes = await safeExecute(async () => {
      return supabase.query('routines', {
        filters: { telegram_id: telegramId, day_of_week: dayName },
        order: { column: 'start_time', ascending: true },
      });
    }, []);

    cache.set(cacheKey, classes, CACHE_TTL);
    return classes;
  }

  async getFullRoutine(telegramId) {
    if (!supabase.isReady) return [];

    const cacheKey = `${CACHE_PREFIX}${telegramId}:full`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const classes = await safeExecute(async () => {
      return supabase.query('routines', {
        filters: { telegram_id: telegramId },
        order: { column: 'start_time', ascending: true },
      });
    }, []);

    const sorted = classes?.sort((a, b) => {
      const dayDiff = dayOrder.indexOf(a.day_of_week) - dayOrder.indexOf(b.day_of_week);
      return dayDiff !== 0 ? dayDiff : a.start_time.localeCompare(b.start_time);
    });

    cache.set(cacheKey, sorted, CACHE_TTL);
    return sorted;
  }

  async clearRoutine(telegramId) {
    if (!supabase.isReady) {
      throw new SupabaseError('Supabase is not configured');
    }

    await supabase.delete('routines', { telegram_id: telegramId });
    cache.invalidatePrefix(`${CACHE_PREFIX}${telegramId}`);
    logger.info('RoutineService', `Cleared routine for user ${telegramId}`);
  }

  async getAllUsersForDay(dayOfWeek) {
    if (!supabase.isReady) return [];

    return safeExecute(async () => {
      return supabase.query('routines', {
        filters: { day_of_week: dayOfWeek },
        order: { column: 'start_time', ascending: true },
      });
    }, []);
  }

  _getCurrentDayBDT() {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const now = new Date();
    const bdtTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
    return days[bdtTime.getDay()];
  }
}
