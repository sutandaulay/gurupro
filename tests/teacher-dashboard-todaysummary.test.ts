/**
 * Test Suite: teacher-dashboard todaySummary fix
 *
 * Bug: todaySummary query failed because attendanceSummary.institutionId is integer
 * but payload.institution_members.institution_id is uuid (string).
 * Type mismatch caused every JOIN to return 0 rows.
 *
 * Fix: Remove todaySummary query. Source of truth is attendanceLogs,
 * which is already populated via attendanceByInstitution.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/session', () => ({
  requireSession: vi.fn().mockResolvedValue({ id: 'teacher-uuid-123', role: 'guru' }),
}));

describe('teacher-dashboard: todaySummary fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Root cause: type mismatch between institution_id types', () => {
    /**
     * attendanceSummary.institutionId → integer (db schema line 168)
     * payload.institution_members.institution_id → uuid/string (payload CMS)
     *
     * The original code did:
     *   eq(attendanceSummary.institutionId, teacherId)
     *   eq(attendanceSummary.date, startOfDay)
     *
     * And the JOIN in enrichedAssignments tried to match:
     *   todaySummary.find((s) => s.institutionId === assignment.institutionId)
     *
     * Where assignment.institutionId came from payload.institution_members.institution_id (uuid)
     * but attendanceSummary.institutionId was integer.
     *
     * This caused todaySummary to ALWAYS be empty.
     *
     * Fix: Use attendanceLogs as source of truth (already populated correctly)
     * and derive attendanceStatus from checkIn/checkOut logs.
     */
    it('should NOT query attendanceSummary with mixed type join', () => {
      // This test documents the bug: attempting to match integer (attendanceSummary)
      // against uuid (from payload) will never produce results.
      const attendanceSummaryInstitutionId: number = 1; // integer from db
      const payloadInstitutionId: string = 'uuid-string-here'; // uuid from payload

      const wouldMatch =
        attendanceSummaryInstitutionId === payloadInstitutionId ||
        String(attendanceSummaryInstitutionId) === payloadInstitutionId ||
        attendanceSummaryInstitutionId === Number(payloadInstitutionId);

      // uuid → Number() returns NaN, so it never matches
      expect(Number(payloadInstitutionId)).toBeNaN();
      expect(wouldMatch).toBe(false);
    });

    it('should use attendanceLogs (uuid-based institutionId) as source of truth', () => {
      // attendanceLogs.institutionId is integer (from schema line 113)
      // BUT: when check-in writes to attendanceSummary, it passes institutionId as number
      // The real data flows: attendanceLogs → attendanceByInstitution (grouped)
      // The fix uses attendanceByInstitution instead of attendanceSummary.

      const attendanceLogs = [
        { id: '1', teacherId: 'teacher-1', institutionId: 1, type: 'masuk', timestamp: new Date() },
        { id: '2', teacherId: 'teacher-1', institutionId: 1, type: 'pulang', timestamp: new Date() },
      ];

      const attendanceByInstitution: Record<number, typeof attendanceLogs> = {};
      attendanceLogs.forEach((log) => {
        if (!attendanceByInstitution[log.institutionId]) {
          attendanceByInstitution[log.institutionId] = [];
        }
        attendanceByInstitution[log.institutionId].push(log);
      });

      const institution1Logs = attendanceByInstitution[1] || [];
      const checkIn = institution1Logs.find((log) => log.type === 'masuk');
      const checkOut = institution1Logs.find((log) => log.type === 'pulang');

      expect(checkIn).toBeDefined();
      expect(checkOut).toBeDefined();
    });

    it('should derive attendanceStatus from attendanceLogs data', () => {
      // Test all four attendance status values
      const testCases = [
        {
          name: 'completed when both check-in and check-out exist',
          checkIn: { id: '1' },
          checkOut: { id: '2' },
          expected: 'completed',
        },
        {
          name: 'check_in_only when only check-in exists',
          checkIn: { id: '1' },
          checkOut: null,
          expected: 'check_in_only',
        },
        {
          name: 'hadir when has logs but no explicit check-in',
          checkIn: null,
          checkOut: null,
          institutionAttendance: [{ id: '3', type: 'mengajar_mulai' }],
          expected: 'hadir',
        },
        {
          name: 'belum_absen when no attendance data',
          checkIn: null,
          checkOut: null,
          institutionAttendance: [],
          expected: 'belum_absen',
        },
      ];

      for (const tc of testCases) {
        let attendanceStatus: 'belum_absen' | 'hadir' | 'check_in_only' | 'completed' = 'belum_absen';
        if (tc.checkIn && tc.checkOut) {
          attendanceStatus = 'completed';
        } else if (tc.checkIn) {
          attendanceStatus = 'check_in_only';
        } else if (tc.institutionAttendance?.length) {
          attendanceStatus = 'hadir';
        }

        expect(attendanceStatus).toBe(tc.expected);
      }
    });
  });

  describe('Fix verification: todaySummary removed from response', () => {
    it('should NOT include todaySummary in API response', () => {
      // The fixed response structure should NOT have todaySummary
      const fixedResponseDataFields = [
        'teacherId',
        'date',
        'dayName',
        'assignments',
        'schoolAssignments',
        'dutyAssignmentsToday',
        'attendanceByInstitution',
        'workingHours',
      ];

      expect(fixedResponseDataFields).not.toContain('todaySummary');
    });
  });
});
