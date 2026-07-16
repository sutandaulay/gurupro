'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar as CalendarIcon, Download, Filter, Search, TrendingUp } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear } from 'date-fns';
import { id } from 'date-fns/locale';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';

interface AttendanceReport {
  id: string;
  teacherId: string;
  teacherName: string;
  institutionId: string;
  institutionName: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  attendanceStatus: 'hadir' | 'sakit' | 'izin' | 'cuti' | 'alpa' | 'telat';
  teachingMinutesTotal: number;
  teachingSessionsCompleted: number;
  scheduledSessions: number;
  lateMinutes: number;
  teachingMinutesBySubject: Record<string, number>;
}

interface Subject {
  id: string;
  name: string;
}

interface Institution {
  id: string;
  name: string;
}

interface Teacher {
  id: string;
  name: string;
}

interface ReportFilters {
  period: 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  teacherId?: string;
  institutionId?: string;
  subjectId?: string;
  classId?: string;
}

export default function AttendanceReportsPage() {
  const { data: session } = useSession();
  const [reports, setReports] = useState<AttendanceReport[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [filters, setFilters] = useState<ReportFilters>({
    period: 'monthly',
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date()),
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({
    totalDays: 0,
    attendanceRate: 0,
    totalTeachingMinutes: 0,
    totalTeachingSessions: 0,
    scheduledVsCompleted: { scheduled: 0, completed: 0 },
    lateCount: 0,
  });

  // Simulasi pengambilan data dari API
  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        
        // Simulasi API call untuk mendapatkan laporan presensi
        // Dalam implementasi nyata, ini akan memanggil API endpoint
        const response = await fetch('/api/attendance/reports', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          // Dalam implementasi nyata, parameter akan dikirim sebagai query params
        });
        
        // Karena ini hanya simulasi, kita buat data dummy
        const dummyData: AttendanceReport[] = [
          {
            id: 'report-1',
            teacherId: 'teacher-1',
            teacherName: 'Ahmad Fauzi',
            institutionId: 'inst-1',
            institutionName: 'SDN Cempaka Putih 01',
            date: '2024-06-01',
            checkInTime: '07:30:00',
            checkOutTime: '15:00:00',
            attendanceStatus: 'hadir',
            teachingMinutesTotal: 240,
            teachingSessionsCompleted: 4,
            scheduledSessions: 4,
            lateMinutes: 0,
            teachingMinutesBySubject: { 'math': 120, 'science': 120 },
          },
          {
            id: 'report-2',
            teacherId: 'teacher-1',
            teacherName: 'Ahmad Fauzi',
            institutionId: 'inst-1',
            institutionName: 'SDN Cempaka Putih 01',
            date: '2024-06-02',
            checkInTime: '07:45:00',
            checkOutTime: '14:45:00',
            attendanceStatus: 'telat',
            teachingMinutesTotal: 210,
            teachingSessionsCompleted: 3,
            scheduledSessions: 4,
            lateMinutes: 15,
            teachingMinutesBySubject: { 'math': 90, 'science': 120 },
          },
          {
            id: 'report-3',
            teacherId: 'teacher-2',
            teacherName: 'Siti Nurhaliza',
            institutionId: 'inst-1',
            institutionName: 'SDN Cempaka Putih 01',
            date: '2024-06-01',
            checkInTime: '07:30:00',
            checkOutTime: '15:30:00',
            attendanceStatus: 'hadir',
            teachingMinutesTotal: 300,
            teachingSessionsCompleted: 5,
            scheduledSessions: 5,
            lateMinutes: 0,
            teachingMinutesBySubject: { 'indonesia': 150, 'social': 150 },
          },
        ];
        
        setReports(dummyData);
        
        // Hitung metrics
        const totalDays = dummyData.length;
        const presentDays = dummyData.filter(r => r.attendanceStatus === 'hadir' || r.attendanceStatus === 'telat').length;
        const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
        
        const totalTeachingMinutes = dummyData.reduce((sum, r) => sum + r.teachingMinutesTotal, 0);
        const totalTeachingSessions = dummyData.reduce((sum, r) => sum + r.teachingSessionsCompleted, 0);
        const scheduledSessions = dummyData.reduce((sum, r) => sum + r.scheduledSessions, 0);
        const lateCount = dummyData.filter(r => r.attendanceStatus === 'telat').length;
        
        setMetrics({
          totalDays,
          attendanceRate,
          totalTeachingMinutes,
          totalTeachingSessions,
          scheduledVsCompleted: { scheduled: scheduledSessions, completed: totalTeachingSessions },
          lateCount,
        });
      } catch (err: any) {
        console.error('Error fetching reports:', err);
        setError(err.message || 'Gagal mengambil data laporan');
        toast.error('Gagal mengambil data laporan');
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  // Simulasi data untuk dropdown
  useEffect(() => {
    // Dalam implementasi nyata, ini akan diambil dari API
    setSubjects([
      { id: 'math', name: 'Matematika' },
      { id: 'science', name: 'Ilmu Pengetahuan Alam' },
      { id: 'indonesia', name: 'Bahasa Indonesia' },
      { id: 'social', name: 'Ilmu Pengetahuan Sosial' },
    ]);
    
    setInstitutions([
      { id: 'inst-1', name: 'SDN Cempaka Putih 01' },
      { id: 'inst-2', name: 'SMPN 1 Jakarta' },
      { id: 'inst-3', name: 'SMAN 1 Depok' },
    ]);
    
    setTeachers([
      { id: 'teacher-1', name: 'Ahmad Fauzi' },
      { id: 'teacher-2', name: 'Siti Nurhaliza' },
      { id: 'teacher-3', name: 'Budi Santoso' },
    ]);
  }, []);

  const handleFilterChange = (field: keyof ReportFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleApplyFilters = () => {
    // Dalam implementasi nyata, ini akan memanggil API dengan filter yang baru
    console.log('Applying filters:', filters);
    toast.success('Filter diterapkan');
  };

  const handleExport = () => {
    // Dalam implementasi nyata, ini akan mengunduh laporan dalam format Excel/PDF
    toast.success('Ekspor laporan dimulai...');
  };

  const getPeriodDates = (period: 'daily' | 'weekly' | 'monthly') => {
    const today = new Date();
    switch (period) {
      case 'daily':
        return { startDate: today, endDate: today };
      case 'weekly':
        return { 
          startDate: startOfWeek(today, { weekStartsOn: 1 }), 
          endDate: endOfWeek(today, { weekStartsOn: 1 }) 
        };
      case 'monthly':
        return { 
          startDate: startOfMonth(today), 
          endDate: endOfMonth(today) 
        };
      default:
        return { startDate: today, endDate: today };
    }
  };

  const handlePeriodChange = (period: 'daily' | 'weekly' | 'monthly') => {
    const { startDate, endDate } = getPeriodDates(period);
    setFilters(prev => ({
      ...prev,
      period,
      startDate,
      endDate
    }));
  };

  // Data untuk grafik tren kehadiran
  const chartData = [
    { date: 'Jun 1', attendance: 95, teachingMinutes: 240 },
    { date: 'Jun 2', attendance: 90, teachingMinutes: 210 },
    { date: 'Jun 3', attendance: 100, teachingMinutes: 300 },
    { date: 'Jun 4', attendance: 85, teachingMinutes: 180 },
    { date: 'Jun 5', attendance: 98, teachingMinutes: 280 },
    { date: 'Jun 6', attendance: 100, teachingMinutes: 320 },
    { date: 'Jun 7', attendance: 92, teachingMinutes: 260 },
  ];

  if (loading) {
    return (
      <div className="container mx-auto py-10 px-4 max-w-7xl flex justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
          <p>Memuat laporan presensi...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-10 px-4 max-w-7xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6" />
              Laporan Presensi
            </CardTitle>
            <CardDescription>
              Gagal memuat data laporan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-7xl">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6" />
                Laporan Presensi
              </CardTitle>
              <CardDescription>
                Laporan kehadiran dan jam mengajar guru
              </CardDescription>
            </div>
            
            <Button onClick={handleExport} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Ekspor Laporan
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Filter Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filter Laporan
              </CardTitle>
              <CardDescription>
                Atur periode dan parameter laporan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label>Periode</Label>
                  <Select 
                    value={filters.period} 
                    onValueChange={(value: 'daily' | 'weekly' | 'monthly') => handlePeriodChange(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Harian</SelectItem>
                      <SelectItem value="weekly">Mingguan</SelectItem>
                      <SelectItem value="monthly">Bulanan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Periode Kustom</Label>
                  <DateRangePicker 
                    dateRange={{ from: filters.startDate, to: filters.endDate }} 
                    setDateRange={(range) => {
                      if (range) {
                        setFilters(prev => ({
                          ...prev,
                          startDate: range.from,
                          endDate: range.to
                        }));
                      }
                    }}
                  />
                </div>
                
                {session?.user?.role !== 'teacher' && (
                  <div>
                    <Label>Guru</Label>
                    <Select 
                      value={filters.teacherId} 
                      onValueChange={(value) => handleFilterChange('teacherId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Semua Guru" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map(teacher => (
                          <SelectItem key={teacher.id} value={teacher.id}>{teacher.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div>
                  <Label>Institusi</Label>
                  <Select 
                    value={filters.institutionId} 
                    onValueChange={(value) => handleFilterChange('institutionId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Semua Institusi" />
                    </SelectTrigger>
                    <SelectContent>
                      {institutions.map(inst => (
                        <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Mata Pelajaran</Label>
                  <Select 
                    value={filters.subjectId} 
                    onValueChange={(value) => handleFilterChange('subjectId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Semua Mapel" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map(subject => (
                        <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="md:col-span-2 lg:col-span-4 flex justify-end pt-6">
                  <Button onClick={handleApplyFilters}>
                    Terapkan Filter
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Hari</CardDescription>
                <CardTitle className="text-2xl">{metrics.totalDays}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">
                  Periode: {format(filters.startDate, 'dd MMM', { locale: id })} - {format(filters.endDate, 'dd MMM yyyy', { locale: id })}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Tingkat Kehadiran</CardDescription>
                <CardTitle className="text-2xl">{metrics.attendanceRate}%</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">
                  {metrics.totalDays > 0 ? Math.round(metrics.attendanceRate) : 0}% hadir/telat
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Jam Mengajar</CardDescription>
                <CardTitle className="text-2xl">{Math.round(metrics.totalTeachingMinutes / 60)} jam</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">
                  {metrics.totalTeachingMinutes} menit
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Sesi Selesai</CardDescription>
                <CardTitle className="text-2xl">{metrics.totalTeachingSessions}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">
                  {metrics.scheduledVsCompleted.completed}/{metrics.scheduledVsCompleted.scheduled} sesi
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Charts */}
          <Tabs defaultValue="trends" className="mb-6">
            <TabsList>
              <TabsTrigger value="trends">Tren Kehadiran</TabsTrigger>
              <TabsTrigger value="subjects">Breakdown Per Mapel</TabsTrigger>
            </TabsList>
            <TabsContent value="trends">
              <Card>
                <CardHeader>
                  <CardTitle>Tren Kehadiran Mingguan</CardTitle>
                  <CardDescription>
                    Persentase kehadiran dan jam mengajar per hari
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="attendance" 
                        stroke="#8884d8" 
                        name="Kehadiran (%)" 
                        strokeWidth={2}
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="teachingMinutes" 
                        stroke="#82ca9d" 
                        name="Jam Mengajar (mnt)" 
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="subjects">
              <Card>
                <CardHeader>
                  <CardTitle>Distribusi Jam Mengajar Per Mata Pelajaran</CardTitle>
                  <CardDescription>
                    Total jam mengajar dibagi berdasarkan mata pelajaran
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={[
                      { name: 'Matematika', minutes: 480 },
                      { name: 'IPA', minutes: 360 },
                      { name: 'Bahasa Indonesia', minutes: 420 },
                      { name: 'IPS', minutes: 300 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="minutes" fill="#8884d8" name="Menit Mengajar" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          
          {/* Reports Table */}
          <Card>
            <CardHeader>
              <CardTitle>Rincian Laporan</CardTitle>
              <CardDescription>
                Detail kehadiran dan jam mengajar per hari
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guru</TableHead>
                      <TableHead>Institusi</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Kehadiran</TableHead>
                      <TableHead>Jam Mengajar</TableHead>
                      <TableHead>Sesi</TableHead>
                      <TableHead>Telat (mnt)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.length > 0 ? (
                      reports.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell className="font-medium">{report.teacherName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{report.institutionName}</Badge>
                          </TableCell>
                          <TableCell>{format(new Date(report.date), 'dd MMM yyyy', { locale: id })}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                report.attendanceStatus === 'hadir' ? 'default' :
                                report.attendanceStatus === 'telat' ? 'secondary' :
                                report.attendanceStatus === 'sakit' ? 'destructive' :
                                report.attendanceStatus === 'izin' ? 'outline' :
                                'destructive'
                              }
                            >
                              {report.attendanceStatus === 'hadir' && 'Hadir'}
                              {report.attendanceStatus === 'telat' && 'Telat'}
                              {report.attendanceStatus === 'sakit' && 'Sakit'}
                              {report.attendanceStatus === 'izin' && 'Izin'}
                              {report.attendanceStatus === 'cuti' && 'Cuti'}
                              {report.attendanceStatus === 'alpa' && 'Alpa'}
                            </Badge>
                          </TableCell>
                          <TableCell>{report.teachingMinutesTotal} menit</TableCell>
                          <TableCell>{report.teachingSessionsCompleted}/{report.scheduledSessions}</TableCell>
                          <TableCell>{report.lateMinutes} menit</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Tidak ada data laporan untuk periode ini
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}