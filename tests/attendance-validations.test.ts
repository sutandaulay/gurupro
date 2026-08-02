import { describe, it, expect } from 'vitest'

import {
  TeacherInstitutionAssignmentSchema,
  AttendanceDeviceSchema,
  AttendanceLogSchema,
  AttendanceSummarySchema,
  LeaveRequestSchema,
} from '@/lib/validations/attendance'

describe('Attendance Validations', () => {
  describe('TeacherInstitutionAssignmentSchema', () => {
    it('validates valid assignment', () => {
      const validData = {
        teacherId: '50e096cc-9dc2-4403-b731-5506088ddc32',
        institutionId: '8606e992-1379-41ef-8834-e834e9312dee',
        subjectIds: ['a4715dcc-c46f-4ee6-9ee8-71bc734084b6'],
        weeklySchedule: { senin: '07:00-08:00', selasa: '08:00-09:00' },
        status: 'aktif',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
      }
      expect(() => TeacherInstitutionAssignmentSchema.parse(validData)).not.toThrow()
    })

    it('defaults status to aktif', () => {
      const data = {
        teacherId: '50e096cc-9dc2-4403-b731-5506088ddc32',
        institutionId: '8606e992-1379-41ef-8834-e834e9312dee',
      }
      const result = TeacherInstitutionAssignmentSchema.parse(data)
      expect(result.status).toBe('aktif')
    })

    it('rejects invalid UUID', () => {
      const data = {
        teacherId: 'invalid-uuid',
        institutionId: '8606e992-1379-41ef-8834-e834e9312dee',
      }
      expect(() => TeacherInstitutionAssignmentSchema.parse(data)).toThrow()
    })

    it('rejects invalid status', () => {
      const data = {
        teacherId: '50e096cc-9dc2-4403-b731-5506088ddc32',
        institutionId: '8606e992-1379-41ef-8834-e834e9312dee',
        status: 'invalid',
      }
      expect(() => TeacherInstitutionAssignmentSchema.parse(data)).toThrow()
    })
  })

  describe('AttendanceDeviceSchema', () => {
    it('validates valid device', () => {
      const validData = {
        teacherId: '50e096cc-9dc2-4403-b731-5506088ddc32',
        browserFingerprint: 'abc123',
        deviceLabel: 'Chrome on Windows',
        registeredAt: new Date(),
        isActive: true,
      }
      expect(() => AttendanceDeviceSchema.parse(validData)).not.toThrow()
    })

    it('defaults registeredAt to now', () => {
      const data = {
        teacherId: '50e096cc-9dc2-4403-b731-5506088ddc32',
        browserFingerprint: 'abc123',
      }
      const result = AttendanceDeviceSchema.parse(data)
      expect(result.registeredAt).toBeInstanceOf(Date)
      expect(result.isActive).toBe(true)
    })

    it('rejects deviceLabel over 100 chars', () => {
      const data = {
        teacherId: '50e096cc-9dc2-4403-b731-5506088ddc32',
        browserFingerprint: 'abc123',
        deviceLabel: 'a'.repeat(101),
      }
      expect(() => AttendanceDeviceSchema.parse(data)).toThrow()
    })
  })

  describe('AttendanceLogSchema', () => {
    const validBaseLog = {
      teacherId: '50e096cc-9dc2-4403-b731-5506088ddc32',
      institutionId: '8606e992-1379-41ef-8834-e834e9312dee',
      assignmentId: 'a70db632-5e6a-4654-8eeb-90646814500d',
      type: 'masuk',
      timestamp: new Date(),
      latitude: -6.2088,
      longitude: 106.8456,
      accuracy: 10,
      distanceFromInstitution: 50,
      faceMatchScore: 0.95,
      livenessPassed: true,
      qrCodeVerified: false,
      trustScore: 0.9,
    }

    it('validates valid attendance log', () => {
      expect(() => AttendanceLogSchema.parse(validBaseLog)).not.toThrow()
    })

    it('defaults status to valid', () => {
      const result = AttendanceLogSchema.parse(validBaseLog)
      expect(result.status).toBe('valid')
    })

    it('validates faceMatchScore range', () => {
      const invalidLog = { ...validBaseLog, faceMatchScore: 1.5 }
      expect(() => AttendanceLogSchema.parse(invalidLog)).toThrow()

      const invalidLog2 = { ...validBaseLog, faceMatchScore: -0.1 }
      expect(() => AttendanceLogSchema.parse(invalidLog2)).toThrow()
    })

    it('validates trustScore range', () => {
      const invalidLog = { ...validBaseLog, trustScore: 1.5 }
      expect(() => AttendanceLogSchema.parse(invalidLog)).toThrow()

      const invalidLog2 = { ...validBaseLog, trustScore: -0.1 }
      expect(() => AttendanceLogSchema.parse(invalidLog2)).toThrow()
    })

    it('accepts optional classSessionId and subjectId', () => {
      const logWithSession = {
        ...validBaseLog,
        classSessionId: 'a70db632-5e6a-4654-8eeb-90646814500d',
        subjectId: 'a4715dcc-c46f-4ee6-9ee8-71bc734084b6',
      }
      expect(() => AttendanceLogSchema.parse(logWithSession)).not.toThrow()
    })

    it('accepts null classSessionId and subjectId', () => {
      const logWithNulls = {
        ...validBaseLog,
        classSessionId: null,
        subjectId: null,
      }
      expect(() => AttendanceLogSchema.parse(logWithNulls)).not.toThrow()
    })

    it('rejects invalid attendance type', () => {
      const invalidLog = { ...validBaseLog, type: 'invalid' as any }
      expect(() => AttendanceLogSchema.parse(invalidLog)).toThrow()
    })

    it('rejects invalid status', () => {
      const invalidLog = { ...validBaseLog, status: 'pending' as any }
      expect(() => AttendanceLogSchema.parse(invalidLog)).toThrow()
    })

    it('rejects invalid UUIDs', () => {
      const invalidLog = { ...validBaseLog, teacherId: 'invalid' }
      expect(() => AttendanceLogSchema.parse(invalidLog)).toThrow()
    })
  })

  describe('AttendanceSummarySchema', () => {
    it('validates valid summary', () => {
      const validData = {
        teacherId: '50e096cc-9dc2-4403-b731-5506088ddc32',
        institutionId: '8606e992-1379-41ef-8834-e834e9312dee',
        date: new Date('2025-01-15'),
        checkInTime: new Date('2025-01-15T07:00:00'),
        checkOutTime: new Date('2025-01-15T15:00:00'),
        teachingSessionsCompleted: 4,
        teachingMinutesTotal: 180,
        teachingMinutesBySubject: { 'MATEMATIKA': 90, 'FISIKA': 90 },
        attendanceStatus: 'hadir',
        lateMinutes: 0,
      }
      expect(() => AttendanceSummarySchema.parse(validData)).not.toThrow()
    })

    it('validates attendanceStatus enum', () => {
      const baseData = {
        teacherId: '50e096cc-9dc2-4403-b731-5506088ddc32',
        institutionId: '8606e992-1379-41ef-8834-e834e9312dee',
        date: new Date('2025-01-15'),
        teachingSessionsCompleted: 0,
        teachingMinutesTotal: 0,
        attendanceStatus: 'hadir',
        lateMinutes: 0,
      }

      expect(() => AttendanceSummarySchema.parse({ ...baseData, attendanceStatus: 'hadir' })).not.toThrow()
      expect(() => AttendanceSummarySchema.parse({ ...baseData, attendanceStatus: 'telat' })).not.toThrow()
      expect(() => AttendanceSummarySchema.parse({ ...baseData, attendanceStatus: 'alpa' })).not.toThrow()
      expect(() => AttendanceSummarySchema.parse({ ...baseData, attendanceStatus: 'izin' })).not.toThrow()
      expect(() => AttendanceSummarySchema.parse({ ...baseData, attendanceStatus: 'cuti' })).not.toThrow()

      expect(() => AttendanceSummarySchema.parse({ ...baseData, attendanceStatus: 'invalid' })).toThrow()
    })

    it('validates non-negative integers', () => {
      const baseData = {
        teacherId: '50e096cc-9dc2-4403-b731-5506088ddc32',
        institutionId: '8606e992-1379-41ef-8834-e834e9312dee',
        date: new Date('2025-01-15'),
        teachingSessionsCompleted: 0,
        teachingMinutesTotal: 0,
        attendanceStatus: 'hadir' as const,
        lateMinutes: 0,
      }

      expect(() => AttendanceSummarySchema.parse({ ...baseData, teachingSessionsCompleted: -1 })).toThrow()
      expect(() => AttendanceSummarySchema.parse({ ...baseData, teachingMinutesTotal: -1 })).toThrow()
      expect(() => AttendanceSummarySchema.parse({ ...baseData, lateMinutes: -1 })).toThrow()
    })
  })

  describe('LeaveRequestSchema', () => {
    const validBaseRequest = {
      teacherId: '50e096cc-9dc2-4403-b731-5506088ddc32',
      institutionId: '8606e992-1379-41ef-8834-e834e9312dee',
      type: 'sakit',
      startDate: new Date('2025-01-15'),
      endDate: new Date('2025-01-17'),
      reason: 'Sakit demam tinggi sejak kemarin',
    }

    it('validates valid leave request', () => {
      expect(() => LeaveRequestSchema.parse(validBaseRequest)).not.toThrow()
    })

    it('defaults status to pending', () => {
      const result = LeaveRequestSchema.parse(validBaseRequest)
      expect(result.status).toBe('pending')
    })

    it('validates leave type enum', () => {
      expect(() => LeaveRequestSchema.parse({ ...validBaseRequest, type: 'sakit' })).not.toThrow()
      expect(() => LeaveRequestSchema.parse({ ...validBaseRequest, type: 'izin' })).not.toThrow()
      expect(() => LeaveRequestSchema.parse({ ...validBaseRequest, type: 'cuti' })).not.toThrow()
      expect(() => LeaveRequestSchema.parse({ ...validBaseRequest, type: 'invalid' as any })).toThrow()
    })

    it('validates reason minimum length', () => {
      expect(() => LeaveRequestSchema.parse({ ...validBaseRequest, reason: 'Sakit' })).toThrow()
      expect(() => LeaveRequestSchema.parse({ ...validBaseRequest, reason: 'Sakit demam' })).not.toThrow()
    })

    it('validates status enum', () => {
      expect(() => LeaveRequestSchema.parse({ ...validBaseRequest, status: 'pending' })).not.toThrow()
      expect(() => LeaveRequestSchema.parse({ ...validBaseRequest, status: 'approved' })).not.toThrow()
      expect(() => LeaveRequestSchema.parse({ ...validBaseRequest, status: 'rejected' })).not.toThrow()
      expect(() => LeaveRequestSchema.parse({ ...validBaseRequest, status: 'invalid' as any })).toThrow()
    })

    it('accepts optional attachmentUrl', () => {
      expect(() => LeaveRequestSchema.parse({
        ...validBaseRequest,
        attachmentUrl: 'https://example.com/attachment.pdf',
      })).not.toThrow()

      expect(() => LeaveRequestSchema.parse({
        ...validBaseRequest,
        attachmentUrl: null,
      })).not.toThrow()
    })

    it('rejects invalid attachmentUrl', () => {
      expect(() => LeaveRequestSchema.parse({
        ...validBaseRequest,
        attachmentUrl: 'not-a-url',
      })).toThrow()
    })
  })
})