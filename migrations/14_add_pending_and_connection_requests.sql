-- Migration: Tambah status 'pending' ke institution_members dan table connection_requests
-- UP
DO $$ BEGIN
  ALTER TYPE payload."enum_institution_members_status" ADD VALUE IF NOT EXISTS 'pending' BEFORE 'invited';
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS connection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution_id INTEGER NOT NULL REFERENCES payload.institutions(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  rejected_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conn_req_user ON connection_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_conn_req_institution ON connection_requests(institution_id);
CREATE INDEX IF NOT EXISTS idx_conn_req_status ON connection_requests(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_conn_req_user_inst_active ON connection_requests(user_id, institution_id) WHERE status = 'pending';
