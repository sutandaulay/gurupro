'use client';

import { apiFetch } from '@/lib/api-client';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/app/components/ui/empty-state';
import {
  CalendarIcon,
  Download,
  Filter,
  Users,
  UserCheck,
  AlertTriangle,
  FileText,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Pagination } from '@/components/ui/pagination';
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
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; dotColor: string }> = {
  hadir:  { label: 'Hadir', color: 'text-emerald-600',   bgColor: 'bg-emerald-50 border-emerald-200',   dotColor: 'bg-emerald-500' },
  sakit:  { label: 'Sakit',  color: 'text-sky-600',       bgColor: 'bg-sky-50 border-sky-200',           dotColor: 'bg-sky-500' },
  izin:   { label: 'Izin',   color: 'text-violet-600',    bgColor: 'bg-violet-50 border-violet-200',      dotColor: 'bg-violet-500' },
  alpa:   { label: 'Alpa',   color: 'text-rose-600',      bgColor: 'bg-rose-50 border-rose-200',         dotColor: 'bg-rose-500' },
};

function getStatusBadge(status: string) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'text-gray-600', bgColor: 'bg-gray-50 border-gray-200', dotColor: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold ${cfg.bgColor} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
      {cfg.label}
    </span>
  );
}

export default function StudentAttendanceReportsPage() {
  const [records, setRecords] = useState<StudentAttendanceRecord[]>([]);
  const [availableKelas, setAvailableKelas] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    kelasId: '',
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
      setLoading(true);
      try {
        const res = await apiFetch('/api/attendance/student-reports?page=1&limit=100', { cache: 'no-store' });
        if (res.status === 403) { setNotWaliKelas(true); setLoading(false); return; }
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
      const params = new URLSearchParams({
        kelasId: filters.kelasId,
        startDate: filters.startDate,
        endDate: filters.endDate,
        page: String(page),
        limit: String(pageSize),
      });
      const res = await apiFetch(`/api/attendance/student-reports?${params}`, { cache: 'no-store' });
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

  useEffect(() => { fetchData(1); }, [fetchData]);

  const handleExport = async (fmt: 'pdf' | 'docx' | 'xlsx') => {
    if (!filters.kelasId) { toast.error('Pilih kelas terlebih dahulu'); return; }
    try {
      setExporting(fmt);
      const params = new URLSearchParams({
        kelasId: filters.kelasId,
        startDate: filters.startDate,
        endDate: filters.endDate,
        format: fmt,
      });
      const res = await apiFetch(`/api/attendance/student-reports/export?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Gagal mengexport' }));
        throw new Error(err.error || 'Gagal mengexport');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('Content-Disposition');
      const m = cd?.match(/filename="?([^"]+)"?/);
      a.download = m ? m[1] : `laporan-presensi-${filters.startDate}.${fmt === 'docx' ? 'doc' : fmt}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Berhasil export ${fmt.toUpperCase()}`);
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengexport');
    } finally {
      setExporting(null);
    }
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const resetFilters = () => {
    setFilters({ kelasId: '', startDate: format(new Date(), 'yyyy-MM-dd'), endDate: format(new Date(), 'yyyy-MM-dd') });
    setRecords([]);
    setPagination(null);
  };

  const rateColor = summary.tingkatKehadiran >= 90 ? 'text-emerald-600'
    : summary.tingkatKehadiran >= 75 ? 'text-amber-600' : 'text-rose-600';

  if (notWaliKelas) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        <EmptyState icon="IconUsers" title="Bukan Wali Kelas" description="Halaman ini hanya dapat diakses oleh wali kelas." />
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
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('pdf')}
            disabled={!filters.kelasId || !!exporting}
            className="border-red-200 text-red-600 hover:bg-red-50"
          >
            {exporting === 'pdf' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileText className="mr-1 h-4 w-4" />}
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('docx')}
            disabled={!filters.kelasId || !!exporting}
            className="border-blue-200 text-blue-600 hover:bg-blue-50"
          >
            {exporting === 'docx' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileText className="mr-1 h-4 w-4" />}
            DOCX
          </Button>
          <Button
            onClick={() => handleExport('xlsx')}
            disabled={!filters.kelasId || !!exporting}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
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
            <Filter className="h-4 w-4" />Filter Laporan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs mb-1.5 block">Kelas <span className="text-rose-500">*</span></Label>
              <Select
                value={filters.kelasId || 'none'}
                onValueChange={(val) => setFilters(prev => ({ ...prev, kelasId: val === 'none' ? '' : val }))}
              >
                <SelectTrigger className="bg-white h-9 text-sm">
                  <SelectValue placeholder="Pilih kelas..." />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="none">— Pilih Kelas —</SelectItem>
                  {availableKelas.map((k: any) => (
                    <SelectItem key={k.id} value={k.id}>{k.nama_kelas}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs mb-1.5 block">Dari Tanggal</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleDateChange('startDate', e.target.value)}
                  className="h-9 w-full pl-9 pr-3 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1.5 block">Sampai Tanggal</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleDateChange('endDate', e.target.value)}
                  className="h-9 w-full pl-9 pr-3 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                />
              </div>
            </div>

            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 text-xs gap-1 text-muted-foreground">
                <RotateCcw className="h-3 w-3" />Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {filters.kelasId && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <Card className="border-0 shadow-sm col-span-2">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Tingkat Kehadiran</p>
                  <p className={`text-3xl font-bold mt-1 ${rateColor}`}>{summary.tingkatKehadiran}%</p>
                </div>
                <UserCheck className={`w-8 h-8 ${rateColor} opacity-60`} />
              </div>
            </CardContent>
          </Card>

          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const count = summary[key as keyof Summary] as number;
            return (
              <Card key={key} className="border-0 shadow-sm">
                <CardContent className="pt-4 pb-3 px-4">
                  <p className="text-xs font-medium text-muted-foreground">{cfg.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${cfg.color}`}>{count}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Table */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            {filters.kelasId
              ? `Rincian Presensi (${pagination?.totalRecords ?? records.length} data)`
              : 'Pilih kelas untuk melihat presensi'}
          </CardTitle>
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
              <Button variant="outline" size="sm" className="mt-3" onClick={() => fetchData(currentPage)}>Coba Lagi</Button>
            </div>
          ) : records.length === 0 ? (
            <EmptyState
              icon="IconCalendarOff"
              title="Belum ada data presensi"
              description={`Tidak ada data presensi untuk ${format(new Date(filters.startDate), 'd MMM', { locale: id })} — ${format(new Date(filters.endDate), 'd MMM yyyy', { locale: id })}`}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-8 text-xs font-semibold">No</TableHead>
                      <TableHead className="text-xs font-semibold">No. Absen</TableHead>
                      <TableHead className="text-xs font-semibold">Nama Siswa</TableHead>
                      <TableHead className="text-xs font-semibold">NISN</TableHead>
                      <TableHead className="text-xs font-semibold">Tanggal</TableHead>
                      <TableHead className="text-xs font-semibold">Mapel</TableHead>
                      <TableHead className="text-xs font-semibold">Status</TableHead>
                      <TableHead className="text-xs font-semibold">Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((rec, idx) => (
                      <TableRow key={rec.id} className="hover:bg-slate-50 transition-colors">
                        <TableCell className="text-xs text-muted-foreground py-2">{(currentPage - 1) * pageSize + idx + 1}</TableCell>
                        <TableCell className="py-2 text-xs">{rec.nomorAbsen ?? '-'}</TableCell>
                        <TableCell className="py-2 text-sm font-medium">{rec.namaSiswa}</TableCell>
                        <TableCell className="py-2 text-xs">{rec.nisn || '-'}</TableCell>
                        <TableCell className="py-2 text-xs">{rec.tanggalLabel || format(new Date(rec.tanggal), 'EEE, d MMM', { locale: id })}</TableCell>
                        <TableCell className="py-2 text-xs text-muted-foreground">{rec.mapel || '-'}</TableCell>
                        <TableCell className="py-2">{getStatusBadge(rec.status)}</TableCell>
                        <TableCell className="py-2 text-xs text-muted-foreground max-w-[150px] truncate">{rec.catatan || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pagination && pagination.totalRecords > pageSize && (
                <div className="px-4 py-3 border-t">
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
