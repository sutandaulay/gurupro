'use client';

import { apiFetch } from "@/lib/api-client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTeacherStore } from "@/lib/stores";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/app/components/ui/empty-state';
import {
  Calendar as CalendarIcon,
  Download,
  Filter,
  Clock,
  AlertTriangle,
  UserCheck,
  BookOpen,
  Search,
  Loader2,
  RotateCcw,
  ChevronRight,
  Building2,
  GraduationCap,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subDays, startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Pagination } from '@/components/ui/pagination';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { toast } from 'sonner';

interface AttendanceReport {
  id: string;
  teacherId: string;
  teacherName: string;
  institutionId: string | number | null;
  institutionName: string;
  date: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  attendanceStatus: string;
  teachingMinutesTotal: number;
  teachingSessionsCompleted: number;
  scheduledSessions: number;
  lateMinutes: number;
  isSchoolBased?: boolean;
  verification?: {
    faceMatchScore?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    accuracy?: number | null;
    livenessPassed?: boolean;
    catatan?: string | null;
  } | null;
}

interface FilterOption {
  id: string;
  name: string;
}

interface Summary {
  totalDays: number;
  attendanceRate: number;
  totalTeachingMinutes: number;
  totalTeachingSessions: number;
  scheduledSessions: number;
  lateCount: number;
  totalLateMinutes: number;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface DatePreset {
  label: string;
  getValue: () => { startDate: Date; endDate: Date };
}

const DATE_PRESETS: DatePreset[] = [
  {
    label: 'Hari Ini',
    getValue: () => ({ startDate: startOfDay(new Date()), endDate: endOfDay(new Date()) }),
  },
  {
    label: '7 Hari Terakhir',
    getValue: () => ({ startDate: startOfDay(subDays(new Date(), 6)), endDate: endOfDay(new Date()) }),
  },
  {
    label: '30 Hari Terakhir',
    getValue: () => ({ startDate: startOfDay(subDays(new Date(), 29)), endDate: endOfDay(new Date()) }),
  },
  {
    label: 'Minggu Ini',
    getValue: () => ({ startDate: startOfWeek(new Date(), { weekStartsOn: 1 }), endDate: endOfWeek(new Date(), { weekStartsOn: 1 }) }),
  },
  {
    label: 'Bulan Ini',
    getValue: () => ({ startDate: startOfMonth(new Date()), endDate: endOfMonth(new Date()) }),
  },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; dotColor: string }> = {
  hadir:    { label: 'Hadir',    color: 'text-emerald-700',    bgColor: 'bg-emerald-50 border-emerald-200',    dotColor: 'bg-emerald-500' },
  telat:    { label: 'Telat',    color: 'text-amber-700',      bgColor: 'bg-amber-50 border-amber-200',       dotColor: 'bg-amber-500' },
  sakit:    { label: 'Sakit',    color: 'text-sky-700',        bgColor: 'bg-sky-50 border-sky-200',           dotColor: 'bg-sky-500' },
  izin:     { label: 'Izin',     color: 'text-blue-700',       bgColor: 'bg-blue-50 border-blue-200',          dotColor: 'bg-blue-500' },
  cuti:     { label: 'Cuti',     color: 'text-indigo-700',     bgColor: 'bg-indigo-50 border-indigo-200',      dotColor: 'bg-indigo-500' },
  alpa:     { label: 'Alpa',     color: 'text-rose-700',       bgColor: 'bg-rose-50 border-rose-200',          dotColor: 'bg-rose-500' },
};

function formatTeachingTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}

function getStatusBadge(status: string) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.alpa;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.bgColor} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
      {cfg.label}
    </span>
  );
}

function TrendIndicator({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (value > 0) return <span className="text-emerald-600 text-xs font-medium flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />+{value}{suffix}</span>;
  if (value < 0) return <span className="text-rose-600 text-xs font-medium flex items-center gap-0.5"><TrendingDown className="w-3 h-3" />{value}{suffix}</span>;
  return <span className="text-slate-400 text-xs flex items-center gap-0.5"><Minus className="w-3 h-3" />0{suffix}</span>;
}

function AttendanceReportRows({
  reports,
  currentPage,
  expandedRow,
  onToggle,
}: {
  reports: AttendanceReport[];
  currentPage: number;
  expandedRow: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <>
      {reports.map((report, idx) => {
        const dateObj = report.date ? new Date(report.date) : null;
        const checkIn = report.checkInTime ? new Date(report.checkInTime) : null;
        const checkOut = report.checkOutTime ? new Date(report.checkOutTime) : null;
        const isExpanded = expandedRow === report.id;

        return (
          <AttendanceReportRow
            key={report.id}
            report={report}
            idx={idx}
            dateObj={dateObj}
            checkIn={checkIn}
            checkOut={checkOut}
            isExpanded={isExpanded}
            currentPage={currentPage}
            onToggle={() => onToggle(report.id)}
          />
        );
      })}
    </>
  );
}

function AttendanceReportRow({
  report,
  idx,
  dateObj,
  checkIn,
  checkOut,
  isExpanded,
  currentPage,
  onToggle,
}: {
  report: AttendanceReport;
  idx: number;
  dateObj: Date | null;
  checkIn: Date | null;
  checkOut: Date | null;
  isExpanded: boolean;
  currentPage: number;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow
        className={`cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50' : ''}`}
        onClick={onToggle}
      >
        <TableCell className="text-xs text-muted-foreground py-2">
          {(currentPage - 1) * 15 + idx + 1}
        </TableCell>
        <TableCell className="py-2">
          <p className="text-sm font-medium">{report.teacherName}</p>
        </TableCell>
        <TableCell className="py-2">
          <div className="flex items-center gap-1.5">
            {report.isSchoolBased ? (
              <GraduationCap className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
            ) : (
              <Building2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            )}
            <span className="text-xs">{report.institutionName}</span>
          </div>
        </TableCell>
        <TableCell className="py-2">
          <span className="text-xs">
            {dateObj ? format(dateObj, 'EEE, d MMM', { locale: id }) : '-'}
          </span>
        </TableCell>
        <TableCell className="py-2">
          <span className="text-xs">{checkIn ? format(checkIn, 'HH:mm') : '-'}</span>
        </TableCell>
        <TableCell className="py-2">
          <span className="text-xs">{checkOut ? format(checkOut, 'HH:mm') : '-'}</span>
        </TableCell>
        <TableCell className="py-2">
          {getStatusBadge(report.attendanceStatus)}
        </TableCell>
        <TableCell className="py-2 text-right">
          <span className="text-xs font-medium">
            {report.teachingMinutesTotal > 0 ? formatTeachingTime(report.teachingMinutesTotal) : '-'}
          </span>
        </TableCell>
        <TableCell className="py-2 text-right">
          <span className="text-xs">
            {report.teachingSessionsCompleted > 0
              ? `${report.teachingSessionsCompleted}${report.scheduledSessions > 0 ? `/${report.scheduledSessions}` : ''}`
              : '-'}
          </span>
        </TableCell>
        <TableCell className="py-2">
          <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow className="bg-slate-50/50 hover:bg-slate-50">
          <TableCell colSpan={10} className="p-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Telat</p>
                <p className="font-medium mt-0.5">{report.lateMinutes > 0 ? `${report.lateMinutes} menit` : '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Verifikasi</p>
                <p className="font-medium mt-0.5">
                  {report.verification?.livenessPassed !== undefined
                    ? report.verification.livenessPassed ? 'Liveness ✓' : 'Liveness ✗'
                    : '-'}
                </p>
              </div>
              {report.verification?.faceMatchScore && (
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Face Match</p>
                  <p className="font-medium mt-0.5">{report.verification.faceMatchScore}%</p>
                </div>
              )}
              {report.verification?.catatan && (
                <div className="col-span-2 sm:col-span-4">
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Catatan</p>
                  <p className="mt-0.5">{report.verification.catatan}</p>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function AttendanceReportsPage() {
  const { activeSchoolId } = useTeacherStore();
  const [reports, setReports] = useState<AttendanceReport[]>([]);
  const [institutions, setInstitutions] = useState<FilterOption[]>([]);
  const [teachers, setTeachers] = useState<FilterOption[]>([]);
  const [filters, setFilters] = useState({
    period: 'monthly' as string,
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date()),
    teacherId: '' as string,
    institutionId: '' as string,
    search: '' as string,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary>({
    totalDays: 0,
    attendanceRate: 0,
    totalTeachingMinutes: 0,
    totalTeachingSessions: 0,
    scheduledSessions: 0,
    lateCount: 0,
    totalLateMinutes: 0,
  });

  const fetchReports = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('period', filters.period);
      params.set('startDate', format(filters.startDate, 'yyyy-MM-dd'));
      params.set('endDate', format(filters.endDate, 'yyyy-MM-dd'));
      params.set('page', page.toString());
      params.set('limit', pageSize.toString());
      if (activeSchoolId) params.set('schoolId', activeSchoolId);
      if (filters.teacherId && filters.teacherId !== 'all') params.set('teacherId', filters.teacherId);
      if (filters.institutionId && filters.institutionId !== 'all') params.set('institutionId', filters.institutionId);
      if (filters.search) params.set('search', filters.search);

      const res = await apiFetch(`/api/attendance/reports?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Gagal mengambil data' }));
        throw new Error(err.error || 'Gagal mengambil data laporan');
      }

      const json = await res.json();
      const data: AttendanceReport[] = json.data || [];
      setReports(data);

      if (json.summary) setSummary(json.summary);
      if (json.pagination) setPagination(json.pagination);
      setCurrentPage(page);

      const uniqueInstitutions = Array.from(
        new Map(data.map((r) => [String(r.institutionId), { id: String(r.institutionId) || '', name: r.institutionName }])).values()
      ).filter((i) => i.id && i.name);
      const uniqueTeachers = Array.from(
        new Map(data.map((r) => [r.teacherId, { id: r.teacherId, name: r.teacherName }])).values()
      );
      setInstitutions(uniqueInstitutions);
      setTeachers(uniqueTeachers);
    } catch (err: any) {
      console.error('Error fetching reports:', err);
      setError(err.message || 'Gagal mengambil data laporan');
      toast.error(err.message || 'Gagal mengambil data laporan');
    } finally {
      setLoading(false);
    }
  }, [filters, pageSize]);

  useEffect(() => {
    fetchReports(1);
  }, [fetchReports]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      params.set('period', filters.period);
      params.set('startDate', format(filters.startDate, 'yyyy-MM-dd'));
      params.set('endDate', format(filters.endDate, 'yyyy-MM-dd'));
      if (activeSchoolId) params.set('schoolId', activeSchoolId);
      if (filters.teacherId && filters.teacherId !== 'all') params.set('teacherId', filters.teacherId);
      if (filters.institutionId && filters.institutionId !== 'all') params.set('institutionId', filters.institutionId);
      if (filters.search) params.set('search', filters.search);

      const res = await apiFetch(`/api/attendance/reports/export?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Gagal export' }));
        throw new Error(err.error || 'Gagal mengexport laporan');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `laporan-presensi-${format(filters.startDate, 'yyyy-MM-dd')}-${format(filters.endDate, 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Laporan berhasil diekspor');
    } catch (err: any) {
      console.error('Export error:', err);
      toast.error(err.message || 'Gagal mengexport laporan');
    } finally {
      setExporting(false);
    }
  };

  const resetFilters = () => {
    setFilters({
      period: 'monthly',
      startDate: startOfMonth(new Date()),
      endDate: endOfMonth(new Date()),
      teacherId: '',
      institutionId: '',
      search: '',
    });
  };

  const applyPreset = (preset: DatePreset) => {
    const { startDate, endDate } = preset.getValue();
    setFilters({ ...filters, startDate, endDate, period: 'custom' });
  };

  const chartData = useMemo(() => {
    const map = new Map<string, { date: string; count: number; minutes: number; hadir: number; alpa: number; telat: number }>();
    reports.forEach((r) => {
      const d = r.date ? new Date(r.date) : null;
      const label = d ? format(d, 'dd MMM') : r.date;
      const existing = map.get(label) || { date: label, count: 0, minutes: 0, hadir: 0, alpa: 0, telat: 0 };
      existing.count++;
      existing.minutes += r.teachingMinutesTotal || 0;
      if (r.attendanceStatus === 'hadir') existing.hadir++;
      else if (r.attendanceStatus === 'telat') existing.telat++;
      else if (r.attendanceStatus === 'alpa') existing.alpa++;
      map.set(label, existing);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [reports]);

  const attendanceRateColor = summary.attendanceRate >= 90
    ? 'text-emerald-600'
    : summary.attendanceRate >= 75
    ? 'text-amber-600'
    : 'text-rose-600';

  return (
    <div className="container mx-auto py-6 px-4 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Laporan Presensi & Jam Mengajar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(filters.startDate, 'd MMM yyyy', { locale: id })} — {format(filters.endDate, 'd MMM yyyy', { locale: id })}
          </p>
        </div>
        <Button onClick={handleExport} disabled={exporting || loading || reports.length === 0} size="sm">
          {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {exporting ? 'Mengexport...' : 'Ekspor Excel'}
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Tingkat Kehadiran</p>
                <p className={`text-2xl font-bold mt-1 ${attendanceRateColor}`}>{summary.attendanceRate}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">{summary.totalDays} hari dalam periode</p>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                summary.attendanceRate >= 90 ? 'bg-emerald-100' :
                summary.attendanceRate >= 75 ? 'bg-amber-100' : 'bg-rose-100'
              }`}>
                <UserCheck className={`w-5 h-5 ${
                  summary.attendanceRate >= 90 ? 'text-emerald-600' :
                  summary.attendanceRate >= 75 ? 'text-amber-600' : 'text-rose-600'
                }`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Jam Mengajar</p>
                <p className="text-2xl font-bold mt-1">{formatTeachingTime(summary.totalTeachingMinutes)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{summary.totalTeachingSessions} sesi mengajar</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Sesi Selesai</p>
                <p className="text-2xl font-bold mt-1">{summary.totalTeachingSessions}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {summary.scheduledSessions > 0 ? `dari ${summary.scheduledSessions} terjadwal` : 'tanpa target'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Keterlambatan</p>
                <p className="text-2xl font-bold mt-1">{summary.lateCount}×</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  total {summary.totalLateMinutes} menit
                </p>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                summary.lateCount > 5 ? 'bg-rose-100' : 'bg-amber-100'
              }`}>
                <AlertTriangle className={`w-5 h-5 ${summary.lateCount > 5 ? 'text-rose-600' : 'text-amber-600'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filter Laporan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date presets */}
          <div className="flex flex-wrap gap-2">
            {DATE_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => applyPreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2">
              <DateRangePicker
                dateRange={{ from: filters.startDate, to: filters.endDate }}
                onDateRangeChange={(range) => {
                  if (range?.from && range?.to) {
                    setFilters({ ...filters, startDate: range.from, endDate: range.to, period: 'custom' });
                  }
                }}
              />
            </div>

            <div>
              <Label className="text-xs mb-1.5 block">Institusi / Sekolah</Label>
              <Select
                value={filters.institutionId || 'all'}
                onValueChange={(val) => setFilters({ ...filters, institutionId: val === 'all' ? '' : val })}
              >
                <SelectTrigger className="bg-white h-9 text-sm"><SelectValue placeholder="Semua" /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">Semua Institusi</SelectItem>
                  {institutions.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs mb-1.5 block">Guru</Label>
              <Select
                value={filters.teacherId || 'all'}
                onValueChange={(val) => setFilters({ ...filters, teacherId: val === 'all' ? '' : val })}
              >
                <SelectTrigger className="bg-white h-9 text-sm"><SelectValue placeholder="Semua" /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">Semua Guru</SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs mb-1.5 block">Cari</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Nama..."
                  className="h-9 pl-8 text-sm"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && fetchReports(1)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-7 text-xs gap-1 text-muted-foreground"
            >
              <RotateCcw className="h-3 w-3" />Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Distribusi Kehadiran</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : reports.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              Tidak ada data
            </div>
          ) : (
            <ResponsiveContainer height={200} width="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(value, name) => {
                    const labels: Record<string, string> = { hadir: 'Hadir', telat: 'Telat', alpa: 'Alpa', count: 'Total' };
                    return [value, labels[String(name)] || name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="hadir" stackId="a" fill="#10b981" name="Hadir" radius={[0, 0, 0, 0]} />
                <Bar dataKey="telat" stackId="a" fill="#f59e0b" name="Telat" />
                <Bar dataKey="alpa" stackId="a" fill="#f87171" name="Alpa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              Rincian ({reports.length} data{pagination && pagination.totalRecords > reports.length ? ` dari ${pagination.totalRecords}` : ''})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => fetchReports(currentPage)}>
                Coba Lagi
              </Button>
            </div>
          ) : reports.length === 0 ? (
            <EmptyState
              icon="IconCalendarOff"
              title="Belum ada data presensi"
              description="Rekapan presensi untuk periode ini masih kosong."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="w-8 text-xs">No</TableHead>
                      <TableHead className="text-xs">Nama Guru</TableHead>
                      <TableHead className="text-xs">Sekolah</TableHead>
                      <TableHead className="text-xs">Tanggal</TableHead>
                      <TableHead className="text-xs">Masuk</TableHead>
                      <TableHead className="text-xs">Pulang</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-right">Jam Mengajar</TableHead>
                      <TableHead className="text-xs text-right">Sesi</TableHead>
                      <TableHead className="text-xs w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AttendanceReportRows
                      reports={reports}
                      currentPage={currentPage}
                      expandedRow={expandedRow}
                      onToggle={(id) => setExpandedRow(expandedRow === id ? null : id)}
                    />
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalRecords > 0 && (
                <div className="px-4 py-3 border-t border-slate-200">
                  <Pagination
                    page={pagination.currentPage}
                    pageSize={pageSize}
                    total={pagination.totalRecords}
                    totalPages={pagination.totalPages}
                    onPageChange={(p) => fetchReports(p)}
                    onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                    loading={loading}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
