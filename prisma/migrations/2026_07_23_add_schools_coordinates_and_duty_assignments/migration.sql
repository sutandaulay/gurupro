-- Add school coordinates and attendance radius for independent teachers
ALTER TABLE schools 
  ADD COLUMN IF NOT EXISTS location_latitude DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS location_longitude DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS attendance_radius_meters INTEGER DEFAULT 100;

-- Create duty_assignments table for field assignments / seminars
CREATE TABLE IF NOT EXISTS duty_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL,
  school_id UUID,
  institution_id UUID,
  date DATE NOT NULL,
  purpose VARCHAR(255),
  location_latitude DECIMAL(10,7),
  location_longitude DECIMAL(10,7),
  radius_meters INTEGER DEFAULT 50,
  status VARCHAR(50) DEFAULT 'pending',
  approved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_duty_assignments_teacher_id ON duty_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_duty_assignments_date ON duty_assignments(date);
CREATE INDEX IF NOT EXISTS idx_duty_assignments_status ON duty_assignments(status);

-- Add verification columns to teacher_attendance for school-based attendance
ALTER TABLE teacher_attendance 
  ADD COLUMN IF NOT EXISTS face_match_score DECIMAL(4,3),
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS accuracy DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS liveness_passed BOOLEAN DEFAULT false;

-- Add school_id to leave_requests for independent teachers
ALTER TABLE leave_requests 
  ADD COLUMN IF NOT EXISTS school_id UUID;

-- Create school_teaching_sessions table for independent teachers
CREATE TABLE IF NOT EXISTS school_teaching_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  subject_id VARCHAR(255),
  class_id VARCHAR(255),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  accuracy DECIMAL(10,2),
  face_match_score DECIMAL(4,3),
  liveness_passed BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
