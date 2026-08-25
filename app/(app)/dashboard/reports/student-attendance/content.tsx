'use client';

import { apiFetch } from '@/lib/api-client';
import { useState, useEffect, useCallback, useRef } from 'react';
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
  LayoutGrid,
  List,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { Pagination } from '@/components/ui/pagination';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const STATUS_CONFIG: Record<string, { label: string; labelShort: string; color: string; bgColor: string; dotColor: string; cssColor: string }> = {
  hadir: { label: 'Hadir',    labelShort: 'H', color: '#10b981', bgColor: 'bg-emerald-50 border-emerald-200', dotColor: 'bg-emerald-500', cssColor: 'bg-emerald-500' },
  sakit: { label: 'Sakit',    labelShort: 'S', color: '#0ea5e9', bgColor: 'bg-sky-50 border-sky-200',         dotColor: 'bg-sky-500',    cssColor: 'bg-sky-500' },
  izin:  { label: 'Izin',     labelShort: 'I', color: '#f59e0b', bgColor: 'bg-amber-50 border-amber-200',      dotColor: 'bg-amber-500',   cssColor: 'bg-amber-500' },
  alpa:  { label: 'Alpa',     labelShort: 'A', color: '#f43f5e', bgColor: 'bg-rose-50 border-rose-200',       dotColor: 'bg-rose-500',    cssColor: 'bg-rose-500' },
};

const STATUS_ORDER = ['hadir', 'sakit', 'izin', 'alpa'] as const;

function getStatusBadge(status: string) {
  const cfg = STATUS_CONFIG[status] || { label: status, labelShort: '?', color: '#6b7280', bgColor: 'bg-gray-50 border-gray-200', dotColor: 'bg-gray-400', cssColor: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold ${cfg.bgColor}`} style={{ color: cfg.color }}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
      {cfg.label}
    </span>
  );
}

function getDotCell(status?: string, catatan?: string | null) {
  if (!status) {
    return (
      <div
        className="w-6 h-6 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center"
        title="Belum diinput"
      >
        <span className="text-[9px] text-gray-400">—</span>
      </div>
    );
  }
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.hadir;
  return (
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer group relative"
      style={{ backgroundColor: cfg.color + '22', border: `1.5px solid ${cfg.color}44` }}
      title={`${cfg.label}${catatan ? ': ' + catatan : ''}`}
    >
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cfg.color }} />
      {catatan && (
        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap max-w-[120px] truncate">
          {catatan}
        </div>
      )}
    </div>
  );
}

// ---- Donut Ring ----
function DonutRing({ summary, total }: { summary: { hadir: number; sakit: number; izin: number; alpa: number }; total: number }) {
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="relative w-28 h-28">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="14" fill="none" stroke="#f3f4f6" strokeWidth="3.5" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gray-400">—</span>
            <span className="text-[10px] text-gray-400">Tidak ada data</span>
          </div>
        </div>
      </div>
    );
  }
  const data = STATUS_ORDER.map(k => ({ name: k, value: summary[k as keyof typeof summary] || 0 })).filter(d => d.value > 0);
  const rateColor = summary.hadir / total >= 0.9 ? '#10b981' : summary.hadir / total >= 0.75 ? '#f59e0b' : '#f43f5e';
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-28 h-28">
        <ResponsiveViewBox>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={10}
            outerRadius={14}
            paddingAngle={1.5}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={STATUS_CONFIG[entry.name]?.color || '#ccc'} strokeWidth={0} />
            ))}
          </Pie>
        </ResponsiveViewBox>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color: rateColor }}>
            {Math.round((summary.hadir / total) * 100)}
          </span>
          <span className="text-[10px] text-gray-500 font-medium">%</span>
        </div>
      </div>
      <p className="text-[10px] text-gray-500 mt-1 text-center">
        {summary.hadir} dari {total} data
      </p>
    </div>
  );
}

function ResponsiveViewBox({ children }: { children: React.ReactNode }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>{children}</PieChart>
    </ResponsiveContainer>
  );
}

// ---- Composition Bar ----
function CompositionBar({ summary, total }: { summary: { hadir: number; sakit: number; izin: number; alpa: number }; total: number }) {
  if (total === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
        {STATUS_ORDER.map(k => {
          const v = summary[k as keyof typeof summary] || 0;
          const pct = Math.round((v / total) * 100);
          if (pct === 0) return null;
          return (
            <div
              key={k}
              className="h-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: STATUS_CONFIG[k]?.color }}
              title={`${STATUS_CONFIG[k]?.label}: ${v} (${pct}%)`}
            />
          );
        })}
      </div>
      <div className="flex gap-3 flex-wrap">
        {STATUS_ORDER.map(k => {
          const v = summary[k as keyof typeof summary] || 0;
          const pct = total > 0 ? Math.round((v / total) * 100) : 0;
          if (pct === 0) return null;
          return (
            <div key={k} className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_CONFIG[k]?.color }} />
              <span className="font-medium" style={{ color: STATUS_CONFIG[k]?.color }}>{STATUS_CONFIG[k]?.label}</span>
              <span className="text-gray-400">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Reconciliation Badge ----
function ReconciliationBadge({ summary }: {
  summary: { total: number; hadir: number; sakit: number; izin: number; alpa: number; dataConsistent?: boolean };
}) {
  const sum = summary.hadir + summary.sakit + summary.izin + summary.alpa;
  const consistent = sum === summary.total;
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors ${
      consistent
        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
        : 'bg-rose-50 border-rose-200 text-rose-700'
    }`}>
      {consistent ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
      ) : (
        <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
      )}
      <span>
        {consistent
          ? `Data konsisten: ${summary.hadir}+${summary.sakit}+${summary.izin}+${summary.alpa} = ${sum}`
          : `Selisih data: total=${summary.total} tapi H+S+I+A=${sum} (Δ${Math.abs(sum - summary.total)})`
        }
      </span>
    </div>
  );
}

// ---- Matrix Table ----
function MatrixTable({ matrix, dates, dateLabels }: {
  matrix: Array<{
    studentId: string; namaSiswa: string; nisn: string | null; nomorAbsen: number | null;
    perDate: Record<string, { status: string; catatan: string } | null>;
  }>;
  dates: string[];
  dateLabels: string[];
}) {
  // Group dates by week
  const weekGroups: { label: string; dates: string[]; labels: string[]; indices: number[] }[] = [];
  for (let i = 0; i < dates.length; i += 7) {
    const chunk = dates.slice(i, i + 7);
    const labelChunk = dateLabels.slice(i, i + 7);
    const weekStart = format(parseISO(chunk[0]), 'd MMM');
    const weekEnd = chunk.length > 1 ? format(parseISO(chunk[chunk.length - 1]), 'd MMM') : '';
    weekGroups.push({
      label: weekEnd ? `${weekStart} – ${weekEnd}` : weekStart,
      dates: chunk,
      labels: labelChunk,
      indices: chunk.map((_, idx) => i + idx),
    });
  }

  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set(weekGroups.map((_, i) => i)));
  const tableRef = useRef<HTMLDivElement>(null);

  const toggleWeek = (i: number) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  // Per-student totals
  // Per-student totals + attendance percentage
  const studentTotals = matrix.map(s => {
    const totals = { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
    let filledDays = 0;
    Object.values(s.perDate).forEach(v => {
      if (v !== null) {
        filledDays++;
        if (v.status) totals[v.status as keyof typeof totals]++;
      }
    });
    const pct = filledDays > 0 ? Math.round((totals.hadir / filledDays) * 100) : 0;
    return { ...totals, pct };
  });

  return (
    <div className="overflow-auto" ref={tableRef}>
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 z-20">
          {/* Week group headers */}
          {weekGroups.length > 1 && (
            <tr>
              <th className="bg-slate-100 border border-slate-200 p-1.5 font-semibold text-slate-700 text-left sticky left-0 z-30 min-w-[180px]" rowSpan={2}>
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Nama Siswa
                </div>
              </th>
              {weekGroups.map((wg, wi) => (
                <th
                  key={wi}
                  className="bg-slate-100 border border-slate-200 px-2 py-1.5 text-center font-semibold text-slate-600 text-[11px] cursor-pointer hover:bg-slate-200 transition-colors"
                  colSpan={expandedWeeks.has(wi) ? wg.dates.length : 1}
                  onClick={() => toggleWeek(wi)}
                >
                  {expandedWeeks.has(wi) ? '▼' : '▶'} {wg.label}
                  {!expandedWeeks.has(wi) && <span className="ml-1 text-gray-400 font-normal">({wg.dates.length} hari)</span>}
                </th>
              ))}
              <th className="bg-slate-700 border border-slate-600 px-2 py-1.5 text-center font-bold text-white text-[11px]" colSpan={5}>
                Ringkasan
              </th>
            </tr>
          )}
          {/* Date headers */}
          <tr>
            {weekGroups.length === 1 && (
              <th className="bg-slate-100 border border-slate-200 p-1.5 font-semibold text-slate-700 text-left sticky left-0 z-30 min-w-[180px]">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Nama Siswa
                </div>
              </th>
            )}
            {weekGroups.map((wg, wi) =>
              expandedWeeks.has(wi) ? (
                wg.indices.map(idx => {
                  const d: string = dates[idx]!;
                  return (
                  <th key={idx} className="bg-slate-100 border border-slate-200 px-1 py-1.5 text-center font-semibold text-slate-500 text-[10px] min-w-[38px]">
                    {format(parseISO(d), 'EEE', { locale: id })}<br />
                    {format(parseISO(d), 'd')}
                  </th>
                  );
                })
              ) : (
                <th key={wi} className="bg-slate-200 border border-slate-300 px-2 py-1.5 text-center font-medium text-slate-600 text-[11px]">
                  {wg.dates.length} hari
                </th>
              )
            )}
            {STATUS_ORDER.map(s => (
              <th key={s} className="bg-slate-700 border border-slate-600 px-1 py-1.5 text-center font-bold text-white text-[10px] min-w-[32px]">
                {s === 'hadir' ? 'H' : s === 'sakit' ? 'S' : s === 'izin' ? 'I' : 'A'}
              </th>
            ))}
            <th className="bg-emerald-700 border border-slate-600 px-2 py-1.5 text-center font-bold text-white text-[10px] min-w-[48px]">
              % Hadir
            </th>
          </tr>
        </thead>
        <tbody>
          {matrix.map((s, si) => {
            const totals = studentTotals[si];
            const weekCols = weekGroups.map((wg, wi) =>
              expandedWeeks.has(wi) ? (
                wg.indices.map(idx => {
                  const d: string = dates[idx]!;
                  return (
                  <td key={idx} className="border border-gray-200 px-0.5 py-1 text-center bg-white hover:bg-slate-50 transition-colors">
                    {(() => {
                      const cell = s.perDate[d];
                      return getDotCell(cell?.status ?? undefined, cell?.catatan ?? undefined);
                    })()}
                  </td>
                  );
                })
              ) : (
                <td key={wi} className="border border-gray-200 px-1 py-1 text-center bg-slate-50 font-medium text-slate-500 text-[10px]">
                  {Object.values(s.perDate).filter(v => v !== null).length}/{wg.dates.length}
                </td>
              )
            );
            return (
              <tr key={s.studentId} className="hover:bg-slate-50 transition-colors">
                <td className="border border-gray-200 px-2 py-1.5 font-medium text-slate-900 sticky left-0 bg-white z-10 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 w-4 text-right">{s.nomorAbsen ?? '-'}</span>
                    <div>
                      <div className="text-xs font-medium">{s.namaSiswa}</div>
                      <div className="text-[10px] text-gray-400">{s.nisn || '-'}</div>
                    </div>
                  </div>
                </td>
                {weekCols}
                {STATUS_ORDER.map(st => (
                  <td
                    key={st}
                    className="border border-gray-200 px-1 py-1.5 text-center font-bold text-[11px]"
                    style={{ color: STATUS_CONFIG[st]?.color, backgroundColor: totals[st as keyof typeof totals] > 0 ? STATUS_CONFIG[st]?.color + '15' : '' }}
                  >
                    {totals[st as keyof typeof totals] || 0}
                  </td>
                ))}
                <td
                  className="border border-gray-200 px-1.5 py-1.5 text-center font-bold text-[12px]"
                  style={{
                    color: totals.pct >= 90 ? '#10b981' : totals.pct >= 75 ? '#f59e0b' : '#f43f5e',
                    backgroundColor: totals.pct >= 90 ? '#dcfce722' : totals.pct >= 75 ? '#fef3c722' : '#fee2e222',
                  }}
                >
                  {totals.pct}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function StudentAttendanceReportsPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [availableKelas, setAvailableKelas] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    kelasId: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  });
  const [loading, setLoading] = useState(true);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(100);
  const [summary, setSummary] = useState<any>({ total: 0, hadir: 0, sakit: 0, izin: 0, alpa: 0, tingkatKehadiran: 0, dataConsistent: true });
  const [notWaliKelas, setNotWaliKelas] = useState(false);
  const [viewMode, setViewMode] = useState<'matrix' | 'detail'>('matrix');

  // Matrix state
  const [matrixData, setMatrixData] = useState<any[]>([]);
  const [matrixDates, setMatrixDates] = useState<string[]>([]);
  const [matrixDateLabels, setMatrixDateLabels] = useState<string[]>([]);
  const [matrixSchoolInfo, setMatrixSchoolInfo] = useState<any>(null);

  const fetchDetail = useCallback(async (page = 1) => {
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
      setSummary(data.summary || { total: 0, hadir: 0, sakit: 0, izin: 0, alpa: 0, tingkatKehadiran: 0, dataConsistent: true });
      if (json.pagination) setPagination(json.pagination);
      setCurrentPage(page);
    } catch (err: any) {
      setError(err.message || 'Gagal mengambil data');
      toast.error(err.message || 'Gagal mengambil data');
    } finally {
      setLoading(false);
    }
  }, [filters, pageSize]);

  const fetchMatrix = useCallback(async () => {
    if (!filters.kelasId) return;
    setLoadingMatrix(true);
    try {
      const params = new URLSearchParams({
        kelasId: filters.kelasId,
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
      const res = await apiFetch(`/api/attendance/student-reports/matrix?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Gagal mengambil data matrix');
      const json = await res.json();
      setMatrixData(json.students || []);
      setMatrixDates(json.dates || []);
      setMatrixDateLabels(json.dateLabels || []);
      setMatrixSchoolInfo(json.schoolInfo || null);
      setSummary(json.summary || { total: 0, hadir: 0, sakit: 0, izin: 0, alpa: 0, tingkatKehadiran: 0, dataConsistent: true });
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengambil data matrix');
    } finally {
      setLoadingMatrix(false);
    }
  }, [filters]);

  const fetchKelas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/attendance/student-reports?page=1&limit=100', { cache: 'no-store' });
      if (res.status === 403) { setNotWaliKelas(true); setLoading(false); return; }
      if (!res.ok) throw new Error('Gagal mengambil data');
      const json = await res.json();
      setAvailableKelas(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKelas(); }, [fetchKelas]);

  useEffect(() => {
    if (!filters.kelasId) return;
    if (viewMode === 'detail') {
      fetchDetail(1);
    } else {
      fetchMatrix();
    }
  }, [filters, viewMode, fetchDetail, fetchMatrix]);

  const handleExport = async (fmt: 'pdf' | 'xlsx') => {
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
      a.download = m ? m[1] : `presensi-${filters.startDate}.${fmt}`;
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
    setFilters({ kelasId: filters.kelasId, startDate: format(new Date(), 'yyyy-MM-dd'), endDate: format(new Date(), 'yyyy-MM-dd') });
  };

  if (notWaliKelas) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        <EmptyState icon="IconUsers" title="Bukan Wali Kelas" description="Halaman ini hanya dapat diakses oleh wali kelas." />
      </div>
    );
  }

  const rateColor = summary.tingkatKehadiran >= 90 ? 'text-emerald-600'
    : summary.tingkatKehadiran >= 75 ? 'text-amber-600' : 'text-rose-600';

  return (
    <div className="container mx-auto py-6 px-4 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Laporan Presensi Harian Siswa</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filters.kelasId
              ? `${format(parseISO(filters.startDate), 'd MMM yyyy', { locale: id })} — ${format(parseISO(filters.endDate), 'd MMM yyyy', { locale: id })}`
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
            <div className="flex items-end gap-1.5">
              <Button
                variant={viewMode === 'matrix' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('matrix')}
                disabled={!filters.kelasId}
                className="h-9 gap-1.5 text-xs"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Matrix
              </Button>
              <Button
                variant={viewMode === 'detail' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('detail')}
                disabled={!filters.kelasId}
                className="h-9 gap-1.5 text-xs"
              >
                <List className="h-3.5 w-3.5" />
                Detail
              </Button>
            </div>
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 text-xs gap-1 text-muted-foreground">
                <RotateCcw className="h-3 w-3" />Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary + Donut + Reconciliation */}
      {filters.kelasId && (
        <>
          {/* Top row: donut + composition bar + reconciliation */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Donut + ring info */}
            <Card className="border shadow-sm">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-start gap-4">
                  <DonutRing summary={summary} total={summary.total} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Tingkat Kehadiran</p>
                    <p className={`text-4xl font-bold ${rateColor}`}>{summary.tingkatKehadiran}%</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {summary.hadir} hadir / {summary.total} total
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Composition bar */}
            <Card className="border shadow-sm">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Komposisi Kehadiran</p>
                <CompositionBar summary={summary} total={summary.total} />
              </CardContent>
            </Card>

            {/* Status cards + reconciliation */}
            <Card className="border shadow-sm">
              <CardContent className="pt-4 pb-3 px-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Ringkasan</p>
                  <ReconciliationBadge summary={summary} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_ORDER.map(k => {
                    const v = summary[k] || 0;
                    const cfg = STATUS_CONFIG[k];
                    return (
                      <div key={k} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border ${cfg.bgColor}`}>
                        <div className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
                        <span className="text-xs font-semibold" style={{ color: cfg.color }}>{v}</span>
                        <span className="text-xs text-muted-foreground">{cfg.label}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  {viewMode === 'matrix'
                    ? `Matrix Presensi — ${matrixData.length} siswa`
                    : `Rincian Harian (${pagination?.totalRecords ?? records.length} data)`}
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-2 text-[10px] text-muted-foreground">
                    {STATUS_ORDER.map(k => (
                      <div key={k} className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_CONFIG[k]?.color }} />
                        {STATUS_CONFIG[k]?.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!filters.kelasId ? (
                <div className="p-8 text-center">
                  <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Pilih kelas di atas untuk melihat data presensi siswa.</p>
                </div>
              ) : loadingMatrix && viewMode === 'matrix' ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : viewMode === 'matrix' && matrixData.length > 0 ? (
                <MatrixTable
                  matrix={matrixData}
                  dates={matrixDates}
                  dateLabels={matrixDateLabels}
                />
              ) : viewMode === 'detail' && loading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : viewMode === 'detail' && error ? (
                <div className="p-8 text-center">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{error}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => fetchDetail(currentPage)}>Coba Lagi</Button>
                </div>
              ) : viewMode === 'detail' && records.length === 0 ? (
                <EmptyState
                  icon="IconCalendarOff"
                  title="Belum ada data presensi"
                  description={`Tidak ada data presensi untuk ${format(parseISO(filters.startDate), 'd MMM', { locale: id })} — ${format(parseISO(filters.endDate), 'd MMM yyyy', { locale: id })}`}
                />
              ) : viewMode === 'detail' ? (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="w-8 text-xs font-semibold">No</TableHead>
                          <TableHead className="text-xs font-semibold">No. Absen</TableHead>
                          <TableHead className="text-xs font-semibold">Nama Siswa</TableHead>
                          <TableHead className="text-xs font-semibold">NISN</TableHead>
                          {filters.startDate !== filters.endDate && (
                            <TableHead className="text-xs font-semibold">Tanggal</TableHead>
                          )}
                          <TableHead className="text-xs font-semibold">Status</TableHead>
                          <TableHead className="text-xs font-semibold">Catatan</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {records.map((rec: any, idx: number) => (
                          <TableRow key={`${rec.studentId}-${rec.tanggal}`} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="text-xs text-muted-foreground py-2">{(currentPage - 1) * pageSize + idx + 1}</TableCell>
                            <TableCell className="py-2 text-xs">{rec.nomorAbsen ?? '-'}</TableCell>
                            <TableCell className="py-2 text-sm font-medium">{rec.namaSiswa}</TableCell>
                            <TableCell className="py-2 text-xs">{rec.nisn || '-'}</TableCell>
                            {filters.startDate !== filters.endDate && (
                              <TableCell className="py-2 text-xs">{rec.tanggalLabel || format(parseISO(rec.tanggal), 'EEE, d MMM', { locale: id })}</TableCell>
                            )}
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
                        onPageChange={(p) => fetchDetail(p)}
                        onPageSizeChange={(s) => {}}
                        loading={loading}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="p-8 text-center">
                  <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Tidak ada data presensi untuk periode ini.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
