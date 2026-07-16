'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, TrendingUp, AlertTriangle, CheckCircle, FileText, Users, BarChart3 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { toast } from 'sonner';

interface DailyAttendanceData {
  date: string;
  dayName: string;
  attendanceStatus: string;
  teachingMinutes: number;
  sessions: number;
  lateMinutes: number;
}

interface TeachingMinutesByInstitution {
  institutionId: string;
  institutionName: string;
  minutes: number;
}

interface AttendanceSummary {
  totalMinutes: number;
  requiredMinutes: number;
  teachingMinutesByInstitution: TeachingMinutesByInstitution[];
  sessionsCompleted: number;
  attendanceDays: number;
  lateDays: number;
  isRequirementMet: boolean;
  weeklyDeficit: number;
}

interface AttendanceInsight {
  summary: string;
  highlights: string[];
  recommendations: string[];
}

interface AttendanceDataResponse {
  success: boolean;
  data: {
    teacherName: string;
    weekStart: string;
    weekEnd: string;
    summary: AttendanceSummary;
    dailyData: DailyAttendanceData[];
    insight: AttendanceInsight | null;
  };
}

export default function LeaderAttendanceView({ params }: { params: { token: string } }) {
  const { token } = params;
  const [attendanceData, setAttendanceData] = useState<AttendanceDataResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAttendanceData = async () => {
      try {
        setLoading(true);
        
        const response = await fetch(`/api/performance-share/attendance-data/${token}`);
        
        if (!response.ok) {
          throw new Error('Gagal mengambil data presensi');
        }
        
        const result: AttendanceDataResponse = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'Gagal mengambil data presensi');
        }
        
        setAttendanceData(result.data);
      } catch (err: any) {
        console.error('Error fetching attendance data:', err);
        setError(err.message || 'Terjadi kesalahan saat mengambil data');
        toast.error(err.message || 'Gagal mengambil data presensi');
      } finally {
        setLoading(false);
      }
    };

    fetchAttendanceData();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
            <p>Mengambil data presensi & kinerja...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !attendanceData) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error || 'Data tidak ditemukan'}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const { summary, dailyData, insight } = attendanceData;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Laporan Presensi & Kinerja Mengajar</h1>
          <p className="text-gray-600 mt-2">
            {attendanceData.teacherName} • {format(parseISO(attendanceData.weekStart), 'd MMMM yyyy', { locale: id })} - {format(parseISO(attendanceData.weekEnd), 'd MMMM yyyy', { locale: id })}
          </p>
        </div>

        {/* Ringkasan Mingguan */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Ringkasan Minggu Ini
            </CardTitle>
            <CardDescription>
              Statistik kehadiran dan jam mengajar mingguan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold text-primary">
                    {Math.floor(summary.totalMinutes / 60)}:{(summary.totalMinutes % 60).toString().padStart(2, '0')}
                  </div>
                  <div className="text-sm text-muted-foreground">Jam Mengajar</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 text-center">
                  <div className={`text-3xl font-bold ${summary.isRequirementMet ? 'text-green-600' : 'text-red-600'}`}>
                    {Math.floor(summary.requiredMinutes / 60)}
                  </div>
                  <div className="text-sm text-muted-foreground">Target (jam/minggu)</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {summary.sessionsCompleted}
                  </div>
                  <div className="text-sm text-muted-foreground">Sesi Selesai</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 text-center">
                  <div className={`text-3xl font-bold ${summary.lateDays > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {summary.lateDays}
                  </div>
                  <div className="text-sm text-muted-foreground">Hari Terlambat</div>
                </CardContent>
              </Card>
            </div>
            
            <div className="mb-6">
              <div className="flex justify-between mb-1">
                <span>Progress Pencapaian</span>
                <span>{Math.round((summary.totalMinutes / summary.requiredMinutes) * 100)}%</span>
              </div>
              <Progress 
                value={(summary.totalMinutes / summary.requiredMinutes) * 100} 
                className="h-3"
              />
              {!summary.isRequirementMet && (
                <p className="text-sm text-red-600 mt-2">
                  Kekurangan: {Math.floor(summary.weeklyDeficit / 60)} jam {summary.weeklyDeficit % 60} menit
                </p>
              )}
            </div>
            
            {summary.isRequirementMet ? (
              <div className="flex items-center text-green-600">
                <CheckCircle className="h-5 w-5 mr-2" />
                <span>Target mingguan telah tercapai!</span>
              </div>
            ) : (
              <div className="flex items-center text-red-600">
                <AlertTriangle className="h-5 w-5 mr-2" />
                <span>Target mingguan belum tercapai</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Breakdown Per Institusi */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Breakdown Jam Mengajar Per Institusi
            </CardTitle>
            <CardDescription>
              Distribusi jam mengajar di berbagai institusi tempat guru bertugas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Institusi</TableHead>
                  <TableHead>Jam Mengajar</TableHead>
                  <TableHead>Proporsi</TableHead>
                  <TableHead>Kontribusi (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.teachingMinutesByInstitution.map((inst, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{inst.institutionName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {Math.floor(inst.minutes / 60)}:{(inst.minutes % 60).toString().padStart(2, '0')} jam
                      </div>
                    </TableCell>
                    <TableCell>
                      <Progress 
                        value={(inst.minutes / summary.totalMinutes) * 100} 
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell>
                      {Math.round((inst.minutes / summary.totalMinutes) * 100)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Tabs defaultValue="daily" className="mb-8">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="daily">Data Harian</TabsTrigger>
            <TabsTrigger value="insight">Insight Kinerja</TabsTrigger>
          </TabsList>
          <TabsContent value="daily">
            <Card>
              <CardHeader>
                <CardTitle>Data Harian</CardTitle>
                <CardDescription>
                  Rincian kehadiran dan jam mengajar harian
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hari</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Jam Mengajar</TableHead>
                      <TableHead>Sesi</TableHead>
                      <TableHead>Keterlambatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyData.map((day, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{day.dayName}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              day.attendanceStatus === 'hadir' ? 'default' :
                              day.attendanceStatus === 'telat' ? 'secondary' :
                              day.attendanceStatus === 'sakit' ? 'destructive' :
                              day.attendanceStatus === 'izin' ? 'outline' :
                              day.attendanceStatus === 'cuti' ? 'secondary' :
                              'destructive'
                            }
                          >
                            {day.attendanceStatus === 'hadir' && 'Hadir'}
                            {day.attendanceStatus === 'telat' && 'Telat'}
                            {day.attendanceStatus === 'sakit' && 'Sakit'}
                            {day.attendanceStatus === 'izin' && 'Izin'}
                            {day.attendanceStatus === 'cuti' && 'Cuti'}
                            {day.attendanceStatus === 'alpa' && 'Alpa'}
                            {day.attendanceStatus === 'libur' && 'Libur'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {day.attendanceStatus === 'libur' ? '-' : `${Math.floor(day.teachingMinutes / 60)}:${(day.teachingMinutes % 60).toString().padStart(2, '0')} jam`}
                        </TableCell>
                        <TableCell>
                          {day.attendanceStatus === 'libur' ? '-' : `${day.sessions} sesi`}
                        </TableCell>
                        <TableCell>
                          {day.lateMinutes > 0 ? `${day.lateMinutes} menit` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="insight">
            <Card>
              <CardHeader>
                <CardTitle>Insight Kinerja Mingguan</CardTitle>
                <CardDescription>
                  Analisis otomatis berbasis AI terhadap pola kehadiran dan jam mengajar
                </CardDescription>
              </CardHeader>
              <CardContent>
                {insight ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-semibold mb-2">Ringkasan</h4>
                      <p className="text-sm">{insight.summary}</p>
                    </div>
                    
                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-semibold mb-2">Poin Penting</h4>
                      <ul className="list-disc pl-5 text-sm space-y-1">
                        {insight.highlights.map((highlight, idx) => (
                          <li key={idx}>{highlight}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-semibold mb-2">Rekomendasi</h4>
                      <ul className="list-disc pl-5 text-sm space-y-1">
                        {insight.recommendations.map((rec, idx) => (
                          <li key={idx}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted" />
                    <p>Belum ada insight AI untuk minggu ini</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="text-center text-sm text-gray-500 mt-12">
          <p>Laporan ini dibagikan melalui GuruPRO AI • Data diperbarui otomatis</p>
        </div>
      </div>
    </div>
  );
}