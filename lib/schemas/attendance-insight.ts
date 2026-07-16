import { pgTable, uuid, varchar, integer, timestamp, jsonb, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users, institutions } from './main-schema'; // Sesuaikan path dengan schema utama Anda

// Tabel untuk menyimpan insight presensi AI
export const attendanceInsights = pgTable(
  'attendance_insights',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => users.id),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id),
    periodType: varchar('period_type', { length: 10 }).notNull(), // 'weekly', 'monthly'
    periodStart: timestamp('period_start').notNull(),
    periodEnd: timestamp('period_end').notNull(),
    insightData: jsonb('insight_data'), // JSON untuk menyimpan hasil insight AI
    teachingMinutesTotal: integer('teaching_minutes_total').default(0),
    teachingSessionsCompleted: integer('teaching_sessions_completed').default(0),
    attendanceDays: integer('attendance_days').default(0),
    lateDays: integer('late_days').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    teacherInstitutionPeriodKey: primaryKey({ 
      columns: [table.teacherId, table.institutionId, table.periodType, table.periodStart] 
    }),
    teacherIdx: table.teacherId,
    institutionIdx: table.institutionId,
    periodIdx: table.periodStart,
  })
);

export const attendanceInsightsRelations = relations(attendanceInsights, ({ one }) => ({
  teacher: one(users, {
    fields: [attendanceInsights.teacherId],
    references: [users.id],
  }),
  institution: one(institutions, {
    fields: [attendanceInsights.institutionId],
    references: [institutions.id],
  }),
}));