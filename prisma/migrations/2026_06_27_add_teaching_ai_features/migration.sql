-- ============================================
-- GuruPRO AI Teaching Features Migration
-- Created: 2026-06-27
-- ============================================

-- 1. Add auto_generated column to teacher_journals
ALTER TABLE teacher_journals ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT false;
ALTER TABLE teacher_journals ADD COLUMN IF NOT EXISTS source_schedule_id UUID;

COMMENT ON COLUMN teacher_journals.auto_generated IS 'Flag untuk menandai jurnal yang di-generate otomatis oleh AI';
COMMENT ON COLUMN teacher_journals.source_schedule_id IS 'Referensi ke jadwal sumber untuk tracking';

-- 2. Create teaching_sessions table
CREATE TABLE IF NOT EXISTS teaching_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schedule_id UUID,
    class_id UUID,
    subject_id UUID,
    school_id UUID,
    session_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    attendance_completed BOOLEAN DEFAULT false,
    journal_generated BOOLEAN DEFAULT false,
    reflection_generated BOOLEAN DEFAULT false,
    followup_generated BOOLEAN DEFAULT false,
    attendance_data JSONB DEFAULT '[]',
    journal_id UUID,
    ai_reflection TEXT,
    ai_followup TEXT,
    completed_at TIMESTAMP(6),
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_teaching_sessions_user_date ON teaching_sessions(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_teaching_sessions_status ON teaching_sessions(user_id, status);

-- 3. Create lesson_memories table
CREATE TABLE IF NOT EXISTS lesson_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schedule_id UUID NOT NULL,
    last_topic VARCHAR(255),
    last_subtopic VARCHAR(255),
    last_page_number INTEGER DEFAULT 0,
    last_date DATE,
    next_recommendations TEXT,
    notes TEXT,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lesson_memories_user_schedule ON lesson_memories(user_id, schedule_id);

-- 4. Create raport_cache table
CREATE TABLE IF NOT EXISTS raport_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    subject_id UUID NOT NULL,
    assessment_id UUID,
    nilai DECIMAL(5,2) NOT NULL,
    ai_description TEXT NOT NULL,
    generated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, subject_id, assessment_id)
);

CREATE INDEX IF NOT EXISTS idx_raport_cache_student ON raport_cache(student_id);

-- 5. Create absent_alerts table
CREATE TABLE IF NOT EXISTS absent_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    absence_count INTEGER DEFAULT 0,
    last_absent_date DATE NOT NULL,
    alert_sent BOOLEAN DEFAULT false,
    whatsapp_message TEXT,
    sent_at TIMESTAMP(6),
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_absent_alerts_user ON absent_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_absent_alerts_student ON absent_alerts(student_id);

-- 6. Create admin_tasks table
CREATE TABLE IF NOT EXISTS admin_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_type VARCHAR(50) NOT NULL,
    task_title VARCHAR(255) NOT NULL,
    related_id UUID,
    status VARCHAR(50) DEFAULT 'pending',
    due_date DATE,
    priority VARCHAR(20) DEFAULT 'normal',
    description TEXT,
    completed_at TIMESTAMP(6),
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_tasks_user_status ON admin_tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_due_date ON admin_tasks(user_id, due_date);

-- 7. Create ai_chat_logs table
CREATE TABLE IF NOT EXISTS ai_chat_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    action_type VARCHAR(50),
    action_data JSONB DEFAULT '{}',
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_session ON ai_chat_logs(user_id, session_id);

-- ============================================
-- DATA MIGRATION (optional, for existing data)
-- ============================================

-- Update existing teacher_journals to set auto_generated = false
UPDATE teacher_journals SET auto_generated = false WHERE auto_generated IS NULL;

-- ============================================
-- METADATA
-- ============================================

-- Insert migration record (optional)
-- INSERT INTO _prisma_migrations (migration_name, logs, rolled_back_at, started_at, finished_at)
-- VALUES ('2026_06_27_add_teaching_ai_features', '', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
