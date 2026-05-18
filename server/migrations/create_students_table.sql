-- 1. Create students table
CREATE TABLE IF NOT EXISTS students (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL UNIQUE,
  username TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin', 'moderator')),
  university TEXT NOT NULL DEFAULT 'AMUST',
  department TEXT NOT NULL,
  batch INTEGER NOT NULL,
  university_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'GRADUATED')),
  is_active BOOLEAN DEFAULT TRUE,
  last_active_at TIMESTAMPTZ,
  total_commands INTEGER DEFAULT 0,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'bn')),
  daily_reminder_enabled BOOLEAN DEFAULT TRUE,
  daily_reminder_time TEXT DEFAULT '06:00',
  notifications_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for students
CREATE INDEX IF NOT EXISTS idx_students_telegram ON students(telegram_id);
CREATE INDEX IF NOT EXISTS idx_students_uni_dept_batch ON students(university, department, batch);
CREATE INDEX IF NOT EXISTS idx_students_role ON students(role);
CREATE INDEX IF NOT EXISTS idx_students_is_active ON students(is_active);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_students_updated_at ON students;
CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 2. Add missing columns to routines
ALTER TABLE routines ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS batch INTEGER;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS student_id BIGINT REFERENCES students(id);

-- Indexes for routines
CREATE INDEX IF NOT EXISTS idx_routines_uni_dept_batch ON routines(university, department, batch);
CREATE INDEX IF NOT EXISTS idx_routines_student_id ON routines(student_id);

-- 3. Add student_id to routine_uploads
ALTER TABLE routine_uploads ADD COLUMN IF NOT EXISTS student_id BIGINT REFERENCES students(id);
CREATE INDEX IF NOT EXISTS idx_routine_uploads_student_id ON routine_uploads(student_id);

-- 4. Backfill: populate student_id in routines from telegram_id
-- This links existing routines to the students table once students are synced
UPDATE routines r
SET student_id = s.id
FROM students s
WHERE r.telegram_id = s.telegram_id AND r.student_id IS NULL;

-- 5. RLS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON students FOR ALL USING (true);

-- 6. Helper function for incrementing command count
CREATE OR REPLACE FUNCTION increment_command_count(p_telegram_id BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE students
  SET total_commands = COALESCE(total_commands, 0) + 1,
      last_active_at = NOW()
  WHERE telegram_id = p_telegram_id;
END;
$$ LANGUAGE plpgsql;
