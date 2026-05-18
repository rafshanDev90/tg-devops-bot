import { supabase } from '../db/supabase.js';
import { SupabaseError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export class StudentService {
  async syncStudent(studentDoc) {
    if (!supabase.isReady) return null;

    const row = {
      telegram_id: studentDoc.telegramId,
      name: studentDoc.name,
      username: studentDoc.username,
      role: studentDoc.role,
      university: studentDoc.academic.university,
      department: studentDoc.academic.department,
      batch: studentDoc.academic.batch,
      university_id: studentDoc.academic.universityId,
      status: studentDoc.academic.status,
      is_active: studentDoc.metadata.isActive,
      last_active_at: studentDoc.metadata.lastActiveAt,
      total_commands: studentDoc.metadata.totalCommands,
      onboarding_completed: studentDoc.metadata.onboardingCompleted,
      language: studentDoc.preferences?.language,
      daily_reminder_enabled: studentDoc.preferences?.dailyReminderEnabled,
      daily_reminder_time: studentDoc.preferences?.dailyReminderTime,
      notifications_enabled: studentDoc.preferences?.notificationsEnabled,
    };

    try {
      const { data, error } = await supabase.client
        .from('students')
        .upsert(row, { onConflict: 'telegram_id' })
        .select()
        .single();

      if (error) throw new Error(`${error.code}: ${error.message}`);
      logger.info('StudentService', 'Student synced to Supabase', { telegramId: studentDoc.telegramId });
      return data;
    } catch (err) {
      logger.error('StudentService', 'Failed to sync student', { error: err.message });
      return null;
    }
  }

  async getStudentByTelegramId(telegramId) {
    if (!supabase.isReady) return null;

    const { data, error } = await supabase.client
      .from('students')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (error) return null;
    return data;
  }

  async getStudentsByDeptBatch(university, department, batch) {
    if (!supabase.isReady) return [];

    const { data, error } = await supabase.client
      .from('students')
      .select('*')
      .eq('university', university)
      .eq('department', department)
      .eq('batch', batch)
      .eq('is_active', true);

    if (error) return [];
    return data;
  }

  async getActiveStudents() {
    if (!supabase.isReady) return [];

    const { data, error } = await supabase.client
      .from('students')
      .select('telegram_id, name, university, department, batch')
      .eq('is_active', true)
      .eq('onboarding_completed', true);

    if (error) return [];
    return data;
  }

  async updateLastActive(telegramId) {
    if (!supabase.isReady) return;

    await supabase.client
      .from('students')
      .update({ last_active_at: new Date().toISOString() })
      .eq('telegram_id', telegramId);
  }

  async incrementCommandCount(telegramId) {
    if (!supabase.isReady) return;

    await supabase.client.rpc('increment_command_count', { p_telegram_id: telegramId });
  }
}
