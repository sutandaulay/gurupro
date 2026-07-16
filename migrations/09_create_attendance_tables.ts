import { pgTable, uuid, varchar, integer, boolean, timestamp, doublePrecision, jsonb, primaryKey, index } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Client } from 'pg';

// Skema tabel untuk digunakan dalam migrasi
const teacherInstitutionAssignments = pgTable(
  'teacher_institution_assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teacherId: uuid('teacher_id'),
    institutionId: uuid('institution_id'),
    subjectIds: jsonb('subject_ids'), // array UUIDs
    weeklySchedule: jsonb('weekly_schedule'), // JSONB untuk jadwal mingguan
    status: varchar('status', { length: 20 }).notNull().default('aktif'), // 'aktif', 'nonaktif'
    startDate: timestamp('start_date'),
    endDate: timestamp('end_date'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }
);

const attendanceDevices = pgTable(
  'attendance_devices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teacherId: uuid('teacher_id'),
    browserFingerprint: varchar('browser_fingerprint', { length: 255 }).notNull(),
    deviceLabel: varchar('device_label', { length: 100 }), // nama yang bisa diedit user
    registeredAt: timestamp('registered_at').defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at'),
    isActive: boolean('is_active').default(true),
  }
);

const attendanceLogs = pgTable(
  'attendance_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teacherId: uuid('teacher_id'),
    institutionId: uuid('institution_id'),
    assignmentId: uuid('assignment_id'),
    type: varchar('type', { length: 20 }).notNull(), // 'masuk', 'pulang', 'mengajar_mulai', 'mengajar_selesai'
    classSessionId: uuid('class_session_id'), // relation ke jadwal kelas
    subjectId: uuid('subject_id'), // relation ke mata pelajaran
    timestamp: timestamp('timestamp').notNull(),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    accuracy: doublePrecision('accuracy'), // untuk deteksi anomali
    ipAddress: varchar('ip_address', { length: 45 }), // support IPv6
    distanceFromInstitution: doublePrecision('distance_from_institution'),
    faceMatchScore: doublePrecision('face_match_score'), // 0-1
    livenessPassed: boolean('liveness_passed').notNull(),
    qrCodeVerified: boolean('qr_code_verified'), // jika institusi mengaktifkan QR
    browserFingerprint: varchar('browser_fingerprint', { length: 255 }),
    trustScore: doublePrecision('trust_score'), // 0-1 skor gabungan anti-fraud
    status: varchar('status', { length: 20 }).notNull().default('valid'), // 'valid', 'flagged', 'rejected'
    flagReasons: jsonb('flag_reasons'), // array string alasan di-flag
    createdAt: timestamp('created_at').defaultNow().notNull(),
  }
);

const attendanceSummary = pgTable(
  'attendance_summary',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teacherId: uuid('teacher_id'),
    institutionId: uuid('institution_id'),
    date: timestamp('date', { mode: 'date' }).notNull(), // tanggal saja
    checkInTime: timestamp('check_in_time'),
    checkOutTime: timestamp('check_out_time'),
    teachingSessionsCompleted: integer('teaching_sessions_completed').default(0),
    teachingMinutesTotal: integer('teaching_minutes_total').default(0),
    teachingMinutesBySubject: jsonb('teaching_minutes_by_subject'), // breakdown menit per mapel
    attendanceStatus: varchar('attendance_status', { length: 20 }).notNull(), // 'hadir', 'telat', 'alpa', 'izin', 'cuti'
    lateMinutes: integer('late_minutes').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    // Composite unique key: teacherId + institutionId + date
    teacherInstitutionDateKey: primaryKey({ columns: [table.teacherId, table.institutionId, table.date] }),
  })
);

const leaveRequests = pgTable(
  'leave_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teacherId: uuid('teacher_id'),
    institutionId: uuid('institution_id'),
    type: varchar('type', { length: 20 }).notNull(), // 'sakit', 'izin', 'cuti'
    startDate: timestamp('start_date').notNull(),
    endDate: timestamp('end_date').notNull(),
    reason: varchar('reason').notNull(),
    attachmentUrl: varchar('attachment_url'),
    status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending', 'approved', 'rejected'
    approvedBy: uuid('approved_by'),
    approvedAt: timestamp('approved_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }
);

// Fungsi migrasi
export async function up(client: Client) {
  const db = drizzle(client);
  
  // Membuat tabel-tabel
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS teacher_institution_assignments (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      teacher_id UUID NOT NULL,
      institution_id UUID NOT NULL,
      subject_ids JSONB,
      weekly_schedule JSONB,
      status VARCHAR(20) NOT NULL DEFAULT 'aktif',
      start_date TIMESTAMP WITH TIME ZONE,
      end_date TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE INDEX idx_teacher_institution_assignments_teacher_id ON teacher_institution_assignments(teacher_id);
  `);

  await db.execute(sql`
    CREATE INDEX idx_teacher_institution_assignments_institution_id ON teacher_institution_assignments(institution_id);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS attendance_devices (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      teacher_id UUID NOT NULL,
      browser_fingerprint VARCHAR(255) NOT NULL,
      device_label VARCHAR(100),
      registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      last_seen_at TIMESTAMP WITH TIME ZONE,
      is_active BOOLEAN DEFAULT TRUE
    );
  `);

  await db.execute(sql`
    CREATE INDEX idx_attendance_devices_teacher_id ON attendance_devices(teacher_id);
  `);

  await db.execute(sql`
    CREATE INDEX idx_attendance_devices_fingerprint ON attendance_devices(browser_fingerprint);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS attendance_logs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      teacher_id UUID NOT NULL,
      institution_id UUID NOT NULL,
      assignment_id UUID NOT NULL,
      type VARCHAR(20) NOT NULL,
      class_session_id UUID,
      subject_id UUID,
      timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      accuracy DOUBLE PRECISION,
      ip_address VARCHAR(45),
      distance_from_institution DOUBLE PRECISION,
      face_match_score DOUBLE PRECISION,
      liveness_passed BOOLEAN NOT NULL,
      qr_code_verified BOOLEAN,
      browser_fingerprint VARCHAR(255),
      trust_score DOUBLE PRECISION,
      status VARCHAR(20) NOT NULL DEFAULT 'valid',
      flag_reasons JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE INDEX idx_attendance_logs_teacher_timestamp ON attendance_logs(teacher_id, timestamp);
  `);

  await db.execute(sql`
    CREATE INDEX idx_attendance_logs_teacher_institution_date ON attendance_logs(teacher_id, institution_id, timestamp);
  `);

  await db.execute(sql`
    CREATE INDEX idx_attendance_logs_assignment_id ON attendance_logs(assignment_id);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS attendance_summary (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      teacher_id UUID NOT NULL,
      institution_id UUID NOT NULL,
      date DATE NOT NULL,
      check_in_time TIMESTAMP WITH TIME ZONE,
      check_out_time TIMESTAMP WITH TIME ZONE,
      teaching_sessions_completed INTEGER DEFAULT 0,
      teaching_minutes_total INTEGER DEFAULT 0,
      teaching_minutes_by_subject JSONB,
      attendance_status VARCHAR(20) NOT NULL,
      late_minutes INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      CONSTRAINT pk_attendance_summary PRIMARY KEY (teacher_id, institution_id, date)
    );
  `);

  await db.execute(sql`
    CREATE INDEX idx_attendance_summary_teacher_institution_date ON attendance_summary(teacher_id, institution_id, date);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      teacher_id UUID NOT NULL,
      institution_id UUID NOT NULL,
      type VARCHAR(20) NOT NULL,
      start_date TIMESTAMP WITH TIME ZONE NOT NULL,
      end_date TIMESTAMP WITH TIME ZONE NOT NULL,
      reason VARCHAR NOT NULL,
      attachment_url VARCHAR,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      approved_by UUID,
      approved_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE INDEX idx_leave_requests_teacher_id ON leave_requests(teacher_id);
  `);

  await db.execute(sql`
    CREATE INDEX idx_leave_requests_institution_id ON leave_requests(institution_id);
  `);

  await db.execute(sql`
    CREATE INDEX idx_leave_requests_status ON leave_requests(status);
  `);
}

export async function down(client: Client) {
  const db = drizzle(client);
  
  // Menghapus indeks dan tabel dalam urutan terbalik
  await db.execute(sql`DROP INDEX IF EXISTS idx_leave_requests_status;`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_leave_requests_institution_id;`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_leave_requests_teacher_id;`);
  await db.execute(sql`DROP TABLE IF EXISTS leave_requests;`);

  await db.execute(sql`DROP INDEX IF EXISTS idx_attendance_summary_teacher_institution_date;`);
  await db.execute(sql`DROP TABLE IF EXISTS attendance_summary;`);

  await db.execute(sql`DROP INDEX IF EXISTS idx_attendance_logs_assignment_id;`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_attendance_logs_teacher_institution_date;`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_attendance_logs_teacher_timestamp;`);
  await db.execute(sql`DROP TABLE IF EXISTS attendance_logs;`);

  await db.execute(sql`DROP INDEX IF EXISTS idx_attendance_devices_fingerprint;`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_attendance_devices_teacher_id;`);
  await db.execute(sql`DROP TABLE IF EXISTS attendance_devices;`);

  await db.execute(sql`DROP INDEX IF EXISTS idx_teacher_institution_assignments_institution_id;`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_teacher_institution_assignments_teacher_id;`);
  await db.execute(sql`DROP TABLE IF EXISTS teacher_institution_assignments;`);
}