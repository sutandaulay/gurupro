import { pgTable, uuid, varchar, integer, boolean, timestamp, doublePrecision, jsonb, primaryKey, index, numeric, date, text } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users, institutions, formatInstitution, schools } from './main-schema';

// Re-export institutions, formatInstitution, and schools for convenience
export { institutions, formatInstitution, schools };

// Institution Members table
export const institutionMembers = pgTable(
  'institution_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: varchar('role', { length: 50 }).notNull().default('guru'),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    joinedAt: timestamp('joined_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    institutionUserIdx: index('idx_institution_members_institution_user').on(table.institutionId, table.userId),
    userIdx: index('idx_institution_members_user').on(table.userId),
  })
);

export const institutionMembersRelations = relations(institutionMembers, ({ one }) => ({
  institution: one(institutions, {
    fields: [institutionMembers.institutionId],
    references: [institutions.id],
  }),
  user: one(users, {
    fields: [institutionMembers.userId],
    references: [users.id],
  }),
}));

// Tabel untuk assignment guru ke institusi (many-to-many)
export const teacherInstitutionAssignments = pgTable(
  'teacher_institution_assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => users.id),
    institutionId: integer('institution_id')
      .notNull()
      .references(() => institutions.id),
    subjectIds: jsonb('subject_ids'), // array UUIDs
    weeklySchedule: jsonb('weekly_schedule'), // JSONB untuk jadwal mingguan
    status: varchar('status', { length: 20 }).notNull().default('aktif'), // 'aktif', 'nonaktif'
    startDate: timestamp('start_date'),
    endDate: timestamp('end_date'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    teacherInstitutionIdx: index('idx_teacher_institution_assignments_teacher_id').on(table.teacherId),
    institutionIdx: index('idx_teacher_institution_assignments_institution_id').on(table.institutionId),
  })
);

export const teacherInstitutionAssignmentsRelations = relations(teacherInstitutionAssignments, ({ one }) => ({
  teacher: one(users, {
    fields: [teacherInstitutionAssignments.teacherId],
    references: [users.id],
  }),
  institution: one(institutions, {
    fields: [teacherInstitutionAssignments.institutionId],
    references: [institutions.id],
  }),
}));

// Tabel untuk fingerprint perangkat presensi
export const attendanceDevices = pgTable(
  'attendance_devices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => users.id),
    browserFingerprint: varchar('browser_fingerprint', { length: 255 }).notNull(),
    deviceLabel: varchar('device_label', { length: 100 }), // nama yang bisa diedit user
    registeredAt: timestamp('registered_at').defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at'),
    isActive: boolean('is_active').default(true),
  },
  (table) => ({
    teacherIdx: index('idx_attendance_devices_teacher_id').on(table.teacherId),
    fingerprintIdx: index('idx_attendance_devices_fingerprint').on(table.browserFingerprint),
  })
);

export const attendanceDevicesRelations = relations(attendanceDevices, ({ one }) => ({
  teacher: one(users, {
    fields: [attendanceDevices.teacherId],
    references: [users.id],
  }),
}));

// Tabel untuk log presensi (event-level)
export const attendanceLogs = pgTable(
  'attendance_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => users.id),
    institutionId: integer('institution_id')
      .notNull()
      .references(() => institutions.id),
    assignmentId: varchar('assignment_id', { length: 255 })
      .notNull(),
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
  },
  (table) => ({
    teacherTimestampIdx: index('idx_attendance_logs_teacher_timestamp').on(table.teacherId, table.timestamp),
    teacherInstitutionDateIdx: index('idx_attendance_logs_teacher_institution_date').on(table.teacherId, table.institutionId, table.timestamp),
    assignmentIdx: index('idx_attendance_logs_assignment_id').on(table.assignmentId),
  })
);

export const attendanceLogsRelations = relations(attendanceLogs, ({ one }) => ({
  teacher: one(users, {
    fields: [attendanceLogs.teacherId],
    references: [users.id],
  }),
  institution: one(institutions, {
    fields: [attendanceLogs.institutionId],
    references: [institutions.id],
  }),
  assignment: one(teacherInstitutionAssignments, {
    fields: [attendanceLogs.assignmentId],
    references: [teacherInstitutionAssignments.id],
  }),
}));

// Tabel untuk ringkasan presensi harian
export const attendanceSummary = pgTable(
  'attendance_summary',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => users.id),
    institutionId: integer('institution_id')
      .notNull()
      .references(() => institutions.id),
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
    teacherInstitutionDateIdx: index('idx_attendance_summary_teacher_institution_date').on(table.teacherId, table.institutionId, table.date),
  })
);

export const attendanceSummaryRelations = relations(attendanceSummary, ({ one }) => ({
  teacher: one(users, {
    fields: [attendanceSummary.teacherId],
    references: [users.id],
  }),
  institution: one(institutions, {
    fields: [attendanceSummary.institutionId],
    references: [institutions.id],
  }),
}));

// Tabel untuk permintaan izin/cuti
export const leaveRequests = pgTable(
  'leave_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => users.id),
    institutionId: integer('institution_id')
      .references(() => institutions.id),
    schoolId: uuid('school_id')
      .references(() => schools.id),
    type: varchar('type', { length: 20 }).notNull(), // 'sakit', 'izin', 'cuti'
    startDate: timestamp('start_date').notNull(),
    endDate: timestamp('end_date').notNull(),
    reason: varchar('reason').notNull(),
    attachmentUrl: varchar('attachment_url'),
    status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending', 'approved', 'rejected'
    approvedBy: uuid('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    teacherIdx: index('idx_leave_requests_teacher_id').on(table.teacherId),
    institutionIdx: index('idx_leave_requests_institution_id').on(table.institutionId),
    schoolIdx: index('idx_leave_requests_school_id').on(table.schoolId),
    statusIdx: index('idx_leave_requests_status').on(table.status),
  })
);

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  teacher: one(users, {
    fields: [leaveRequests.teacherId],
    references: [users.id],
  }),
  institution: one(institutions, {
    fields: [leaveRequests.institutionId],
    references: [institutions.id],
  }),
  school: one(schools, {
    fields: [leaveRequests.schoolId],
    references: [schools.id],
  }),
  approver: one(users, {
    fields: [leaveRequests.approvedBy],
    references: [users.id],
    relationName: 'approver',
  }),
}));

// Teaching sessions for school-based teachers
export const schoolTeachingSessions = pgTable(
  'school_teaching_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    schoolId: uuid('school_id').notNull(),
    subjectId: varchar('subject_id', { length: 255 }),
    classId: varchar('class_id', { length: 255 }),
    startedAt: timestamp('started_at'),
    endedAt: timestamp('ended_at'),
    durationMinutes: integer('duration_minutes'),
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),
    accuracy: numeric('accuracy', { precision: 10, scale: 2 }),
    faceMatchScore: numeric('face_match_score', { precision: 4, scale: 3 }),
    livenessPassed: boolean('liveness_passed').default(false),
    status: varchar('status', { length: 50 }).default('active'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('idx_school_teaching_sessions_user_id').on(table.userId),
    schoolIdx: index('idx_school_teaching_sessions_school_id').on(table.schoolId),
    statusIdx: index('idx_school_teaching_sessions_status').on(table.status),
  })
);

export const schoolTeachingSessionsRelations = relations(schoolTeachingSessions, ({ one }) => ({
  user: one(users, {
    fields: [schoolTeachingSessions.userId],
    references: [users.id],
  }),
  school: one(schools, {
    fields: [schoolTeachingSessions.schoolId],
    references: [schools.id],
  }),
}));

export const teacherAttendance = pgTable(
  'teacher_attendance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    schoolId: uuid('school_id').notNull().references(() => schools.id),
    tanggal: date('tanggal').notNull(),
    status: varchar('status', { length: 50 }).notNull(),
    catatan: text('catatan'),
    checkInTime: timestamp('check_in_time'),
    checkOutTime: timestamp('check_out_time'),
    faceMatchScore: numeric('face_match_score', { precision: 4, scale: 3 }),
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),
    accuracy: numeric('accuracy', { precision: 10, scale: 2 }),
    livenessPassed: boolean('liveness_passed').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
);