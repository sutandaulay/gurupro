-- Migration untuk user_school_assignments
CREATE TABLE IF NOT EXISTS user_school_assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId           UUID NOT NULL,
  schoolId         UUID NOT NULL,
  tahunAjaranId    UUID,
  isWaliKelas      BOOLEAN DEFAULT false,
  createdAt        TIMESTAMP DEFAULT NOW(),
  UNIQUE(userId, schoolId, tahunAjaranId)
);
CREATE INDEX IF NOT EXISTS idx_usa_user ON user_school_assignments(userId);
CREATE INDEX IF NOT EXISTS idx_usa_school ON user_school_assignments(schoolId);
