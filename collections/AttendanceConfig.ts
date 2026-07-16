import { TeacherInstitutionAssignments } from './Attendance';
import { AttendanceDevices } from './Attendance';
import { AttendanceLogs } from './Attendance';
import { AttendanceSummary } from './Attendance';
import { LeaveRequests } from './Attendance';

// Ekspor semua konfigurasi koleksi presensi dalam satu file
export {
  TeacherInstitutionAssignments,
  AttendanceDevices,
  AttendanceLogs,
  AttendanceSummary,
  LeaveRequests
};

// Array untuk digunakan dalam konfigurasi Payload
export const attendanceCollections = [
  TeacherInstitutionAssignments,
  AttendanceDevices,
  AttendanceLogs,
  AttendanceSummary,
  LeaveRequests,
];