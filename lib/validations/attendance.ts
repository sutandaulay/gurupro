import { z } from 'zod';

// Enum untuk status dan tipe
const AttendanceTypeSchema = z.enum(['masuk', 'pulang', 'mengajar_mulai', 'mengajar_selesai']);
const AttendanceStatusSchema = z.enum(['valid', 'flagged', 'rejected']);
const AssignmentStatusSchema = z.enum(['aktif', 'nonaktif']);
const LeaveRequestTypeSchema = z.enum(['sakit', 'izin', 'cuti']);
const LeaveRequestStatusSchema = z.enum(['pending', 'approved', 'rejected']);
const AttendanceSummaryStatusSchema = z.enum(['hadir', 'telat', 'alpa', 'izin', 'cuti']);

// Schema untuk Teacher Institution Assignments
export const TeacherInstitutionAssignmentSchema = z.object({
  teacherId: z.string().uuid(),
  institutionId: z.string().uuid(),
  subjectIds: z.array(z.string().uuid()).optional(),
  weeklySchedule: z.record(z.string(), z.unknown()).optional(), // JSONB untuk jadwal mingguan
  status: AssignmentStatusSchema.default('aktif'),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

export type TeacherInstitutionAssignment = z.infer<typeof TeacherInstitutionAssignmentSchema>;

// Schema untuk Attendance Devices
export const AttendanceDeviceSchema = z.object({
  teacherId: z.string().uuid(),
  browserFingerprint: z.string(),
  deviceLabel: z.string().max(100).optional(),
  registeredAt: z.date().default(() => new Date()),
  lastSeenAt: z.date().optional(),
  isActive: z.boolean().default(true),
});

export type AttendanceDevice = z.infer<typeof AttendanceDeviceSchema>;

// Schema untuk Attendance Logs
export const AttendanceLogSchema = z.object({
  teacherId: z.string().uuid(),
  institutionId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  type: AttendanceTypeSchema,
  classSessionId: z.string().uuid().optional().nullable(),
  subjectId: z.string().uuid().optional().nullable(),
  timestamp: z.date(),
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number(),
  ipAddress: z.string().max(45).optional(), // IPv6 support
  distanceFromInstitution: z.number(),
  faceMatchScore: z.number().min(0).max(1),
  livenessPassed: z.boolean(),
  qrCodeVerified: z.boolean().optional().nullable(),
  browserFingerprint: z.string().optional(),
  trustScore: z.number().min(0).max(1),
  status: AttendanceStatusSchema.default('valid'),
  flagReasons: z.array(z.string()).optional(),
});

export type AttendanceLog = z.infer<typeof AttendanceLogSchema>;

// Schema untuk Attendance Summary
export const AttendanceSummarySchema = z.object({
  teacherId: z.string().uuid(),
  institutionId: z.string().uuid(),
  date: z.date(),
  checkInTime: z.date().optional().nullable(),
  checkOutTime: z.date().optional().nullable(),
  teachingSessionsCompleted: z.number().int().nonnegative().default(0),
  teachingMinutesTotal: z.number().int().nonnegative().default(0),
  teachingMinutesBySubject: z.record(z.string(), z.number()).optional(), // JSONB breakdown menit per mapel
  attendanceStatus: AttendanceSummaryStatusSchema,
  lateMinutes: z.number().nonnegative().default(0),
});

export type AttendanceSummary = z.infer<typeof AttendanceSummarySchema>;

// Schema untuk Leave Requests
export const LeaveRequestSchema = z.object({
  teacherId: z.string().uuid(),
  institutionId: z.string().uuid(),
  type: LeaveRequestTypeSchema,
  startDate: z.date(),
  endDate: z.date(),
  reason: z.string().min(10),
  attachmentUrl: z.string().url().optional().nullable(),
  status: LeaveRequestStatusSchema.default('pending'),
  approvedBy: z.string().uuid().optional().nullable(),
  approvedAt: z.date().optional().nullable(),
});

export type LeaveRequest = z.infer<typeof LeaveRequestSchema>;