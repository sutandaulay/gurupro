'use client';

import { apiFetch } from '@/lib/api-client';
import { useState, useEffect, useCallback } from 'react';
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
  Users,
  UserCheck,
  AlertTriangle,
  FileText,
  Loader2,
  RotateCcw,
  ChevronRight,
} from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Pagination } from '@/components/ui/pagination';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { toast } from 'sonner';

interface StudentAttendanceRecord {
  id: string;
  namaSiswa: string;
  nisn?: string | null;
  nomorAbsen?: number | null;
  status: string;
  statusLabel: string;
  catatan?: string | null;
  tanggal: string;
  tanggalLabel: string;
  scheduleId?: string;
  hari?: string;
  jamMulai?: string;
  jamSelesai?: string;
  mapel?: string;
}

interface Summary {
  total: number;
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
  tingkatKehadiran: number;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; dotColor: string; chartColor: string }> = {
  hadir:  { label: 'Hadir', color: 'text-emerald-700',   bgColor: 'bg-emerald-50 border-emerald-200',   dotColor: 'bg-emerald-500',   chartColor: '#10b981' },
  sakit:  { label: 'Sakit',  color: 'text-sky-700',       bgColor: 'bg-sky-50 border-sky-200',           dotColor: 'bg-sky-500',       chartColor: '#0ea5e9' },
  izin:   { label: 'Izin',   color: 'text-violet-700',    bgColor: 'bg-violet-50 border-violet-200',      dotColor: 'bg-violet-500',    chartColor: '#7c3aed' },
  alpa:   { label: 'Alpa',   color: 'text-rose-700',      bgColor: 'bg-rose-50 border-rose-200',         dotColor: 'bg-rose-500',      chartColor: '#f43f5e' },
};

function getStatusBadge(status: string) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'text-gray-700', bgColor: 'bg-gray-50 border-gray-200', dotColor: 'bg-gray-400', chartColor: '#9ca3af' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.bgColor} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
      {cfg.label}
    </span>
  );
}

export default function StudentAttendanceReportsPage() {
  const [records, setRecords] = useState<StudentAttendanceRecord[]>([]);
  const [availableKelas, setAvailableKelas] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    kelasId: '' as string,
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [summary, setSummary] = useState<Summary>({
    total: 0, hadir: 0, sakit: 0, izin: 0, alpa: 0, tingkatKehadiran: 0,
  });
  const [notWaliKelas, setNotWaliKelas] = useState(false);

  const fetchData = useCallback(async (page = 1) => {
    if (!filters.kelasId) {
      // Just load available kelas
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', '1');
        params.set('limit', '100');
        const res = await apiFetch(`/api/attendance/student-reports?${params.toString()}`, { cache: 'no-store' });
        if (res.status === 403) {
          setNotWaliKelas(true);
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error('Gagal mengambil data');
        const json = await res.json();
        setAvailableKelas(json.data || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('kelasId', filters.kelasId);
      params.set('startDate', filters.startDate);
      params.set('endDate', filters.endDate);
      params.set('page', page.toString());
      params.set('limit', pageSize.toString());

      const res = await apiFetch(`/api/attendance/student-reports?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Gagal mengambil data' }));
        throw new Error(err.error || 'Gagal mengambil data');
      }

      const json = await res.json();
      const data = json.data || {};
      setRecords(data.records || []);
      setAvailableKelas(data.availableKelas || []);
      setSummary(data.summary || { total: 0, hadir: 0, sakit: 0, izin: 0, alpa: 0, tingkatKehadiran: 0 });
      if (json.pagination) setPagination(json.pagination);
      setCurrentPage(page);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Gagal mengambil data');
      toast.error(err.message || 'Gagal mengambil data');
    } finally {
      setLoading(false);
    }
  }, [filters, pageSize]);

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const handleExport = async (fmt: 'pdf' | 'docx' | 'xlsx') => {
    if (!filters.kelasId) {
      toast.error('Pilih kelas terlebih dahulu');
      return;
    }
    try {
      setExporting(fmt);
      const params = new URLSearchParams();
      params.set('kelasId', filters.kelasId);
      params.set('startDate', filters.startDate);
      params.set('endDate', filters.endDate);
      params.set('format', fmt);

      const res = await apiFetch(`/api/attendance/student-reports/export?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Gagal mengexport' }));
        throw new Error(err.error || 'Gagal mengexport');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisp = res.headers.get('Content-Disposition');
      const filenameMatch = contentDisp?.match(/filename="?([^"]+)"?/);
      a.download = filenameMatch ? filenameMatch[1] : `laporan-presensi-siswa-${filters.startDate}.${fmt === 'docx' ? 'doc' : fmt}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Berhasil export ${fmt.toUpperCase()}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Gagal mengexport');
    } finally {
      setExporting(null);
    }
  };

  const resetFilters = () => {
    setFilters({
      kelasId: '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
    });
    setRecords([]);
    setPagination(null);
  };

  const chartData = [
    { name: 'Hadir', value: summary.hadir, color: '#10b981' },
    { name: 'Sakit', value: summary.sakit, color: '#0ea5e9' },
    { name: 'Izin', value: summary.izin, color: '#7c3aed' },
    { name: 'Alpa', value: summary.alpa, color: '#f43f5e' },
  ].filter(d => d.value > 0);

  const attendanceRateColor = summary.tingkatKehadiran >= 90
    ? 'text-emerald-600'
    : summary.tingkatKehadiran >= 75
    ? 'text-amber-600'
    : 'text-rose-600';

  const attendanceRateBg = summary.tingkatKehadiran >= 90
    ? 'bg-emerald-100'
    : summary.tingkatKehadiran >= 75
    ? 'bg-amber-100'
    : 'bg-rose-100';

  if (notWaliKelas) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        <EmptyState
          icon="IconUsers"
          title="Bukan Wali Kelas"
          description="Halaman ini hanya dapat diakses oleh wali kelas."
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Laporan Presensi Harian Siswa</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filters.kelasId
              ? `${format(new Date(filters.startDate), 'd MMM yyyy', { locale: id })} — ${format(new Date(filters.endDate), 'd MMM yyyy', { locale: id })}`
              : 'Pilih kelas untuk melihat data'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('pdf')}
            disabled={!filters.kelasId || !!exporting || loading}
          >
            {exporting === 'pdf' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileText className="mr-1 h-4 w-4" />}
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('docx')}
            disabled={!filters.kelasId || !!exporting || loading}
          >
            {exporting === 'docx' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileText className="mr-1 h-4 w-4" />}
            DOCX
          </Button>
          <Button
            onClick={() => handleExport('xlsx')}
            disabled={!filters.kelasId || !!exporting || loading}
            size="sm"
          >
            {exporting === 'xlsx' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {exporting === 'xlsx' ? 'Exporting...' : 'Ekspor Excel'}
          </Button>
        </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs mb-1.5 block">Kelas <span className="text-rose-500">*</span></Label>
              <Select
                value={filters.kelasId || 'none'}
                onValueChange={(val) => {
                  if (val === 'none') {
                    setFilters({ ...filters, kelasId: '' });
                  } else {
                    setFilters({ ...filters, kelasId: val });
                  }
                }}
              >
                <SelectTrigger className="bg-white h-9 text-sm">
                  <SelectValue placeholder="Pilih kelas..." />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="none">— Pilih Kelas —</SelectItem>
                  {availableKelas.map((k: any) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.nama_kelas}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="lg:col-span-2">
              <Label className="text-xs mb-1.5 block">Tanggal</Label>
              <DateRangePicker
                dateRange={{
                  from: new Date(filters.startDate),
                  to: new Date(filters.endDate),
                }}
                onDateRangeChange={(range) => {
                  if (range?.from && range?.to) {
                    setFilters({
                      ...filters,
                      startDate: format(range.from, 'yyyy-MM-dd'),
                      endDate: format(range.to, 'yyyy-MM-dd'),
                    });
                  }
                }}
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-9 text-xs gap-1 text-muted-foreground"
              >
                <RotateCcw className="h-3 w-3" />Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary + Chart */}
      {filters.kelasId && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Tingkat Kehadiran</p>
                    <p className={`text-2xl font-bold mt-1 ${attendanceRateColor}`}>
                      {summary.tingkatKehadiran}%
                    </p>
                  </div>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${attendanceRateBg}`}>
                    <UserCheck className={`w-5 h-5 ${attendanceRateColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const count = summary[key as keyof typeof summary] as number;
              return (
                <Card key={key} className="border-0 shadow-sm">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">{cfg.label}</p>
                        <p className={`text-2xl font-bold mt-1 ${cfg.color.split(' ')[0]}`}>
                          {count}
                        </p>
                      </div>
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cfg.bgColor}`}>
                        <span className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Distribusi Status Kehadiran</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : (
                  <div className="flex items-center justify-center gap-8">
                    <ResponsiveContainer width={200} height={200}>
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {chartData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          formatter={(value) => [`${String(value)} siswa`, '']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-3">
                      {chartData.map((entry) => (
                        <div key={entry.name} className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                          <span className="text-sm font-medium">{entry.name}: {entry.value}</span>
                          <span className="text-xs text-muted-foreground">
                            ({summary.total > 0 ? Math.round((entry.value / summary.total) * 100) : 0}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Table */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              {filters.kelasId
                ? `Rincian (${records.length} data${pagination && pagination.totalRecords > records.length ? ` dari ${pagination.totalRecords}` : ''})`
                : 'Pilih kelas untuk melihat presensi'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!filters.kelasId ? (
            <div className="p-8 text-center">
              <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Pilih kelas di atas untuk melihat data presensi siswa.</p>
            </div>
          ) : loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => fetchData(currentPage)}>
                Coba Lagi
              </Button>
            </div>
          ) : records.length === 0 ? (
            <EmptyState
              icon="IconCalendarOff"
              title="Belum ada data presensi"
              description={`Tidak ada data presensi siswa untuk kelas ini pada periode ${filters.startDate} — ${filters.endDate}.`}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="w-8 text-xs">No</TableHead>
                      <TableHead className="text-xs">No. Absen</TableHead>
                      <TableHead className="text-xs">Nama Siswa</TableHead>
                      <TableHead className="text-xs">NISN</TableHead>
                      <TableHead className="text-xs">Tanggal</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((rec, idx) => (
                      <TableRow key={rec.id} className="hover:bg-slate-50 transition-colors">
                        <TableCell className="text-xs text-muted-foreground py-2">
                          {(currentPage - 1) * pageSize + idx + 1}
                        </TableCell>
                        <TableCell className="py-2 text-xs">
                          {rec.nomorAbsen != null ? rec.nomorAbsen : '-'}
                        </TableCell>
                        <TableCell className="py-2">
                          <p className="text-sm font-medium">{rec.namaSiswa}</p>
                        </TableCell>
                        <TableCell className="py-2 text-xs">
                          {rec.nisn || '-'}
                        </TableCell>
                        <TableCell className="py-2">
                          <span className="text-xs">
                            {rec.tanggalLabel || format(new Date(rec.tanggal), 'EEE, d MMM', { locale: id })}
                          </span>
                          {rec.mapel && (
                            <p className="text-[10px] text-muted-foreground">{rec.mapel} ({rec.jamMulai})</p>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          {getStatusBadge(rec.status)}
                        </TableCell>
                        <TableCell className="py-2">
                          <span className="text-xs text-muted-foreground max-w-[150px] truncate block">
                            {rec.catatan || '-'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pagination && pagination.totalRecords > 0 && (
                <div className="px-4 py-3 border-t border-slate-200">
                  <Pagination
                    page={pagination.currentPage}
                    pageSize={pageSize}
                    total={pagination.totalRecords}
                    totalPages={pagination.totalPages}
                    onPageChange={(p) => fetchData(p)}
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
