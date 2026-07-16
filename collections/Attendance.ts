import { CollectionConfig } from 'payload/types';
import { Users } from './Users';
import { Institutions } from './Institutions';

// Konfigurasi untuk Teacher Institution Assignments
export const TeacherInstitutionAssignments: CollectionConfig = {
  slug: 'teacher-institution-assignments',
  admin: {
    useAsTitle: 'id',
    group: 'Presensi',
  },
  fields: [
    {
      name: 'teacherId',
      type: 'relationship',
      relationTo: 'cms-users',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'institutionId',
      type: 'relationship',
      relationTo: 'institutions',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'subjectIds',
      type: 'json', // Changed from relationship - subjects stored as JSON array of UUIDs
      label: 'Subject IDs',
      required: false,
    },
    {
      name: 'weeklySchedule',
      type: 'json',
      label: 'Jadwal Mingguan',
      required: false,
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Aktif', value: 'aktif' },
        { label: 'Nonaktif', value: 'nonaktif' },
      ],
      defaultValue: 'aktif',
      required: true,
    },
    {
      name: 'startDate',
      type: 'date',
      required: false,
    },
    {
      name: 'endDate',
      type: 'date',
      required: false,
    },
  ],
};

// Konfigurasi untuk Attendance Devices
export const AttendanceDevices: CollectionConfig = {
  slug: 'attendance-devices',
  admin: {
    useAsTitle: 'deviceLabel',
    group: 'Presensi',
  },
  fields: [
    {
      name: 'teacherId',
      type: 'relationship',
      relationTo: 'cms-users',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'browserFingerprint',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'deviceLabel',
      type: 'text',
      label: 'Nama Perangkat',
      required: false,
    },
    {
      name: 'registeredAt',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
    },
    {
      name: 'lastSeenAt',
      type: 'date',
      required: false,
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
};

// Konfigurasi untuk Attendance Logs
export const AttendanceLogs: CollectionConfig = {
  slug: 'attendance-logs',
  admin: {
    useAsTitle: 'id',
    group: 'Presensi',
    defaultColumns: ['teacherId', 'type', 'timestamp', 'status'],
  },
  fields: [
    {
      name: 'teacherId',
      type: 'relationship',
      relationTo: 'cms-users',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'institutionId',
      type: 'relationship',
      relationTo: 'institutions',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'assignmentId',
      type: 'relationship',
      relationTo: 'teacher-institution-assignments',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Masuk', value: 'masuk' },
        { label: 'Pulang', value: 'pulang' },
        { label: 'Mengajar Mulai', value: 'mengajar_mulai' },
        { label: 'Mengajar Selesai', value: 'mengajar_selesai' },
      ],
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'classSessionId',
      type: 'text', // Changed from relationship - class session stored as UUID string
      required: false,
    },
    {
      name: 'subjectId',
      type: 'text', // Changed from relationship - subject stored as UUID string
      required: false,
    },
    {
      name: 'timestamp',
      type: 'date',
      required: true,
    },
    {
      name: 'location',
      type: 'group',
      fields: [
        {
          name: 'latitude',
          type: 'number',
          required: true,
        },
        {
          name: 'longitude',
          type: 'number',
          required: true,
        },
        {
          name: 'accuracy',
          type: 'number',
          required: true,
          label: 'Akurasi (meter)',
        },
        {
          name: 'distanceFromInstitution',
          type: 'number',
          required: true,
          label: 'Jarak dari Institusi (meter)',
        },
      ],
    },
    {
      name: 'ipAddress',
      type: 'text',
      label: 'Alamat IP',
      required: false,
    },
    {
      name: 'verification',
      type: 'group',
      fields: [
        {
          name: 'faceMatchScore',
          type: 'number',
          min: 0,
          max: 1,
          required: true,
          label: 'Skor Cocok Wajah',
        },
        {
          name: 'livenessPassed',
          type: 'checkbox',
          required: true,
          label: 'Liveness Berhasil',
        },
        {
          name: 'qrCodeVerified',
          type: 'checkbox',
          required: false,
          label: 'Verifikasi QR Code',
        },
        {
          name: 'browserFingerprint',
          type: 'text',
          required: false,
        },
        {
          name: 'trustScore',
          type: 'number',
          min: 0,
          max: 1,
          required: true,
          label: 'Skor Kepercayaan',
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Valid', value: 'valid' },
        { label: 'Flagged', value: 'flagged' },
        { label: 'Rejected', value: 'rejected' },
      ],
      defaultValue: 'valid',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'flagReasons',
      type: 'array',
      label: 'Alasan Flag',
      required: false,
      fields: [
        {
          name: 'reason',
          type: 'text',
          required: true,
        },
      ],
    },
  ],
};

// Konfigurasi untuk Attendance Summary
export const AttendanceSummary: CollectionConfig = {
  slug: 'attendance-summary',
  admin: {
    useAsTitle: 'id',
    group: 'Presensi',
    defaultColumns: ['teacherId', 'date', 'attendanceStatus'],
  },
  fields: [
    {
      name: 'teacherId',
      type: 'relationship',
      relationTo: 'cms-users',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'institutionId',
      type: 'relationship',
      relationTo: 'institutions',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'checkInTime',
      type: 'date',
      required: false,
    },
    {
      name: 'checkOutTime',
      type: 'date',
      required: false,
    },
    {
      name: 'teachingSessionsCompleted',
      type: 'number',
      defaultValue: 0,
      label: 'Sesi Mengajar Selesai',
    },
    {
      name: 'teachingMinutesTotal',
      type: 'number',
      defaultValue: 0,
      label: 'Total Menit Mengajar',
    },
    {
      name: 'teachingMinutesBySubject',
      type: 'json',
      label: 'Menit Mengajar per Mata Pelajaran',
      required: false,
    },
    {
      name: 'attendanceStatus',
      type: 'select',
      options: [
        { label: 'Hadir', value: 'hadir' },
        { label: 'Telat', value: 'telat' },
        { label: 'Alpa', value: 'alpa' },
        { label: 'Izin', value: 'izin' },
        { label: 'Cuti', value: 'cuti' },
      ],
      required: true,
    },
    {
      name: 'lateMinutes',
      type: 'number',
      defaultValue: 0,
      label: 'Menit Terlambat',
    },
  ],
  indexes: [
    {
      name: 'idx_teacher_institution_date',
      fields: ['teacherId', 'institutionId', 'date'],
    },
  ],
};

// Konfigurasi untuk Leave Requests
export const LeaveRequests: CollectionConfig = {
  slug: 'leave-requests',
  admin: {
    useAsTitle: 'id',
    group: 'Presensi',
    defaultColumns: ['teacherId', 'type', 'startDate', 'status'],
  },
  fields: [
    {
      name: 'teacherId',
      type: 'relationship',
      relationTo: 'cms-users',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'institutionId',
      type: 'relationship',
      relationTo: 'institutions',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Sakit', value: 'sakit' },
        { label: 'Izin', value: 'izin' },
        { label: 'Cuti', value: 'cuti' },
      ],
      required: true,
    },
    {
      name: 'startDate',
      type: 'date',
      required: true,
    },
    {
      name: 'endDate',
      type: 'date',
      required: true,
    },
    {
      name: 'reason',
      type: 'textarea',
      required: true,
      minLength: 10,
    },
    {
      name: 'attachmentUrl',
      type: 'text',
      required: false,
      label: 'URL Lampiran',
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
      defaultValue: 'pending',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'approvedBy',
      type: 'relationship',
      relationTo: 'cms-users',
      required: false,
      label: 'Disetujui Oleh',
    },
    {
      name: 'approvedAt',
      type: 'date',
      required: false,
      label: 'Waktu Disetujui',
    },
  ],
};