'use client';
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pagination } from '@/components/ui/pagination';
import { Calendar, Clock, TrendingUp, AlertTriangle, CheckCircle, FileText, Download, Loader2, CalendarDays, BarChart3 } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
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
  weeklyDeficit: number;
}

interface AIInsight {
  id: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  insightData: any;
  createdAt: string;
}

interface DailyReport {
  id: string;
  teacherId: string;
  teacherName: string;
  institutionName: string;
  date: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  attendanceStatus: string;
  teachingMinutesTotal: number;
  teachingSessionsCompleted: number;
  scheduledSessions: number;
  lateMinutes: number;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const PERIOD_TYPE_OPTIONS = [
  { value: 'weekly', label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
] as const;

export default function TPGReportPage() {
  const { data: session } = useSession();
  const [reports, setReports] = useState<TPGReport[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [currentWeek, setCurrentWeek] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly'>('weekly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingInsight, setGeneratingInsight] = useState(false);
  const [dailyPage, setDailyPage] = useState(1);
  const [dailyPageSize] = useState(25);
  const [dailyPagination, setDailyPagination] = useState<PaginationInfo | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);

  // Sprint 3.2 — Toggle & data agregasi lintas institusi
  const [showCrossInstitution, setShowCrossInstitution] = useState(false);
  const [crossData, setCrossData] = useState<any>(null);
  const [crossLoading, setCrossLoading] = useState(false);
  const [crossError, setCrossError] = useState<string | null>(null);

  const startDate = periodType === 'weekly'
    ? currentWeek
    : startOfMonth(currentWeek);
  const endDate = periodType === 'weekly'
    ? endOfWeek(currentWeek, { weekStartsOn: 1 })
    : endOfMonth(currentWeek);

  const periodStartStr = format(startDate, 'yyyy-MM-dd');
  const periodEndStr = format(endDate, 'yyyy-MM-dd');

  const fetchTPGReports = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('periodType', periodType);
      params.set('periodStart', periodStartStr);
      params.set('periodEnd', periodEndStr);
      if (session?.user?.id) {
        params.set('teacherId', session.user.id);
      }

      const response = await apiFetch(`/api/attendance/tpg-reports?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Gagal mengambil data laporan TPG' }));
        throw new Error(err.error || 'Gagal mengambil data laporan TPG');
      }

      const result = await response.json();
      setReports(result.reports || []);
    } catch (err: any) {
      console.error('Error fetching TPG reports:', err);
      setError(err.message || 'Gagal mengambil data laporan TPG');
      toast.error(err.message || 'Gagal mengambil data laporan TPG');
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyReports = async (page = 1) => {
    if (!session?.user?.id) return;
    try {
      setDailyLoading(true);
      const params = new URLSearchParams();
      params.set('period', 'custom');
      params.set('startDate', periodStartStr);
      params.set('endDate', periodEndStr);
      params.set('teacherId', session.user.id);
      params.set('page', page.toString());
      params.set('limit', dailyPageSize.toString());

      const res = await apiFetch(`/api/attendance/reports?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Gagal mengambil data harian' }));
        throw new Error(err.error || 'Gagal mengambil data detail harian');
      }

      const json = await res.json();
      setDailyReports(json.data || []);
      if (json.pagination) setDailyPagination(json.pagination);
      setDailyPage(page);
    } catch (err: any) {
      console.error('Error fetching daily reports:', err);
      toast.error(err.message || 'Gagal mengambil data detail harian');
    } finally {
      setDailyLoading(false);
    }
  };

  const fetchInsights = async () => {
    if (!session?.user?.id) return;
    try {
      const params = new URLSearchParams();
      params.set('periodType', periodType);
      params.set('periodStart', periodStartStr);
      params.set('periodEnd', periodEndStr);

      const res = await apiFetch(`/api/attendance/insight?${params.toString()}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const mapped: AIInsight[] = (json.insights || []).map((insight: any) => ({
            id: insight.id,
            periodType: insight.period_type,
            periodStart: insight.period_start,
            periodEnd: insight.period_end,
            insightData: insight.insight_data,
            createdAt: insight.created_at,
          }));
          setInsights(mapped);
        }
      }
    } catch (err: any) {
      console.error('Error fetching insights:', err);
    }
  };

  const fetchCrossInstitution = async () => {
    setCrossLoading(true);
    setCrossError(null);
    try {
      const params = new URLSearchParams();
      params.set('periodType', periodType);
      params.set('periodStart', periodStartStr);
      params.set('periodEnd', periodEndStr);

      const res = await apiFetch(`/api/attendance/tpg-reports-cross-institution?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Gagal memuat agregat lintas institusi");
      const data = await res.json();
      setCrossData(data);
      setShowCrossInstitution(true);
    } catch (e: any) {
      setCrossError(e.message || "Gagal memuat data lintas institusi");
    } finally {
      setCrossLoading(false);
    }
  };

  useEffect(() => {
    fetchTPGReports();
    fetchInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, periodStartStr, periodEndStr, session?.user?.id]);

  useEffect(() => {
    setDailyPage(1);
  }, [periodType, startDate, endDate]);

  const handlePrevPeriod = () => {
    const prev = periodType === 'weekly'
      ? subWeeks(currentWeek, 1)
      : subMonths(currentWeek, 1);
    setCurrentWeek(prev);
  };

  const handleNextPeriod = () => {
    const next = periodType === 'weekly'
      ? addWeeks(currentWeek, 1)
      : addMonths(currentWeek, 1);
    setCurrentWeek(next);
  };

  const handleGenerateInsight = async () => {
    setGeneratingInsight(true);
    try {
      const response = await apiFetch('/api/attendance/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: session?.user?.id,
          periodType,
          periodStart: periodStartStr,
          periodEnd: periodEndStr,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Gagal mengenerate insight AI' }));
        throw new Error(err.error || 'Gagal mengenerate insight AI');
      }

      const result = await response.json();
      toast.success('Insight AI berhasil digenerate');

      if (result.insightData) {
        const newInsight: AIInsight = {
          id: result.id || `insight-${Date.now()}`,
          periodType,
          periodStart: periodStartStr,
          periodEnd: periodEndStr,
          insightData: result.insightData,
          createdAt: new Date().toISOString(),
        };
        setInsights([newInsight, ...insights]);
      }

      fetchInsights();
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
         new Date(r.weekStart) <= endDate &&
         new Date(r.weekEnd) >= startDate
  ) || reports[0];

  const formatPeriodLabel = () => {
    if (periodType === 'weekly') {
      return `${format(startDate, 'd MMMM yyyy', { locale: id })} - ${format(endDate, 'd MMMM yyyy', { locale: id })}`;
    }
    return `${format(startDate, 'd MMMM yyyy', { locale: id })} - ${format(endDate, 'd MMMM yyyy', { locale: id })}`;
  };

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
          {/* Period Type Selector */}
          <div className="mb-4 flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600">Tipe Periode:</span>
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              {PERIOD_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setPeriodType(opt.value);
                    const now = new Date();
                    setCurrentWeek(opt.value === 'weekly' ? startOfWeek(now, { weekStartsOn: 1 }) : startOfMonth(now));
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    periodType === opt.value
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Navigasi Periode */}
          <div className="flex items-center justify-between mb-6">
            <Button variant="outline" onClick={handlePrevPeriod}>
              &larr; {periodType === 'weekly' ? 'Minggu Sebelumnya' : 'Bulan Sebelumnya'}
            </Button>
            <div className="text-center">
              <h3 className="font-semibold">
                {formatPeriodLabel()}
              </h3>
              <p className="text-sm text-muted-foreground">
                Periode {periodType === 'weekly' ? 'Mingguan' : 'Bulanan'}
              </p>
            </div>
            <Button variant="outline" onClick={handleNextPeriod}>
              {periodType === 'weekly' ? 'Minggu Berikutnya' : 'Bulan Berikutnya'} &rarr;
            </Button>
          </div>

          {/* Sprint 3.2 — Toggle agregasi lintas institusi */}
          <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl mb-6">
            <div>
              <p className="text-sm font-semibold text-slate-700">Lihat Rekap Lintas Institusi</p>
              <p className="text-[11px] text-slate-500">Gabungan jam mengajar dari semua sekolah tempat Anda bertugas</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCrossInstitution}
              disabled={crossLoading}
            >
              {crossLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Memuat...
                </>
              ) : showCrossInstitution ? "Segarkan" : "Semua Institusi"}
            </Button>
          </div>

          {crossError && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{crossError}</AlertDescription>
            </Alert>
          )}

          {showCrossInstitution && crossData && (
            <Card className="mb-6 border-indigo-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-indigo-700">
                  <TrendingUp className="h-5 w-5" />
                  Rekap Lintas Institusi {crossData.cached ? "(cache)" : ""}
                </CardTitle>
                <CardDescription>
                  Total jam mengajar dari {crossData.institutions?.length || 0} institusi
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-3xl font-bold text-primary">
                        {Math.floor((crossData.total?.minutes || 0) / 60)}:{((crossData.total?.minutes || 0) % 60).toString().padStart(2, "0")}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Jam</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-3xl font-bold text-blue-600">{crossData.total?.sessions || 0}</div>
                      <div className="text-sm text-muted-foreground">Sesi Selesai</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-3xl font-bold text-green-600">{crossData.total?.attendanceDays || 0}</div>
                      <div className="text-sm text-muted-foreground">Hari Hadir</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className={`text-3xl font-bold ${crossData.isRequirementMet ? "text-green-600" : "text-red-600"}`}>
                        {crossData.isRequirementMet ? "✓" : "✗"}
                      </div>
                      <div className="text-sm text-muted-foreground">Cukup TPG?</div>
                    </CardContent>
                  </Card>
                </div>
                <div className="space-y-2">
                  {(crossData.institutions || []).map((inst: any) => (
                    <div key={inst.institutionId} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2">
                      <span className="font-medium text-slate-700">{inst.institutionName}</span>
                      <span className="text-slate-500">
                        {Math.floor(inst.minutes / 60)}j {inst.minutes % 60}m • {inst.sessions} sesi
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ringkasan Mingguan/Bulanan */}
          {currentReport && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Ringkasan {periodType === 'weekly' ? 'Minggu Ini' : 'Bulan Ini'}
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
                      <div className="text-sm text-muted-foreground">Target ({periodType === 'weekly' ? 'jam/minggu' : 'jam/bulan'})</div>
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
                    <span>Target {periodType === 'weekly' ? 'mingguan' : 'bulanan'} telah tercapai!</span>
                  </div>
                ) : (
                  <div className="flex items-center text-red-600">
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    <span>Target {periodType === 'weekly' ? 'mingguan' : 'bulanan'} belum tercapai</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Breakdown Per Institusi */}
          {currentReport && currentReport.teachingMinutesByInstitution.length > 0 && (
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
                    {currentReport.teachingMinutesByInstitution.map((inst, index) => (
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
          )}

          {/* Insight AI & Detail Harian */}
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
                      Insight Kinerja {periodType === 'weekly' ? 'Mingguan' : 'Bulanan'}
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
                        <div key={insight.id || index} className="p-4 bg-muted rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold">Analisis {periodType === 'weekly' ? 'Mingguan' : 'Bulanan'}</h4>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(insight.createdAt), 'd MMM yyyy, HH:mm', { locale: id })}
                            </span>
                          </div>

                          <div className="space-y-2">
                            <p className="text-sm">
                              <span className="font-medium">Ringkasan:</span> {insight.insightData?.summary || 'Tidak ada ringkasan tersedia.'}
                            </p>

                            {insight.insightData?.highlights && (
                              <div>
                                <p className="font-medium text-sm">Poin Penting:</p>
                                <ul className="list-disc pl-5 text-sm space-y-1 mt-1">
                                  {insight.insightData.highlights.map((highlight: string, idx: number) => (
                                    <li key={idx}>{highlight}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {insight.insightData?.recommendations && (
                              <div>
                                <p className="font-medium text-sm">Rekomendasi:</p>
                                <ul className="list-disc pl-5 text-sm space-y-1 mt-1">
                                  {insight.insightData.recommendations.map((rec: string, idx: number) => (
                                    <li key={idx}>{rec}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
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
                    Rincian kehadiran dan jam mengajar per hari ({periodStartStr} — {periodEndStr})
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {dailyLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-10 bg-gray-200 animate-pulse rounded" />
                      ))}
                    </div>
                  ) : dailyReports.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted" />
                      <p>Tidak ada data presensi untuk periode ini</p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Tanggal</TableHead>
                              <TableHead>Institusi</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Jam Mengajar</TableHead>
                              <TableHead>Sesi</TableHead>
                              <TableHead>Masuk</TableHead>
                              <TableHead>Pulang</TableHead>
                              <TableHead>Telat (mnt)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dailyReports.map((report) => {
                              const dateObj = report.date ? new Date(report.date) : null;
                              const dateStr = dateObj ? format(dateObj, 'EEE, d MMM', { locale: id }) : '-';
                              const checkIn = report.checkInTime ? new Date(report.checkInTime) : null;
                              const checkOut = report.checkOutTime ? new Date(report.checkOutTime) : null;
                              return (
                                <TableRow key={report.id}>
                                  <TableCell className="text-xs">{dateStr}</TableCell>
                                  <TableCell className="text-xs">{report.institutionName || '-'}</TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        report.attendanceStatus === 'hadir' ? 'default' :
                                        report.attendanceStatus === 'telat' ? 'warning' :
                                        report.attendanceStatus === 'sakit' ? 'info' :
                                        report.attendanceStatus === 'izin' ? 'secondary' :
                                        report.attendanceStatus === 'cuti' ? 'secondary' :
                                        'destructive'
                                      }
                                      className="text-xs"
                                    >
                                      {report.attendanceStatus || '-'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {report.teachingMinutesTotal > 0
                                      ? `${Math.floor(report.teachingMinutesTotal / 60)}j ${report.teachingMinutesTotal % 60}m`
                                      : '-'}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {report.teachingSessionsCompleted > 0
                                      ? `${report.teachingSessionsCompleted}${report.scheduledSessions > 0 ? `/${report.scheduledSessions}` : ''}`
                                      : '-'}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {checkIn ? format(checkIn, 'HH:mm') : '-'}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {checkOut ? format(checkOut, 'HH:mm') : '-'}
                                  </TableCell>
                                  <TableCell className="text-xs text-right">
                                    {report.lateMinutes > 0 ? report.lateMinutes : '-'}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {dailyPagination && dailyPagination.totalRecords > 0 && (
                        <div className="px-0 pt-4">
                          <Pagination
                            page={dailyPagination.currentPage}
                            pageSize={dailyPageSize}
                            total={dailyPagination.totalRecords}
                            totalPages={dailyPagination.totalPages}
                            onPageChange={(p) => fetchDailyReports(p)}
                            onPageSizeChange={() => {}}
                            loading={dailyLoading}
                          />
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
