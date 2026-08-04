'use client';
import { apiFetch } from "@/lib/api-client";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import {
  Clock, MapPin, User, AlertTriangle, CheckCircle, XCircle, Eye,
  Download, RefreshCw, Filter, Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { toast } from 'sonner';
import { useState, useEffect, useCallback } from 'react';

interface AttendanceLog {
  id: string;
  teacherId: string;
  teacherName: string;
  institutionId: string;
  institutionName: string;
  type: 'masuk' | 'pulang' | 'mengajar_mulai' | 'mengajar_selesai';
  timestamp: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  ipAddress: string;
  distanceFromInstitution: number;
  faceMatchScore: number;
  livenessPassed: boolean;
  qrCodeVerified: boolean | null;
  browserFingerprint: string;
  trustScore: number;
  status: 'valid' | 'flagged' | 'rejected';
  flagReasons: string[] | null;
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const TYPE_LABEL: Record<string, string> = {
  masuk: 'Masuk',
  pulang: 'Pulang',
  mengajar_mulai: 'Mulai Mengajar',
  mengajar_selesai: 'Selesai Mengajar',
};

const STATUS_COLORS: Record<string, string> = {
  valid: 'bg-green-100 text-green-800',
  flagged: 'bg-yellow-100 text-yellow-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function AttendanceFlaggedPage() {
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AttendanceLog | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [pageSize, setPageSize] = useState(25);
  const [filterLoading, setFilterLoading] = useState(false);

  // Filter state
  const [filters, setFilters] = useState({
    status: 'flagged' as string,
    teacherName: '',
    institutionId: '',
    startDate: '',
    endDate: '',
    flagReason: '',
  });
  const [institutions, setInstitutions] = useState<Array<{ id: string; name: string }>>([]);
  const [flagReasonOptions, setFlagReasonOptions] = useState<string[]>([]);

  const fetchFlaggedAttendance = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(pageSize));
      params.set('status', filters.status);
      if (filters.teacherName) params.set('teacherName', filters.teacherName);
      if (filters.institutionId && filters.institutionId !== 'all') params.set('institutionId', filters.institutionId);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.flagReason && filters.flagReason !== 'all') params.set('flagReason', filters.flagReason);

      const response = await apiFetch(`/api/attendance/logs/flagged?${params.toString()}`);

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Gagal mengambil data' }));
        throw new Error(err.error || 'Gagal mengambil data presensi yang di-flag');
      }

      const result = await response.json();
      setAttendanceLogs(result.data || []);
      setPagination({
        page: result.pagination?.page || 1,
        limit: result.pagination?.limit || pageSize,
        total: result.pagination?.total || 0,
        totalPages: result.pagination?.totalPages || 1,
      });
      if (result.institutions) setInstitutions(result.institutions);
      if (result.flagReasonOptions) setFlagReasonOptions(result.flagReasonOptions);
    } catch (err: any) {
      console.error('Error fetching flagged attendance:', err);
      toast.error(err.message || 'Gagal mengambil data presensi yang di-flag');
    } finally {
      setLoading(false);
    }
  }, [filters, pageSize]);

  const handleRefresh = () => {
    fetchFlaggedAttendance(1);
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const applyFilters = () => {
    fetchFlaggedAttendance(1);
  };

  const resetFilters = () => {
    setFilters({
      status: 'flagged',
      teacherName: '',
      institutionId: '',
      startDate: '',
      endDate: '',
      flagReason: '',
    });
  };

  const handleApprove = async (logId: string) => {
    try {
      const res = await apiFetch('/api/attendance/logs/flagged', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId, action: 'approve' }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Gagal menyetujui' }));
        throw new Error(err.error || 'Gagal menyetujui presensi');
      }

      toast.success('Presensi berhasil disetujui');
      setAttendanceLogs(prev =>
        prev.map(log =>
          log.id === logId ? { ...log, status: 'valid' } : log
        )
      );
      if (selectedLog?.id === logId) {
        setSelectedLog(null);
      }
    } catch (err: any) {
      console.error('Error approving attendance:', err);
      toast.error(err.message || 'Gagal menyetujui presensi');
    }
  };

  const handleReject = async (logId: string) => {
    try {
      const res = await apiFetch('/api/attendance/logs/flagged', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId, action: 'reject' }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Gagal menolak' }));
        throw new Error(err.error || 'Gagal menolak presensi');
      }

      toast.info('Presensi berhasil ditolak');
      setAttendanceLogs(prev =>
        prev.map(log =>
          log.id === logId ? { ...log, status: 'rejected' } : log
        )
      );
      if (selectedLog?.id === logId) {
        setSelectedLog(null);
      }
    } catch (err: any) {
      console.error('Error rejecting attendance:', err);
      toast.error(err.message || 'Gagal menolak presensi');
    }
  };

  const getTypeLabel = (type: string) => TYPE_LABEL[type] || type;

  const getStatusColor = (status: string) => STATUS_COLORS[status] || 'bg-gray-100 text-gray-800';

  const handleViewDetails = (log: AttendanceLog) => {
    setSelectedLog(log);
  };

  const handlePageChange = (newPage: number) => {
    fetchFlaggedAttendance(newPage);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    fetchFlaggedAttendance(1);
  };

  useEffect(() => {
    fetchFlaggedAttendance(1);
  }, [fetchFlaggedAttendance]);

  return (
    <div className="container mx-auto py-10 px-4 max-w-6xl">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-orange-500" />
                Presensi yang Perlu Ditinjau
              </CardTitle>
              <CardDescription>
                Daftar presensi yang ditandai karena potensi kecurangan
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Filter */}
        <CardContent>
          <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">Filter</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <Label className="text-xs mb-1.5 block">Status</Label>
                <Select
                  value={filters.status}
                  onValueChange={(val) => handleFilterChange('status', val)}
                >
                  <SelectTrigger className="bg-white h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="flagged">Terflag</SelectItem>
                    <SelectItem value="rejected">Ditolak</SelectItem>
                    <SelectItem value="all">Semua</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs mb-1.5 block">Guru</Label>
                <Input
                  placeholder="Nama guru..."
                  className="h-9 text-sm"
                  value={filters.teacherName}
                  onChange={(e) => handleFilterChange('teacherName', e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs mb-1.5 block">Institusi</Label>
                <Select
                  value={filters.institutionId || 'all'}
                  onValueChange={(val) => handleFilterChange('institutionId', val)}
                >
                  <SelectTrigger className="bg-white h-9 text-sm">
                    <SelectValue placeholder="Semua" />
                  </SelectTrigger>
                  <SelectContent className="bg-white max-h-60">
                    <SelectItem value="all">Semua Institusi</SelectItem>
                    {institutions.map((inst) => (
                      <SelectItem key={inst.id} value={String(inst.id)}>{inst.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs mb-1.5 block">Alasan Flag</Label>
                <Select
                  value={filters.flagReason || 'all'}
                  onValueChange={(val) => handleFilterChange('flagReason', val)}
                >
                  <SelectTrigger className="bg-white h-9 text-sm">
                    <SelectValue placeholder="Semua" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">Semua</SelectItem>
                    {flagReasonOptions.map((reason) => (
                      <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col justify-end gap-2">
                <div className="flex gap-2">
                  <Input
                    type="date"
                    className="h-9 text-sm"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  />
                  <Input
                    type="date"
                    className="h-9 text-sm"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={resetFilters} className="text-xs">
                    Reset
                  </Button>
                  <Button size="sm" onClick={applyFilters} className="text-xs">
                    Terapkan
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guru</TableHead>
                  <TableHead>Institusi</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Skor Kepercayaan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : attendanceLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Tidak ada presensi yang perlu ditinjau
                    </TableCell>
                  </TableRow>
                ) : (
                  attendanceLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {log.teacherName}
                        </div>
                      </TableCell>
                      <TableCell>{log.institutionName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getTypeLabel(log.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {format(new Date(log.timestamp), 'PPp', { locale: id })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2.5 mr-2">
                            <div
                              className="bg-blue-600 h-2.5 rounded-full"
                              style={{ width: `${Math.round((log.trustScore || 0) * 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-xs">{Math.round((log.trustScore || 0) * 100)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(log.status)}>
                          {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.flagReasons?.map((reason, idx) => (
                          <Badge key={idx} variant="secondary" className="mr-1 text-xs">
                            {reason}
                          </Badge>
                        )) || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDetails(log)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApprove(log.id)}
                            className="h-8 w-8 p-0"
                          >
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(log.id)}
                            className="h-8 w-8 p-0"
                          >
                            <XCircle className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <CardFooter className="border-t border-slate-200 px-0 pt-4">
            <Pagination
              page={pagination.page}
              pageSize={pagination.limit}
              total={pagination.total}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              loading={loading}
            />
          </CardFooter>

          {selectedLog && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Detail Presensi
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p><span className="font-medium">ID:</span> {selectedLog.id}</p>
                  <p><span className="font-medium">Guru:</span> {selectedLog.teacherName}</p>
                  <p><span className="font-medium">Institusi:</span> {selectedLog.institutionName}</p>
                  <p><span className="font-medium">Jenis:</span> {getTypeLabel(selectedLog.type)}</p>
                  <p><span className="font-medium">Waktu:</span> {format(new Date(selectedLog.timestamp), 'PPp', { locale: id })}</p>
                </div>

                <div>
                  <p className="flex items-center gap-1"><MapPin className="h-4 w-4" /> <span className="font-medium">Lokasi:</span> {selectedLog.latitude}, {selectedLog.longitude}</p>
                  <p><span className="font-medium">Akurasi:</span> ±{selectedLog.accuracy}m</p>
                  <p><span className="font-medium">Jarak dari institusi:</span> {selectedLog.distanceFromInstitution}m</p>
                  <p><span className="font-medium">Skor wajah:</span> {(selectedLog.faceMatchScore * 100).toFixed(1)}%</p>
                  <p><span className="font-medium">IP Address:</span> {selectedLog.ipAddress}</p>
                </div>
              </div>

              <div className="mt-4">
                <p><span className="font-medium">Alasan Flag:</span></p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedLog.flagReasons?.map((reason, idx) => (
                    <Badge key={idx} variant="secondary">{reason}</Badge>
                  )) || <span className="text-muted-foreground">-</span>}
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => handleApprove(selectedLog.id)}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Setujui
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleReject(selectedLog.id)}>
                  <XCircle className="h-4 w-4 mr-1" />
                  Tolak
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelectedLog(null)}>
                  Tutup
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
