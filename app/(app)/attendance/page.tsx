'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Building, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { FaceCaptureWidget } from '@/components/attendance/FaceCaptureWidget';
import { GeoValidationBadge } from '@/components/attendance/GeoValidationBadge';
import { QRScanWidget } from '@/components/attendance/QRScanWidget';
import { AttendanceConfirmCard } from '@/components/attendance/AttendanceConfirmCard';
import { EnhancedInstitutionSelector } from '@/components/attendance/EnhancedInstitutionSelector';
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
  subjects: Subject[];
  todaySchedule: string[];
  workingHours?: { start: string; end: string };
  status: string;
  todayAttendance?: {
    status: string;
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
  workingHours: { start: string; end: string; currentTime: string };
}

interface AttendanceResult {
  type: 'check-in' | 'check-out' | 'teaching-start' | 'teaching-end';
  success: boolean;
  timestamp: string;
  institutionName: string;
  distanceFromInstitution?: number;
  faceMatchScore?: number;
  trustScore?: number;
  status?: 'valid' | 'flagged' | 'rejected';
  flagReasons?: string[];
  sessionId?: string;
  subjectName?: string;
}

export default function AttendancePage() {
  const { data: session } = useSession();
  const [dashboardData, setDashboardData] = useState<TeacherDashboard | null>(null);
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [selectedSessions, setSelectedSessions] = useState<TeachingSession[]>([]);
  const [activeSessions, setActiveSessions] = useState<TeachingSession[]>([]);
  const [showScheduleSelector, setShowScheduleSelector] = useState(false);
  const [view, setView] = useState<'institution-select' | 'schedule-select' | 'attendance'>('institution-select');

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

      const res = await fetch('/api/attendance/teacher-dashboard');
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Sesi tidak valid. Silakan login kembali.');
        }
        throw new Error('Gagal memuat data presensi');
      }

      const data = await res.json();
      setDashboardData(data.data);

      // Auto-select if only one assignment
      if (data.data?.assignments?.length === 1) {
        const assignment = data.data.assignments[0];
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
  const handleFaceCapture = (data: { embedding: string; faceMatchScore: number; livenessPassed: boolean }) => {
    setFaceEmbedding(data.embedding);
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
    setSelectedAssignment(assignment);

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
      // Auto trigger check-in
      handleCheckIn();
    } else {
      // Just go to attendance view
      setView('attendance');
    }
  };

  // Check-in
  const handleCheckIn = async () => {
    if (!selectedInstitution || !location) {
      toast.error('Harap perbarui lokasi terlebih dahulu');
      return;
    }

    if (faceMatchScore === null || livenessPassed === null) {
      toast.error('Verifikasi wajah belum lengkap');
      return;
    }

    setIsCheckingIn(true);
    try {
      const response = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faceEmbedding,
          faceMatchScore,
          livenessPassed,
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
        throw new Error(errorData.error || 'Gagal check-in');
      }

      const result = await response.json();
      setAttendanceResult({
        ...result,
        type: 'check-in',
        timestamp: new Date().toLocaleString('id-ID'),
        institutionName: selectedInstitution.name,
      });
      setView('attendance');
      toast.success('Check-in berhasil!');

      // Refresh dashboard
      fetchDashboard();
    } catch (err: any) {
      toast.error(err.message || 'Gagal check-in');
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Check-out
  const handleCheckOut = async () => {
    if (!selectedInstitution || !location) {
      toast.error('Harap perbarui lokasi terlebih dahulu');
      return;
    }

    setIsCheckingOut(true);
    try {
      const response = await fetch('/api/attendance/check-out', {
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
        institutionName: selectedInstitution.name,
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
      const response = await fetch('/api/attendance/teaching/start', {
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
      const response = await fetch('/api/attendance/teaching/end', {
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
  if (view === 'institution-select' && dashboardData?.assignments) {
    const institutions = dashboardData.assignments.map((a) => ({
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
              <EnhancedInstitutionSelector
                institutions={institutions}
                assignments={dashboardData.assignments}
                onSelect={handleInstitutionSelect}
                currentInstitutionId={selectedInstitution?.id}
              />
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
            onClick={handleCheckIn}
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
