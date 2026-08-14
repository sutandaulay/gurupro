'use client';
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Building, AlertTriangle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { FaceCaptureWidget } from '@/components/attendance/FaceCaptureWidget';
import { GeoValidationBadge } from '@/components/attendance/GeoValidationBadge';
import { QRScanWidget } from '@/components/attendance/QRScanWidget';
import { AttendanceConfirmCard } from '@/components/attendance/AttendanceConfirmCard';
import { ScheduleSelector, type TeachingSession } from '@/components/attendance/ScheduleSelector';
import { SubjectSessionSelector, type Subject } from '@/components/attendance/SubjectSessionSelector';

// Types
interface Institution {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
  };
  attendanceSettings: {
    attendanceRadiusMeters: number;
    qrCodeEnabled: boolean;
  };
}

interface Assignment {
  id: string;
  institutionId: string;
  institutionName: string;
  institutionLocation: {
    latitude: number;
    longitude: number;
  };
  institutionSettings: {
    attendanceRadiusMeters: number;
    qrCodeEnabled: boolean;
  };
  subjects: Subject[];
  todaySchedule: string[];
  workingHours?: { start: string; end: string };
  status: 'aktif' | 'nonaktif';
  isSchool?: boolean;
  todayAttendance?: {
    status: 'belum_absen' | 'hadir' | 'check_in_only' | 'completed';
    checkIn?: any;
    checkOut?: any;
    teachingSessions?: any[];
  };
}

interface TeacherDashboard {
  teacherId: string;
  date: string;
  dayName: string;
  assignments: Assignment[];
  schoolAssignments: Assignment[];
  dutyAssignmentsToday: DutyAssignment[];
  workingHours: { start: string; end: string; currentTime: string };
}

interface DutyAssignment {
  id: string;
  teacherId: string;
  schoolId?: string;
  institutionId?: string;
  date: string;
  purpose?: string;
  locationLatitude?: number;
  locationLongitude?: number;
  radiusMeters?: number;
  status: string;
  approvedBy?: string;
  createdAt?: string;
}

interface AttendanceResult {
  type: 'check-in' | 'check-out';
  success: boolean;
  timestamp: string;
  institutionName: string;
  distanceFromInstitution?: number;
  faceMatchScore?: number;
  status?: 'valid' | 'flagged' | 'rejected';
  flagReasons?: string[];
  sessionId?: string;
  subjectName?: string;
}

export default function AttendancePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [dashboardData, setDashboardData] = useState<TeacherDashboard | null>(null);
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [selectedSessions, setSelectedSessions] = useState<TeachingSession[]>([]);
  const [activeSessions, setActiveSessions] = useState<TeachingSession[]>([]);
  const [showScheduleSelector, setShowScheduleSelector] = useState(false);
  const [view, setView] = useState<'institution-select' | 'schedule-select' | 'attendance'>('attendance');
  const [dutyAssignmentsToday, setDutyAssignmentsToday] = useState<DutyAssignment[]>([]);
  const [showDutyForm, setShowDutyForm] = useState(false);
  const [dutyForm, setDutyForm] = useState({ date: '', purpose: '', latitude: '', longitude: '', radiusMeters: 50 });
  const [submittingDuty, setSubmittingDuty] = useState(false);

  // Attendance state
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [attendanceResult, setAttendanceResult] = useState<AttendanceResult | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [faceEmbedding, setFaceEmbedding] = useState<string | null>(null);
  const [faceMatchScore, setFaceMatchScore] = useState<number | null>(null);
  const [livenessPassed, setLivenessPassed] = useState<boolean>(false);
  const [browserFingerprint, setBrowserFingerprint] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await apiFetch('/api/attendance/teacher-dashboard');
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Sesi tidak valid. Silakan login kembali.');
        }
        throw new Error('Gagal memuat data presensi');
      }

      const data = await res.json();
      setDashboardData(data.data);
      setDutyAssignmentsToday(data.data?.dutyAssignmentsToday || []);

      // Auto-select if only one assignment
      const allAssignments = [
        ...(data.data?.assignments || []),
        ...(data.data?.schoolAssignments || []),
      ];
      if (allAssignments.length === 1) {
        const assignment = allAssignments[0];
        setSelectedInstitution({
          id: assignment.institutionId,
          name: assignment.institutionName || 'Institusi',
          location: assignment.institutionLocation
            ? (typeof assignment.institutionLocation === 'string'
              ? JSON.parse(assignment.institutionLocation)
              : assignment.institutionLocation)
            : { latitude: -6.2, longitude: 106.8 },
          attendanceSettings: assignment.institutionSettings
            ? (typeof assignment.institutionSettings === 'string'
              ? JSON.parse(assignment.institutionSettings)
              : assignment.institutionSettings)
            : { attendanceRadiusMeters: 100, qrCodeEnabled: false },
        });
        setSelectedAssignment(assignment);

        // If already checked in, go to attendance view
        if (assignment.todayAttendance?.status !== 'belum_absen') {
          setView('attendance');
        } else {
          setShowScheduleSelector(true);
          setView('schedule-select');
        }
      }
    } catch (err: any) {
      console.error('Error fetching dashboard:', err);
      setError(err.message || 'Terjadi kesalahan saat mengambil data');
      toast.error(err.message || 'Gagal memuat data presensi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    // Generate browser fingerprint
    setBrowserFingerprint(generateBrowserFingerprint());
  }, [fetchDashboard]);

  // Generate browser fingerprint
  const generateBrowserFingerprint = (): string => {
    const fpData = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 'unknown',
      navigator.platform,
    ].join('|');
    let hash = 0;
    for (let i = 0; i < fpData.length; i++) {
      const char = fpData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  };

  // Get location
  const getLocation = (): Promise<{ latitude: number; longitude: number; accuracy: number }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        toast.warning('Geolocation tidak didukung, menggunakan lokasi simulasi');
        resolve({ latitude: -6.2088, longitude: 106.8456, accuracy: 10 });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        }),
        (error) => {
          console.warn('Geolocation error:', error);
          toast.warning('Akses GPS diblokir. Menggunakan lokasi simulasi.');
          resolve({ latitude: -6.2088, longitude: 106.8456, accuracy: 10 });
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  };

  // Update location
  const handleLocationUpdate = async () => {
    try {
      const loc = await getLocation();
      setLocation(loc);
      toast.success('Lokasi berhasil diperbarui');
    } catch (err: any) {
      toast.error('Gagal mendapatkan lokasi');
    }
  };

  // Handle face capture
  const handleFaceCapture = (data: { embedding: Float32Array | null; faceMatchScore: number; livenessPassed: boolean }) => {
    setFaceEmbedding(data.embedding ? JSON.stringify(Array.from(data.embedding)) : null);
    setFaceMatchScore(data.faceMatchScore);
    setLivenessPassed(data.livenessPassed);
    toast.success('Wajah berhasil diverifikasi!');
  };

  // Handle QR scan
  const handleQRScan = (token: string) => {
    setQrToken(token);
    toast.success('QR Code berhasil discan!');
  };

  // Handle institution selection
  const handleInstitutionSelect = (institution: Institution, assignment: Assignment) => {
    setSelectedInstitution(institution);
    setSelectedAssignment({ 
      ...assignment, 
      isSchool: !!dashboardData?.schoolAssignments?.find((a) => a.institutionId === assignment.institutionId) 
    });

    // Check if already checked in today
    if (assignment.todayAttendance?.status !== 'belum_absen') {
      setView('attendance');
      // Load active sessions
      const active = assignment.todayAttendance?.teachingSessions?.filter((s: any) => s.isActive) || [];
      setActiveSessions(active.map((s: any) => ({
        id: s.classSessionId,
        subjectId: s.subjectId || 'unknown',
        subjectName: s.subjectName || 'Unknown',
        startTime: s.timestamp ? new Date(s.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '00:00',
        endTime: '00:00',
      })));
    } else {
      setShowScheduleSelector(true);
      setView('schedule-select');
    }
  };

   // Handle schedule confirmation
   const handleScheduleConfirm = (sessions: TeachingSession[], checkInNow: boolean) => {
    setSelectedSessions(sessions);
    if (checkInNow) {
      const isSchool = selectedAssignment?.isSchool;
      if (isSchool) {
        handleCheckIn({ schoolId: selectedAssignment?.institutionId });
      } else {
        handleCheckIn();
      }
    } else {
      setView('attendance');
    }
  };

   // Check-in
   const handleCheckIn = async (options?: { schoolId?: string; dutyAssignmentId?: string; institutionId?: string }) => {
    const targetSchoolId = options?.schoolId;
    const targetDutyId = options?.dutyAssignmentId;
    const targetInstitutionId = options?.institutionId;
    const isSchool = !!targetSchoolId;

    if (!isSchool && !selectedInstitution && !targetInstitutionId) {
      toast.error('Pilih sekolah atau institusi terlebih dahulu');
      return;
    }

    if (!location) {
      toast.error('Harap perbarui lokasi terlebih dahulu');
      return;
    }

    if (faceMatchScore === null || livenessPassed === null) {
      toast.error('Verifikasi wajah belum lengkap');
      return;
    }

    setIsCheckingIn(true);
    try {
      let result: any;
      let successMessage = '';

      if (isSchool) {
        const today = new Date().toISOString().split('T')[0];
        const res = await apiFetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'teacher',
            school_id: targetSchoolId,
            tanggal: today,
            status: 'hadir',
            catatan: targetDutyId ? 'Presensi tugas luar dengan verifikasi wajah dan lokasi' : 'Presensi via aplikasi dengan verifikasi wajah dan lokasi',
            face_match_score: faceMatchScore,
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
            liveness_passed: livenessPassed,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Gagal check-in sekolah');
        }

        result = await res.json();
        successMessage = 'Presensi sekolah berhasil dicatat';
      } else {
        const response = await apiFetch('/api/attendance/check-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            faceEmbedding,
            faceMatchScore,
            livenessPassed,
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
            institutionId: targetInstitutionId || selectedInstitution?.id,
            assignmentId: targetDutyId || selectedAssignment?.id,
            qrCodeVerified: !!qrToken,
            browserFingerprint,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Gagal check-in');
        }

        result = await response.json();
        successMessage = result.message || 'Check-in berhasil!';
      }

      setAttendanceResult({
        ...result,
        type: 'check-in',
        timestamp: new Date().toLocaleString('id-ID'),
        institutionName: isSchool ? 'Sekolah Mandiri' : (targetInstitutionId ? selectedInstitution?.name : selectedInstitution?.name) || '',
      });
      setView('attendance');
      toast.success(successMessage);

      // Refresh dashboard
      fetchDashboard();
    } catch (err: any) {
      toast.error(err.message || 'Gagal check-in');
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Submit duty assignment
  const handleSubmitDuty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dutyForm.date || !dutyForm.purpose) {
      toast.error('Tanggal dan tujuan wajib diisi');
      return;
    }

    setSubmittingDuty(true);
    try {
      const res = await apiFetch('/api/attendance/duty-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dutyForm.date,
          purpose: dutyForm.purpose,
          location_latitude: dutyForm.latitude ? parseFloat(dutyForm.latitude) : null,
          location_longitude: dutyForm.longitude ? parseFloat(dutyForm.longitude) : null,
          radius_meters: dutyForm.radiusMeters,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal mengajukan');
      }

      toast.success('Pengajuan tugas luar berhasil dikirim');
      setShowDutyForm(false);
      setDutyForm({ date: '', purpose: '', latitude: '', longitude: '', radiusMeters: 50 });
      fetchDashboard();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengajukan tugas luar');
    } finally {
      setSubmittingDuty(false);
    }
  };

  // Check-out
  const handleCheckOut = async () => {
    if (!selectedInstitution || !location) {
      toast.error('Harap perbarui lokasi terlebih dahulu');
      return;
    }

    const isSchool = selectedAssignment?.isSchool === true;
    setIsCheckingOut(true);
    try {
      const response = isSchool
        ? await apiFetch('/api/attendance/school/check-out', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              school_id: selectedInstitution.id,
            }),
          })
        : await apiFetch('/api/attendance/check-out', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              faceEmbedding,
              faceMatchScore: faceMatchScore || 0.8,
              livenessPassed: livenessPassed ?? true,
              latitude: location.latitude,
              longitude: location.longitude,
              accuracy: location.accuracy,
              institutionId: selectedInstitution.id,
              assignmentId: selectedAssignment?.id,
              qrCodeVerified: !!qrToken,
              browserFingerprint,
            }),
          });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal check-out');
      }

      const result = await response.json();
      setAttendanceResult({
        ...result,
        type: 'check-out',
        timestamp: new Date().toLocaleString('id-ID'),
        institutionName: isSchool ? 'Sekolah Mandiri' : selectedInstitution.name,
      });
      toast.success('Check-out berhasil!');
      fetchDashboard();
    } catch (err: any) {
      toast.error(err.message || 'Gagal check-out');
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Start teaching session
  const handleStartTeaching = async (session: TeachingSession) => {
    setIsStartingSession(true);
    try {
      const response = await apiFetch('/api/attendance/teaching/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faceEmbedding,
          faceMatchScore: faceMatchScore || 0.8,
          livenessPassed: livenessPassed ?? true,
          latitude: location?.latitude || -6.2,
          longitude: location?.longitude || 106.8,
          accuracy: location?.accuracy || 10,
          institutionId: selectedInstitution?.id,
          assignmentId: selectedAssignment?.id,
          classSessionId: session.id,
          subjectId: session.subjectId,
          subjectName: session.subjectName,
          browserFingerprint,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal memulai sesi');
      }

      const result = await response.json();
      setActiveSessions((prev) => [...prev, { ...session, isActive: true }]);
      setAttendanceResult({
        ...result,
        type: 'teaching-start',
        timestamp: new Date().toLocaleString('id-ID'),
        institutionName: selectedInstitution?.name || '',
        sessionId: session.id,
        subjectName: session.subjectName,
      });
      toast.success(`Sesi "${session.subjectName}" dimulai!`);
      fetchDashboard();
    } catch (err: any) {
      toast.error(err.message || 'Gagal memulai sesi');
    } finally {
      setIsStartingSession(false);
    }
  };

  // End teaching session
  const handleEndTeaching = async (session: TeachingSession) => {
    try {
      const response = await apiFetch('/api/attendance/teaching/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faceEmbedding,
          faceMatchScore: faceMatchScore || 0.8,
          livenessPassed: livenessPassed ?? true,
          latitude: location?.latitude || -6.2,
          longitude: location?.longitude || 106.8,
          accuracy: location?.accuracy || 10,
          institutionId: selectedInstitution?.id,
          assignmentId: selectedAssignment?.id,
          classSessionId: session.id,
          subjectId: session.subjectId,
          subjectName: session.subjectName,
          browserFingerprint,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal mengakhiri sesi');
      }

      const result = await response.json();
      setActiveSessions((prev) => prev.filter((s) => s.id !== session.id));
      setAttendanceResult({
        ...result,
        type: 'teaching-end',
        timestamp: new Date().toLocaleString('id-ID'),
        institutionName: selectedInstitution?.name || '',
        sessionId: session.id,
        subjectName: session.subjectName,
      });
      toast.success(`Sesi "${session.subjectName}" selesai!`);
      fetchDashboard();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengakhiri sesi');
    }
  };

  // Calculate distance
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-6 w-48 mb-1" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" />
                Presensi Harian
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <div className="mt-3">
                <Button size="sm" onClick={fetchDashboard}>Coba Lagi</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

   // Institution selection view
   if (view === 'institution-select' && dashboardData) {
    const institutions = (dashboardData.assignments || []).map((a) => ({
      id: a.institutionId,
      name: a.institutionName || 'Institusi',
      location: a.institutionLocation
        ? (typeof a.institutionLocation === 'string'
          ? JSON.parse(a.institutionLocation)
          : a.institutionLocation)
        : { latitude: -6.2, longitude: 106.8 },
      attendanceSettings: a.institutionSettings
        ? (typeof a.institutionSettings === 'string'
          ? JSON.parse(a.institutionSettings)
          : a.institutionSettings)
        : { attendanceRadiusMeters: 100, qrCodeEnabled: false },
    }));

    const schoolOptions = (dashboardData.schoolAssignments || []).map((a) => ({
      id: a.institutionId,
      name: a.institutionName || 'Sekolah',
      location: a.institutionLocation || { latitude: -6.2, longitude: 106.8 },
      attendanceSettings: a.institutionSettings || { attendanceRadiusMeters: 100, qrCodeEnabled: false },
      isSchool: true as const,
    }));

    type SelectableInstitution = Institution & { isSchool?: boolean };
    const allOptions: SelectableInstitution[] = [...institutions, ...schoolOptions].map((opt: SelectableInstitution) => ({
      ...opt,
      isSchool: !!opt.isSchool,
    }));

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" />
                Presensi Harian
              </CardTitle>
              <CardDescription>
                {new Date().toLocaleDateString('id-ID', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allOptions.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-500">
                  Belum ada institusi atau sekolah yang terdaftar.
                </div>
              ) : (
                <div className="space-y-2">
                  {allOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setSelectedInstitution(opt);
                        const assignment = dashboardData?.assignments?.find((a: any) => a.institutionId === opt.id)
                          || dashboardData?.schoolAssignments?.find((a: any) => a.institutionId === opt.id);
                        setSelectedAssignment(assignment || null);
                        if (assignment?.todayAttendance?.status !== 'belum_absen') {
                          setView('attendance');
                        } else {
                          setShowScheduleSelector(true);
                          setView('schedule-select');
                        }
                      }}
                      className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-sm transition"
                    >
                      <div className="font-bold text-sm">{opt.name}</div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {opt.isSchool ? 'Sekolah Mandiri' : 'Institusi Terinstansi'} • Radius: {opt.attendanceSettings.attendanceRadiusMeters}m
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Schedule selection view
  if (view === 'schedule-select' && selectedInstitution && selectedAssignment) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building className="h-4 w-4" />
                    {selectedInstitution.name}
                  </CardTitle>
                  <CardDescription>Pilih jadwal mengajar</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => setView('institution-select')}>
                  Ganti
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScheduleSelector
                subjects={selectedAssignment.subjects || []}
                todaySchedule={selectedAssignment.todaySchedule || []}
                institutionName={selectedInstitution.name}
                onConfirm={handleScheduleConfirm}
                onSkip={() => {
                  setView('attendance');
                  setShowScheduleSelector(false);
                }}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

   // Main attendance view
   return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2">
          <span>←</span>
          <span>Kembali</span>
        </Button>
        {/* Header */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4" />
                  Presensi
                </CardTitle>
                <CardDescription className="text-xs">
                  {selectedInstitution?.name}
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => setView('institution-select')}>
                Ganti
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Duty Assignment Section */}
        {dutyAssignmentsToday.length > 0 && (
          <Card className="border-emerald-200 bg-emerald-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-emerald-600" />
                Tugas Luar Hari Ini
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dutyAssignmentsToday.map((duty) => (
                <div key={duty.id} className="p-3 bg-white rounded-xl border border-emerald-100 text-xs space-y-1">
                  <div className="font-bold text-emerald-800">{duty.purpose || 'Tugas Luar'}</div>
                  <div className="text-slate-600">
                    {duty.locationLatitude && duty.locationLongitude && (
                      <span>Lokasi: {typeof duty.locationLatitude === 'number' ? duty.locationLatitude.toFixed(5) : 'N/A'}, {typeof duty.locationLongitude === 'number' ? duty.locationLongitude.toFixed(5) : 'N/A'} • </span>
                    )}
                    Radius: {duty.radiusMeters || 50}m
                  </div>
                  <div className="text-[10px] text-slate-500">Status: {duty.status}</div>
                  <Button
                    size="sm"
                    className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                      setSelectedInstitution({
                        id: duty.institutionId || duty.schoolId || '',
                        name: duty.purpose || 'Tugas Luar',
                        location: {
                          latitude: duty.locationLatitude ?? -6.2088,
                          longitude: duty.locationLongitude ?? 106.8456,
                        },
                        attendanceSettings: {
                          attendanceRadiusMeters: duty.radiusMeters || 50,
                          qrCodeEnabled: false,
                        },
                      });
                      handleCheckIn({ 
                        dutyAssignmentId: duty.id,
                        schoolId: duty.schoolId 
                      });
                    }}
                    disabled={isCheckingIn || !location || !faceEmbedding}
                  >
                    Check-in Tugas Luar
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {!dutyAssignmentsToday.length && (
          <Card className="border-dashed">
            <CardContent className="py-3 flex items-center justify-between">
              <div className="text-xs text-slate-500">Belum ada tugas luar hari ini</div>
              <Button size="sm" variant="outline" onClick={() => setShowDutyForm((v) => !v)}>
                {showDutyForm ? 'Batal' : 'Ajukan Tugas Luar'}
              </Button>
            </CardContent>
          </Card>
        )}

        {showDutyForm && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Ajukan Tugas Luar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitDuty} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Tanggal *</label>
                    <input
                      type="date"
                      value={dutyForm.date}
                      onChange={(e) => setDutyForm((f) => ({ ...f, date: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Radius (meter)</label>
                    <input
                      type="number"
                      value={dutyForm.radiusMeters}
                      onChange={(e) => setDutyForm((f) => ({ ...f, radiusMeters: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Tujuan Kegiatan *</label>
                  <input
                    type="text"
                    value={dutyForm.purpose}
                    onChange={(e) => setDutyForm((f) => ({ ...f, purpose: e.target.value }))}
                    placeholder="Contoh: Seminar Kurikulum di GBK"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Latitude (opsional)</label>
                    <input
                      type="number"
                      step="any"
                      value={dutyForm.latitude}
                      onChange={(e) => setDutyForm((f) => ({ ...f, latitude: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Longitude (opsional)</label>
                    <input
                      type="number"
                      step="any"
                      value={dutyForm.longitude}
                      onChange={(e) => setDutyForm((f) => ({ ...f, longitude: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" type="submit" disabled={submittingDuty}>
                    {submittingDuty ? 'Mengirim...' : 'Kirim Pengajuan'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Location Validation */}
        {selectedInstitution && (
          <GeoValidationBadge
            location={location}
            onLocationUpdate={handleLocationUpdate}
            institution={selectedInstitution}
          />
        )}

        {/* Face Verification */}
        <FaceCaptureWidget
          onCapture={handleFaceCapture}
          hasCaptured={!!faceEmbedding}
        />

        {/* QR Code (if enabled) */}
        {selectedInstitution?.attendanceSettings?.qrCodeEnabled && (
          <QRScanWidget onScan={handleQRScan} hasScanned={!!qrToken} />
        )}

        {/* Check-in/Check-out Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => handleCheckIn()}
            disabled={isCheckingIn || !location || !faceEmbedding}
            className="h-11"
            size="sm"
          >
            {isCheckingIn ? 'Memproses...' : 'Check-in'}
          </Button>

          <Button
            onClick={handleCheckOut}
            disabled={isCheckingOut || !location || !faceEmbedding}
            className="h-11"
            size="sm"
            variant="outline"
          >
            {isCheckingOut ? 'Memproses...' : 'Check-out'}
          </Button>
        </div>

        {/* Teaching Sessions */}
        {selectedAssignment && selectedAssignment.subjects && (
          <SubjectSessionSelector
            subjects={selectedAssignment.subjects}
            sessions={selectedSessions}
            institutionId={selectedInstitution?.id || ''}
            onSessionUpdate={(session) => {
              setSelectedSessions((prev) => {
                const exists = prev.find((s) => s.id === session.id);
                if (exists) {
                  return prev.map((s) => (s.id === session.id ? session : s));
                }
                return [...prev, session];
              });
            }}
            onStartTeaching={handleStartTeaching}
            onStartAllSessions={() => {
              selectedSessions.forEach((session) => {
                if (!activeSessions.find((s) => s.id === session.id)) {
                  handleStartTeaching(session);
                }
              });
            }}
            activeSessions={activeSessions}
            isLoading={isStartingSession}
          />
        )}

        {/* Attendance Result */}
        {attendanceResult && (
          <AttendanceConfirmCard result={attendanceResult} />
        )}

        {/* Today's Summary */}
        {selectedAssignment?.todayAttendance && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Ringkasan Hari Ini</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={selectedAssignment.todayAttendance.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                    {selectedAssignment.todayAttendance.status === 'completed' ? 'Selesai' :
                     selectedAssignment.todayAttendance.status === 'check_in_only' ? 'Check-in' :
                     selectedAssignment.todayAttendance.status === 'hadir' ? 'Hadir' : 'Belum'}
                  </Badge>
                </div>
                {selectedAssignment.todayAttendance.checkIn && (
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-muted-foreground">Check-in</span>
                    <span className="text-xs">{new Date(selectedAssignment.todayAttendance.checkIn.timestamp).toLocaleTimeString('id-ID')}</span>
                  </div>
                )}
                {selectedAssignment.todayAttendance.checkOut && (
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-muted-foreground">Check-out</span>
                    <span className="text-xs">{new Date(selectedAssignment.todayAttendance.checkOut.timestamp).toLocaleTimeString('id-ID')}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
