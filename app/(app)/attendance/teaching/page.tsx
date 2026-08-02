'use client';
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, School, BookOpen, MapPin, UserCheck, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { GeoValidationBadge } from '@/components/attendance/GeoValidationBadge';
import { useSession } from 'next-auth/react';

interface Institution {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
  };
  attendanceSettings: {
    attendanceRadiusMeters: number;
    classSessionRadiusMeters: number;
    qrCodeEnabled: boolean;
  };
}

interface Subject {
  id: string;
  name: string;
}

interface ClassSession {
  id: string;
  institutionId: string;
  subjectId: string;
  className: string;
  classId?: string;
  startTime: string; // Format HH:MM
  endTime: string;
  dayOfWeek: number; // 0 = Minggu, 1 = Senin, dst
  subject?: Subject;
  institution?: Institution;
  schoolId?: string;
  schoolName?: string;
}

interface TeachingSession {
  id: string;
  sessionId: string;
  teacherId: string;
  institutionId: string;
  subjectId: string;
  startTime: string;
  endTime?: string;
  status: 'active' | 'completed' | 'cancelled';
  autoClosedByCron?: boolean;
}

interface ScheduleSlot extends ClassSession {
  status: 'upcoming' | 'ongoing' | 'completed' | 'missed';
  teachingSession?: TeachingSession;
}

export default function TeachingAttendancePage() {
  const { data: session } = useSession();
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [confirmingSwitch, setConfirmingSwitch] = useState<{ from: string; to: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simulasi pengambilan data jadwal dan institusi
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Simulasi API call untuk mendapatkan jadwal mengajar hari ini
        const [scheduleRes, institutionRes, subjectRes] = await Promise.all([
          apiFetch('/api/attendance/schedule/today'),
          apiFetch('/api/institutions'),
          apiFetch('/api/subjects')
        ]);

        if (!scheduleRes.ok || !institutionRes.ok || !subjectRes.ok) {
          throw new Error('Gagal mengambil data jadwal, institusi, atau mata pelajaran');
        }

        const [scheduleData, institutionData, subjectData] = await Promise.all([
          scheduleRes.json(),
          institutionRes.json(),
          subjectRes.json()
        ]);

        // Proses data dan tambahkan status
        const today = new Date();
        const now = new Date();
        const currentHour = now.getHours().toString().padStart(2, '0');
        const currentMin = now.getMinutes().toString().padStart(2, '0');
        const currentTimeStr = `${currentHour}:${currentMin}`;

        const processedSchedules: ScheduleSlot[] = scheduleData.map((slot: any) => {
          const startTime = new Date();
          const [startHour, startMinute] = slot.startTime.split(':').map(Number);
          startTime.setHours(startHour, startMinute, 0, 0);
          
          const endTime = new Date();
          const [endHour, endMinute] = slot.endTime.split(':').map(Number);
          endTime.setHours(endHour, endMinute, 0, 0);
          
          // Gunakan status dari server bila sesi sudah mulai/selesai,
          // fallback ke perhitungan waktu hanya bila status 'upcoming'/'missed'
          let status: 'upcoming' | 'ongoing' | 'completed' | 'missed' = slot.status || 'upcoming';
          if (status !== 'ongoing' && status !== 'completed') {
            if (now >= startTime && now < endTime) {
              status = 'ongoing';
            } else if (now >= endTime) {
              status = 'missed';
            }
          }
          
          // Tambahkan informasi institusi atau sekolah
          const institution = institutionData.find((inst: Institution) => inst.id === slot.institutionId);
          const subject = subjectData.find((subj: Subject) => subj.id === slot.subjectId);
          
          return {
            ...slot,
            institution,
            subject,
            status,
          };
        });

        setSchedules(processedSchedules);
        setInstitutions(institutionData);
        setSubjects(subjectData);
      } catch (err: any) {
        console.error('Error fetching teaching attendance data:', err);
        setError(err.message || 'Terjadi kesalahan saat mengambil data');
        toast.error('Gagal mengambil data jadwal mengajar');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fungsi untuk mendapatkan lokasi
  const getLocation = (): Promise<{ latitude: number; longitude: number; accuracy: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation tidak didukung oleh browser ini'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || 0
          });
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || 0
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  };

  const handleStartTeaching = async (sessionId: string, institutionId: string) => {
    try {
      const schedule = schedules.find(s => s.id === sessionId);
      if (!schedule) {
        throw new Error('Jadwal tidak ditemukan');
      }

      const isSchoolBased = !!schedule.schoolId;
      const targetId = isSchoolBased ? (schedule.schoolId || institutionId) : institutionId;

      // Cek apakah ada sesi aktif sebelumnya
      const activeSession = schedules.find(s => s.teachingSession?.status === 'active' && s.id !== sessionId);
      
      if (activeSession && activeSession.institutionId !== targetId) {
        setConfirmingSwitch({
          from: activeSession.institutionId,
          to: targetId
        });
        return;
      }

      // Dapatkan lokasi terbaru
      const location = await getLocation();
      
      if (isSchoolBased) {
        // Untuk sekolah mandiri, gunakan API teaching session khusus
        const startResponse = await apiFetch('/api/attendance/teaching/school', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolId: schedule.schoolId,
            subjectId: schedule.subjectId,
            classId: schedule.classId,
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
            faceMatchScore: 0.9,
            livenessPassed: true,
          }),
        });

        if (!startResponse.ok) {
          const err = await startResponse.json();
          throw new Error(err.error || 'Gagal memulai sesi mengajar');
        }

        const startResult = await startResponse.json();
        
        // Update status lokal
        setSchedules(prev => 
          prev.map(s => {
            if (s.id === sessionId) {
              return {
                ...s,
                status: 'ongoing',
                teachingSession: {
                  id: startResult.session.id,
                  sessionId,
                  teacherId: session?.user?.id || '',
                  institutionId: targetId || s.institutionId,
                  subjectId: schedule.subjectId,
                  startTime: new Date().toISOString(),
                  status: 'active',
                  isSchool: true,
                  schoolId: schedule.schoolId,
                }
              } as ScheduleSlot;
            }
            return s;
          })
        );

        toast.success('Sesi mengajar dimulai (Sekolah Mandiri)');
      } else {
        // Validasi lokasi terhadap institusi yang sesuai
        const institution = institutions.find(inst => inst.id === institutionId);
        if (!institution) {
          throw new Error('Institusi tidak ditemukan');
        }

        const response = await apiFetch('/api/attendance/teaching/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            institutionId,
            subjectId: schedule.subjectId,
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || 'Gagal memulai sesi mengajar');
        }

        // Update status lokal
        setSchedules(prev => 
          prev.map(s => {
            if (s.id === sessionId) {
              return {
                ...s,
                status: 'ongoing',
                teachingSession: {
                  id: result.sessionId,
                  sessionId,
                  teacherId: session?.user?.id || '',
                  institutionId,
                  subjectId: schedule.subjectId,
                  startTime: new Date().toISOString(),
                  status: 'active'
                }
              };
            }
            return s;
          })
        );

        toast.success('Sesi mengajar dimulai');
      }
    } catch (err: any) {
      console.error('Error starting teaching session:', err);
      toast.error(err.message || 'Gagal memulai sesi mengajar');
    }
  };

  const handleEndTeaching = async (sessionId: string) => {
    try {
      const schedule = schedules.find(s => s.id === sessionId);
      if (!schedule) {
        throw new Error('Jadwal tidak ditemukan');
      }

      const isSchoolBased = !!schedule.schoolId;
      const location = await getLocation();

      if (isSchoolBased) {
        // Untuk sekolah mandiri, gunakan API teaching session end
        const endResponse = await apiFetch('/api/attendance/teaching/school/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: schedule.teachingSession?.id || sessionId,
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
            faceMatchScore: 0.9,
            livenessPassed: true,
          }),
        });

        if (!endResponse.ok) {
          const err = await endResponse.json();
          throw new Error(err.error || 'Gagal mengakhiri sesi mengajar');
        }

        const endResult = await endResponse.json();
        console.log('Sesi mengajar selesai, durasi:', endResult.durationMinutes, 'menit');
        toast.success(`Sesi mengajar selesai (${endResult.durationMinutes} menit)`);
      } else {
        const response = await apiFetch('/api/attendance/teaching/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: schedule.teachingSession?.id || sessionId,
            classSessionId: sessionId,
            subjectId: schedule.subjectId,
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || 'Gagal mengakhiri sesi mengajar');
        }

        toast.success('Sesi mengajar selesai');
      }

      // Update status lokal
      setSchedules(prev => 
        prev.map(s => {
          if (s.id === sessionId) {
            return {
              ...s,
              status: 'completed',
              teachingSession: schedule.teachingSession ? {
                ...schedule.teachingSession,
                endTime: new Date().toISOString(),
                status: 'completed'
              } : undefined
            };
          }
          return s;
        })
      );
    } catch (err: any) {
      console.error('Error ending teaching session:', err);
      toast.error(err.message || 'Gagal mengakhiri sesi mengajar');
    }
  };

  const confirmInstitutionSwitch = () => {
    if (!confirmingSwitch) return;
    
    const nextSchedule = schedules.find(s => 
      s.institutionId === confirmingSwitch.to || s.schoolId === confirmingSwitch.to
    );
    if (nextSchedule) {
      handleStartTeaching(nextSchedule.id, nextSchedule.institutionId);
    }
    
    setConfirmingSwitch(null);
  };

  const cancelInstitutionSwitch = () => {
    setConfirmingSwitch(null);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-10 px-4 max-w-4xl flex justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
          <p>Mengambil jadwal mengajar...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-10 px-4 max-w-4xl">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Presensi Mengajar
          </CardTitle>
          <CardDescription>
            Lacak sesi mengajar per mata pelajaran dan institusi
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Konfirmasi pindah institusi */}
          {confirmingSwitch && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription>
                <div className="font-semibold">Konfirmasi Pindah Institusi</div>
                <p className="mt-2">
                  Anda sedang dalam sesi mengajar di institusi sebelumnya. 
                  Apakah Anda ingin menyelesaikan sesi di institusi sebelumnya 
                  sebelum memulai di institusi baru?
                </p>
                <div className="flex gap-2 mt-3">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={cancelInstitutionSwitch}
                  >
                    Tunda
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={confirmInstitutionSwitch}
                  >
                    Lanjutkan ke Institusi Baru
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Jadwal Hari Ini */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Jadwal Hari Ini
            </h3>
            
            {schedules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-2 text-muted" />
                <p>Tidak ada jadwal mengajar hari ini</p>
              </div>
            ) : (
              <div className="space-y-4">
                 {schedules.map((schedule) => {
                   const institution = schedule.schoolId 
                     ? null 
                     : institutions.find(inst => inst.id === schedule.institutionId);
                   const subject = subjects.find(subj => subj.id === schedule.subjectId);
                   
                   return (
                     <Card key={schedule.id} className="p-4">
                       <div className="flex flex-wrap items-center justify-between gap-4">
                         <div className="space-y-1">
                           <div className="flex items-center gap-2">
                             <School className="h-4 w-4 text-muted-foreground" />
                             <span className="font-medium">
                               {schedule.schoolId ? schedule.schoolName : institution?.name || 'Institusi'}
                             </span>
                           </div>
                          
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                            <span>{subject?.name}</span>
                            <span className="text-muted-foreground">•</span>
                            <span>{schedule.className}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>{schedule.startTime} - {schedule.endTime}</span>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-2">
                          <Badge 
                            variant={
                              schedule.status === 'ongoing' ? 'default' :
                              schedule.status === 'completed' ? 'secondary' :
                              schedule.status === 'missed' ? 'destructive' : 'outline'
                            }
                          >
                            {schedule.status === 'upcoming' && 'Akan Datang'}
                            {schedule.status === 'ongoing' && 'Sedang Berlangsung'}
                            {schedule.status === 'completed' && 'Selesai'}
                            {schedule.status === 'missed' && 'Terlewat'}
                          </Badge>
                          
                          {institution && (
                            <GeoValidationBadge 
                              location={currentLocation} 
                              institution={institution} 
                              onLocationUpdate={getLocation}
                            />
                          )}
                          
                          <div className="flex gap-2 mt-2">
                            {schedule.status === 'upcoming' && (
                              <Button
                                size="sm"
                                onClick={() => handleStartTeaching(schedule.id, schedule.institutionId)}
                                className="flex items-center gap-1"
                              >
                                <UserCheck className="h-4 w-4" />
                                Mulai Mengajar
                              </Button>
                            )}
                            
                            {schedule.status === 'ongoing' && schedule.teachingSession && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleEndTeaching(schedule.id)}
                                className="flex items-center gap-1"
                              >
                                <CheckCircle className="h-4 w-4" />
                                Selesai Mengajar
                              </Button>
                            )}
                            
                            {schedule.status === 'completed' && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <CheckCircle className="h-4 w-4" />
                                Selesai
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}