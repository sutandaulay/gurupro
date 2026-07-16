import { pgTable, uuid, varchar, integer, boolean, timestamp, numeric } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  nama_lengkap: varchar('nama_lengkap', { length: 255 }),
  role: varchar('role', { length: 50 }).default('guru'),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

// Institutions table
export const institutions = pgTable('institutions', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 255 }).notNull(),
  address: varchar('address', { length: 500 }),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
  locationLatitude: numeric('location_latitude'),
  locationLongitude: numeric('location_longitude'),
  attendanceRadiusMeters: numeric('attendance_settings_attendance_radius_meters'),
  classSessionRadiusMeters: numeric('attendance_settings_class_session_radius_meters'),
  lateToleranceMinutes: numeric('attendance_settings_late_tolerance_minutes'),
  duplicateCheckMinutes: numeric('attendance_settings_duplicate_check_minutes'),
  qrCodeEnabled: boolean('attendance_settings_qr_code_enabled'),
  qrCodeToken: varchar('attendance_settings_qr_code_token', { length: 255 }),
});

// Relations - will be set up after attendance schema is loaded
export const usersRelations = relations(users, ({ many }) => ({
  // teacherInstitutionAssignments from attendance.ts
}));

export const institutionsRelations = relations(institutions, ({ many }) => ({
  // teacherInstitutionAssignments from attendance.ts
}));

// Helper to format database columns to the expected grouped objects
export function formatInstitution(inst: any) {
  if (!inst) return null;
  return {
    ...inst,
    location: {
      latitude: inst.locationLatitude ? parseFloat(inst.locationLatitude) : -6.2088,
      longitude: inst.locationLongitude ? parseFloat(inst.locationLongitude) : 106.8456,
    },
    attendanceSettings: {
      attendanceRadiusMeters: inst.attendanceRadiusMeters ? parseFloat(inst.attendanceRadiusMeters) : 100,
      classSessionRadiusMeters: inst.classSessionRadiusMeters ? parseFloat(inst.classSessionRadiusMeters) : 150,
      lateToleranceMinutes: inst.lateToleranceMinutes ? parseFloat(inst.lateToleranceMinutes) : 10,
      duplicateCheckMinutes: inst.duplicateCheckMinutes ? parseFloat(inst.duplicateCheckMinutes) : 5,
      qrCodeEnabled: !!inst.qrCodeEnabled,
      qrCodeToken: inst.qrCodeToken,
    }
  };
}

// Import the relation types for other schemas
export { relations };

