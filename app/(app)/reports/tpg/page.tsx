'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, TrendingUp, AlertTriangle, CheckCircle, FileText, Download } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isWithinInterval } from 'date-fns';
import { id } from 'date-fns/locale';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';

interface TeachingMinutesByInstitution {
  institutionId: string;
  institutionName: string;
  minutes: number;
}

interface TPGReport {
  teacherId: string;
  teacherName: string;
  weekStart: string;
  weekEnd: string;
  totalMinutes: number;
  requiredMinutes: number;
  teachingMinutesByInstitution: TeachingMinutesByInstitution[];
  sessionsCompleted: number;
  attendanceDays: number;
  lateDays: number;
  isRequirementMet: boolean;
  weeklyDeficit: number; // Defisit mingguan jika tidak mencapai syarat
}

interface AIInsight {
  id: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  insightData: any;
  createdAt: string;
}

export default function TPGReportPage() {
  const { data: session } = useSession();
  const [reports, setReports] = useState<TPGReport[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [currentWeek, setCurrentWeek] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingInsight, setGeneratingInsight] = useState(false);

  // Simulasi pengambilan data dari API
  useEffect(() => {
    const fetchTPGReports = async () => {
      try {
        setLoading(true);
        
        // Simulasi API call untuk mendapatkan laporan TPG
        // Dalam implementasi nyata, ini akan memanggil API endpoint
        const response = await fetch('/api/attendance/tpg-reports', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        // Karena ini hanya simulasi, kita buat data dummy
        const dummyData: TPGReport[] = [
          {
            teacherId: 'teacher-1',
            teacherName: 'Ahmad Fauzi',
            weekStart: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
            weekEnd: format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
            totalMinutes: 1260, // 21 jam
            requiredMinutes: 1440, // 24 jam
            teachingMinutesByInstitution: [
              { institutionId: 'inst-1', institutionName: 'SDN Cempaka Putih 01', minutes: 720 }, // 12 jam
              { institutionId: 'inst-2', institutionName: 'SMPN 1 Jakarta', minutes: 540 }, // 9 jam
            ],
            sessionsCompleted: 15,
            attendanceDays: 5,
            lateDays: 1,
            isRequirementMet: false,
            weeklyDeficit: 180, // 3 jam kurang
          },
          {
            teacherId: 'teacher-2',
            teacherName: 'Siti Nurhaliza',
            weekStart: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
            weekEnd: format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
            totalMinutes: 1500, // 25 jam
            requiredMinutes: 1440, // 24 jam
            teachingMinutesByInstitution: [
              { institutionId: 'inst-1', institutionName: 'SDN Cempaka Putih 01', minutes: 900 }, // 15 jam
              { institutionId: 'inst-3', institutionName: 'SMAN 1 Depok', minutes: 600 }, // 10 jam
            ],
            sessionsCompleted: 18,
            attendanceDays: 6,
            lateDays: 0,
            isRequirementMet: true,
            weeklyDeficit: 0,
          },
        ];
        
        setReports(dummyData);
        
        // Simulasi data insight
        const dummyInsights: AIInsight[] = [
          {
            id: 'insight-1',
            periodType: 'weekly',
            periodStart: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
            periodEnd: format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
            insightData: {
              summary: "Secara keseluruhan, minggu ini Anda menunjukkan komitmen mengajar yang baik.",
              highlights: [
                "Total jam mengajar mencapai 21 jam dari 24 jam yang dipersyaratkan",
                "Anda mengajar di 2 institusi berbeda minggu ini"
              ],
              recommendations: [
                "Coba tambahkan 3 jam lagi untuk mencapai target mingguan",
                "Pertahankan frekuensi mengajar yang konsisten"
              ]
            },
            createdAt: new Date().toISOString(),
          }
        ];
        
        setInsights(dummyInsights);
      } catch (err: any) {
        console.error('Error fetching TPG reports:', err);
        setError(err.message || 'Gagal mengambil data laporan TPG');
        toast.error('Gagal mengambil data laporan TPG');
      } finally {
        setLoading(false);
      }
    };

    fetchTPGReports();
  }, []);

  const handlePrevWeek = () => {
    setCurrentWeek(prev => subWeeks(prev, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeek(prev => addWeeks(prev, 1));
  };

  const handleGenerateInsight = async () => {
    setGeneratingInsight(true);
    try {
      // Simulasi API call untuk generate insight
      const response = await fetch('/api/attendance/insight', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teacherId: session?.user?.id,
          periodType: 'weekly',
          periodStart: format(currentWeek, 'yyyy-MM-dd'),
          periodEnd: format(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        }),
      });

      if (!response.ok) {
        throw new Error('Gagal mengenerate insight AI');
      }

      const result = await response.json();
      toast.success('Insight AI berhasil digenerate');
    } catch (err: any) {
      console.error('Error generating insight:', err);
      toast.error(err.message || 'Gagal mengenerate insight AI');
    } finally {
      setGeneratingInsight(false);
    }
  };

  const handleExportPDF = () => {
    toast.success('Ekspor PDF dimulai...');
  };

  const currentReport = reports.find(
    r => r.teacherId === session?.user?.id && 
         isWithinInterval(new Date(), {
           start: new Date(r.weekStart),
           end: new Date(r.weekEnd)
         })
  ) || reports[0]; // fallback ke report pertama

  if (loading) {
    return (
      <div className="container mx-auto py-10 px-4 max-w-6xl flex justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
          <p>Memuat laporan TPG...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-10 px-4 max-w-6xl">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-6xl">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6" />
                Rekap TPG (Tunjangan Profesi Guru)
              </CardTitle>
              <CardDescription>
                Rekapitulasi jam tatap muka lintas institusi untuk pencairan TPG
              </CardDescription>
            </div>
            
            <Button onClick={handleExportPDF} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Ekspor PDF
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Navigasi Minggu */}
          <div className="flex items-center justify-between mb-6">
            <Button variant="outline" onClick={handlePrevWeek}>
              &larr; Minggu Sebelumnya
            </Button>
            <div className="text-center">
              <h3 className="font-semibold">
                {format(currentWeek, 'd MMMM yyyy', { locale: id })} -{' '}
                {format(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'd MMMM yyyy', { locale: id })}
              </h3>
              <p className="text-sm text-muted-foreground">Periode Mingguan</p>
            </div>
            <Button variant="outline" onClick={handleNextWeek}>
              Minggu Berikutnya &rarr;
            </Button>
          </div>

          {/* Ringkasan Mingguan */}
          {currentReport && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Ringkasan Minggu Ini
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-3xl font-bold text-primary">
                        {Math.floor(currentReport.totalMinutes / 60)}:{(currentReport.totalMinutes % 60).toString().padStart(2, '0')}
                      </div>
                      <div className="text-sm text-muted-foreground">Jam Mengajar</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className={`text-3xl font-bold ${currentReport.isRequirementMet ? 'text-green-600' : 'text-red-600'}`}>
                        {Math.floor(currentReport.requiredMinutes / 60)}
                      </div>
                      <div className="text-sm text-muted-foreground">Target (jam/minggu)</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-3xl font-bold text-blue-600">
                        {currentReport.sessionsCompleted}
                      </div>
                      <div className="text-sm text-muted-foreground">Sesi Selesai</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className={`text-3xl font-bold ${currentReport.lateDays > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {currentReport.lateDays}
                      </div>
                      <div className="text-sm text-muted-foreground">Hari Terlambat</div>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="mb-6">
                  <div className="flex justify-between mb-1">
                    <span>Progress Pencapaian</span>
                    <span>{Math.round((currentReport.totalMinutes / currentReport.requiredMinutes) * 100)}%</span>
                  </div>
                  <Progress 
                    value={(currentReport.totalMinutes / currentReport.requiredMinutes) * 100} 
                    className="h-3"
                  />
                  {!currentReport.isRequirementMet && (
                    <p className="text-sm text-red-600 mt-2">
                      Kekurangan: {Math.floor(currentReport.weeklyDeficit / 60)} jam {currentReport.weeklyDeficit % 60} menit
                    </p>
                  )}
                </div>
                
                {currentReport.isRequirementMet ? (
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
          )}

          {/* Breakdown Per Institusi */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Breakdown Jam Mengajar Per Institusi
              </CardTitle>
              <CardDescription>
                Distribusi jam mengajar di berbagai institusi tempat Anda bertugas
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
                  {currentReport?.teachingMinutesByInstitution.map((inst, index) => (
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
                          value={(inst.minutes / currentReport.totalMinutes) * 100} 
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        {Math.round((inst.minutes / currentReport.totalMinutes) * 100)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Insight AI */}
          <Tabs defaultValue="insight" className="mb-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="insight">Insight AI</TabsTrigger>
              <TabsTrigger value="details">Detail Harian</TabsTrigger>
            </TabsList>
            <TabsContent value="insight">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Insight Kinerja Mingguan
                    </CardTitle>
                    <Button 
                      onClick={handleGenerateInsight} 
                      disabled={generatingInsight}
                      className="flex items-center gap-2"
                    >
                      <TrendingUp className="h-4 w-4" />
                      {generatingInsight ? 'Memproses...' : 'Generate Insight Baru'}
                    </Button>
                  </div>
                  <CardDescription>
                    Analisis otomatis berbasis AI terhadap pola kehadiran dan jam mengajar Anda
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {insights.length > 0 ? (
                    <div className="space-y-4">
                      {insights.map((insight, index) => (
                        <div key={index} className="p-4 bg-muted rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold">Analisis Mingguan</h4>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(insight.createdAt), 'd MMM yyyy, HH:mm', { locale: id })}
                            </span>
                          </div>
                          
                          <div className="space-y-2">
                            <p className="text-sm">
                              <span className="font-medium">Ringkasan:</span> {insight.insightData.summary}
                            </p>
                            
                            <div>
                              <p className="font-medium text-sm">Poin Penting:</p>
                              <ul className="list-disc pl-5 text-sm space-y-1 mt-1">
                                {insight.insightData.highlights.map((highlight: string, idx: number) => (
                                  <li key={idx}>{highlight}</li>
                                ))}
                              </ul>
                            </div>
                            
                            <div>
                              <p className="font-medium text-sm">Rekomendasi:</p>
                              <ul className="list-disc pl-5 text-sm space-y-1 mt-1">
                                {insight.insightData.recommendations.map((rec: string, idx: number) => (
                                  <li key={idx}>{rec}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted" />
                      <p>Belum ada insight AI untuk periode ini</p>
                      <p className="text-sm mt-1">Klik tombol di atas untuk mengenerate insight</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="details">
              <Card>
                <CardHeader>
                  <CardTitle>Detail Harian</CardTitle>
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
                      {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map((day, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{day}</TableCell>
                          <TableCell>
                            <Badge variant={index < 5 ? 'default' : 'secondary'}>
                              {index < 5 ? 'Hadir' : 'Libur'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {index === 0 && '4 jam'}
                            {index === 1 && '3.5 jam'}
                            {index === 2 && '5 jam'}
                            {index === 3 && '4.5 jam'}
                            {index === 4 && '4 jam'}
                            {index > 4 && '-'}
                          </TableCell>
                          <TableCell>
                            {index === 0 && '2 sesi'}
                            {index === 1 && '2 sesi'}
                            {index === 2 && '3 sesi'}
                            {index === 3 && '2 sesi'}
                            {index === 4 && '2 sesi'}
                            {index > 4 && '-'}
                          </TableCell>
                          <TableCell>
                            {index === 1 && '15 menit'}
                            {index !== 1 && '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}