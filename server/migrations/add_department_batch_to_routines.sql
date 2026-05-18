-- Add university, department and batch columns to routines table
ALTER TABLE routines ADD COLUMN IF NOT EXISTS university TEXT DEFAULT 'AMUST';
ALTER TABLE routines ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS batch INTEGER;

-- Add indexes for faster filtering
CREATE INDEX IF NOT EXISTS idx_routines_university ON routines(university);
CREATE INDEX IF NOT EXISTS idx_routines_department ON routines(department);
CREATE INDEX IF NOT EXISTS idx_routines_batch ON routines(batch);
CREATE INDEX IF NOT EXISTS idx_routines_uni_dept_batch ON routines(university, department, batch);
