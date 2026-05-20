import { supabase } from '../db/supabase.js';
import { cache } from '../utils/cache.js';
import { SupabaseError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { safeExecute } from '../utils/asyncHandler.js';
import { getCurrentDayBDT } from '../utils/time.js';

const CACHE_TTL = 300;
const CACHE_PREFIX = 'routine:';
const SHARED_PREFIX = 'routine:shared:';

export class RoutineService {
  constructor(routineAgent) {
    this.agent = routineAgent;
  }

  async uploadRoutine(telegramId, studentId, text, fileType = 'text', university = null, department = null, batch = null) {
    if (!supabase.isReady) {
      throw new SupabaseError('Supabase is not configured');
    }

    const parsed = await this.agent.parseRoutine(text);
    if (!parsed.length) {
      throw new ValidationError('No valid classes found in routine');
    }

    const rows = parsed.map((entry) => ({
      telegram_id: telegramId,
      student_id: studentId,
      university: university,
      department: department,
      batch: batch,
      ...entry,
    }));

    const inserted = await supabase.insert('routines', rows);

    await safeExecute(async () => {
      await supabase.insert('routine_uploads', [{
        telegram_id: telegramId,
        student_id: studentId,
        file_type: fileType,
        status: 'parsed',
      }]);
    });

    cache.invalidatePrefix(`${CACHE_PREFIX}${telegramId}`);
    if (department && batch) {
      cache.invalidatePrefix(`${SHARED_PREFIX}${university}_${department}_${batch}`);
    }
    logger.info('RoutineService', `Uploaded ${inserted.length} classes for user ${telegramId}`, { university, department, batch });

    return {
      success: true,
      classesAdded: inserted.length,
      classes: inserted,
    };
  }

  async getTodayClasses(telegramId, university = null, department = null, batch = null) {
    if (!supabase.isReady) return [];

    const cacheKey = `${CACHE_PREFIX}${telegramId}:today`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const dayName = getCurrentDayBDT();

    const filters = { telegram_id: telegramId, day_of_week: dayName };
    if (university) filters.university = university;
    if (department) filters.department = department;
    if (batch) filters.batch = batch;

    const classes = await safeExecute(async () => {
      return supabase.query('routines', {
        filters,
        order: { column: 'start_time', ascending: true },
      });
    }, []);

    cache.set(cacheKey, classes, CACHE_TTL);
    return classes;
  }

  async getSharedTodayClasses(university, department, batch) {
    if (!supabase.isReady) return [];

    const cacheKey = `${SHARED_PREFIX}${university}_${department}_${batch}:today`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const dayName = getCurrentDayBDT();

    const classes = await safeExecute(async () => {
      return supabase.query('routines', {
        filters: {
          university: university,
          department: department,
          batch: batch,
          day_of_week: dayName,
        },
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

  async getSharedFullRoutine(university, department, batch) {
    if (!supabase.isReady) return [];

    const cacheKey = `${SHARED_PREFIX}${university}_${department}_${batch}:full`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const classes = await safeExecute(async () => {
      return supabase.query('routines', {
        filters: {
          university: university,
          department: department,
          batch: batch,
        },
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

  async getRoutinesByDeptBatch(university, department, batch) {
    if (!supabase.isReady) return [];

    return safeExecute(async () => {
      return supabase.query('routines', {
        filters: { university, department, batch },
        order: { column: 'start_time', ascending: true },
      });
    }, []);
  }

}
