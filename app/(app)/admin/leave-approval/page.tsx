'use client';
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  CalendarIcon, 
  User, 
  Mail, 
  Phone, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Eye,
  Users
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';

interface LeaveRequest {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  institutionId: string;
  institutionName: string;
  type: 'sakit' | 'izin' | 'cuti';
  startDate: string;
  endDate: string;
  reason: string;
  attachmentUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
}

export default function LeaveApprovalPage() {
  const { data: session } = useSession();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<LeaveRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [notes, setNotes] = useState('');
  const [substitutes, setSubstitutes] = useState<any[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  useEffect(() => {
    const fetchLeaveRequests = async () => {
      try {
        setLoading(true);
        const res = await apiFetch('/api/leave-requests', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal mengambil data');

        // Normalisasi field agar cocok dengan interface LeaveRequest
        const mapped: LeaveRequest[] = (data.leaveRequests || []).map((r: any) => ({
          id: r.id,
          teacherId: r.teacherId,
          teacherName: r.teacherName || r.teacher_name || 'Guru',
          teacherEmail: r.teacherEmail || r.teacher_email || '-',
          institutionId: String(r.institutionId ?? r.institution_id ?? ''),
          institutionName: r.institutionName || r.institution_name || 'Institusi',
          type: r.type || 'izin',
          startDate: r.startDate || r.start_date,
          endDate: r.endDate || r.end_date,
          reason: r.reason || '',
          attachmentUrl: r.attachmentUrl || r.attachment_url,
          status: r.status || 'pending',
          approvedBy: r.approvedBy || r.approved_by,
          approvedAt: r.approvedAt || r.approved_at,
          notes: r.notes,
        }));

        setLeaveRequests(mapped);
      } catch (err: any) {
        console.error('Error fetching leave requests:', err);
        setError(err.message || 'Gagal mengambil data pengajuan izin');
        toast.error('Gagal mengambil data pengajuan izin');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaveRequests();
  }, []);

  // Filter data berdasarkan status
  useEffect(() => {
    if (filterStatus === 'all') {
      setFilteredRequests(leaveRequests);
    } else {
      setFilteredRequests(leaveRequests.filter(req => req.status === filterStatus));
    }
  }, [filterStatus, leaveRequests]);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'sakit': return 'Sakit';
      case 'izin': return 'Izin Pribadi';
      case 'cuti': return 'Cuti';
      default: return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Menunggu</Badge>;
      case 'approved':
        return <Badge variant="default">Disetujui</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Ditolak</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    
    try {
      setApproving(true);
      
      // Dalam implementasi nyata, ini akan mengirim ke API
      // Untuk simulasi, kita hanya memperbarui status lokal
      const response = await apiFetch(`/api/leave-requests/${selectedRequest.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'approved',
          notes: notes || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Gagal menyetujui permintaan izin');
      }

      // Update lokal
      const updatedRequests = leaveRequests.map(req => 
        req.id === selectedRequest.id 
          ? { ...req, status: 'approved' as const, notes: notes || req.notes, approvedAt: new Date().toISOString() } 
          : req
      );
      
      setLeaveRequests(updatedRequests);
      toast.success('Permintaan izin berhasil disetujui');
      setSelectedRequest(null);
      setNotes('');
    } catch (err: any) {
      console.error('Error approving leave request:', err);
      toast.error(err.message || 'Gagal menyetujui permintaan izin');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    
    try {
      setRejecting(true);
      
      // Dalam implementasi nyata, ini akan mengirim ke API
      // Untuk simulasi, kita hanya memperbarui status lokal
      const response = await apiFetch(`/api/leave-requests/${selectedRequest.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'rejected',
          notes: notes || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Gagal menolak permintaan izin');
      }

      // Update lokal
      const updatedRequests = leaveRequests.map(req => 
        req.id === selectedRequest.id 
          ? { ...req, status: 'rejected' as const, notes: notes || req.notes, approvedAt: new Date().toISOString() } 
          : req
      );
      
      setLeaveRequests(updatedRequests);
      toast.success('Permintaan izin berhasil ditolak');
      setSelectedRequest(null);
      setNotes('');
    } catch (err: any) {
      console.error('Error rejecting leave request:', err);
      toast.error(err.message || 'Gagal menolak permintaan izin');
    } finally {
      setRejecting(false);
    }
  };

  const handleViewDetails = async (request: LeaveRequest) => {
    setSelectedRequest(request);
    setNotes(request.notes || '');
    setSubstitutes([]);

    // Sprint 4.5 — Ambil saran guru pengganti (READ-ONLY).
    setLoadingSubs(true);
    try {
      const res = await apiFetch(`/api/leave-requests/${request.id}/substitutes?leaveId=${request.id}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) setSubstitutes(data.suggestions || []);
    } catch {
      /* abaikan, panel opsional */
    } finally {
      setLoadingSubs(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-10 px-4 max-w-4xl flex justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
          <p>Memuat pengajuan izin...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-10 px-4 max-w-4xl">
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
                <CheckCircle className="h-6 w-6" />
                Persetujuan Izin & Cuti
              </CardTitle>
              <CardDescription>
                Kelola pengajuan izin dan cuti dari guru-guru di institusi Anda
              </CardDescription>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant={filterStatus === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('all')}
              >
                Semua
              </Button>
              <Button 
                variant={filterStatus === 'pending' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('pending')}
              >
                Menunggu
              </Button>
              <Button 
                variant={filterStatus === 'approved' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('approved')}
              >
                Disetujui
              </Button>
              <Button 
                variant={filterStatus === 'rejected' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('rejected')}
              >
                Ditolak
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guru</TableHead>
                  <TableHead>Institusi</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length > 0 ? (
                  filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div>{request.teacherName}</div>
                            <div className="text-xs text-muted-foreground">{request.teacherEmail}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{request.institutionName}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTypeLabel(request.type)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1 text-sm">
                            <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                            {format(new Date(request.startDate), 'dd MMM yyyy', { locale: id })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            s.d {format(new Date(request.endDate), 'dd MMM yyyy', { locale: id })}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate text-sm">{request.reason}</div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(request.status)}
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleViewDetails(request)}
                          disabled={request.status !== 'pending'}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {request.status === 'pending' ? 'Proses' : 'Lihat'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {filterStatus === 'all' 
                        ? 'Belum ada pengajuan izin' 
                        : `Belum ada pengajuan izin dengan status ${filterStatus}`}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Detail & Approval */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        {selectedRequest && (
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Detail Pengajuan Izin
              </DialogTitle>
              <DialogDescription>
                Informasi lengkap tentang pengajuan izin dari {selectedRequest.teacherName}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Guru</h4>
                  <p className="flex items-center gap-2 mt-1">
                    <User className="h-4 w-4" />
                    {selectedRequest.teacherName}
                  </p>
                </div>
                                  
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Institusi</h4>
                  <p className="mt-1">
                    <Badge variant="outline">{selectedRequest.institutionName}</Badge>
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Email</h4>
                  <p className="flex items-center gap-2 mt-1">
                    <Mail className="h-4 w-4" />
                    {selectedRequest.teacherEmail}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Jenis Izin</h4>
                  <p className="mt-1">
                    <Badge variant="outline">{getTypeLabel(selectedRequest.type)}</Badge>
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Status</h4>
                  <p className="mt-1">
                    {getStatusBadge(selectedRequest.status)}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Tanggal Mulai</h4>
                  <p className="flex items-center gap-1 mt-1">
                    <CalendarIcon className="h-4 w-4" />
                    {format(new Date(selectedRequest.startDate), 'dd MMMM yyyy', { locale: id })}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Tanggal Selesai</h4>
                  <p className="flex items-center gap-1 mt-1">
                    <CalendarIcon className="h-4 w-4" />
                    {format(new Date(selectedRequest.endDate), 'dd MMMM yyyy', { locale: id })}
                  </p>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-sm text-muted-foreground">Alasan</h4>
                <p className="mt-1 p-3 bg-muted rounded-md">
                  {selectedRequest.reason}
                </p>
              </div>
              
              {selectedRequest.attachmentUrl && (
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Lampiran</h4>
                  <a 
                    href={selectedRequest.attachmentUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-2 text-blue-600 hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    Lihat Dokumen
                  </a>
                </div>
              )}
              
              {selectedRequest.status !== 'pending' && (
                <div className="border-t pt-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Catatan Persetujuan</h4>
                  <div className="mt-2">
                    <p className="text-sm">
                      <span className="font-medium">Status:</span> {selectedRequest.status === 'approved' ? 'Disetujui' : 'Ditolak'}
                    </p>
                    {selectedRequest.notes && (
                      <p className="text-sm mt-1">
                        <span className="font-medium">Catatan:</span> {selectedRequest.notes}
                      </p>
                    )}
                    {selectedRequest.approvedAt && (
                      <p className="text-sm mt-1 text-muted-foreground">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {format(new Date(selectedRequest.approvedAt), 'dd MMM yyyy, HH:mm', { locale: id })}
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {selectedRequest.status === 'pending' && (
                <div className="border-t pt-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Catatan Persetujuan (Opsional)</h4>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Tambahkan catatan untuk guru (opsional)"
                    className="mt-2 w-full p-2 border rounded-md text-sm"
                    rows={3}
                  />
                  
                  <div className="flex justify-end gap-2 mt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => setSelectedRequest(null)}
                    >
                      Batal
                    </Button>
                    <Button 
                      variant="destructive"
                      onClick={handleReject}
                      disabled={rejecting}
                    >
                      {rejecting ? 'Menolak...' : 'Tolak'}
                    </Button>
                    <Button 
                      onClick={handleApprove}
                      disabled={approving}
                    >
                      {approving ? 'Menyetujui...' : 'Setujui'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Sprint 4.5 — Saran Guru Pengganti */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-sm text-slate-700 flex items-center gap-2">
                  <Users className="h-4 w-4" /> Saran Guru Pengganti
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Guru lain di sekolah yang bisa menggantikan selama izin berlangsung.
                </p>
                {loadingSubs ? (
                  <p className="text-xs text-slate-400 mt-2">Mencari guru tersedia…</p>
                ) : substitutes.length === 0 ? (
                  <p className="text-xs text-slate-400 mt-2">Belum ada saran tersedia.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {substitutes.map((s) => (
                      <div key={s.userId} className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg p-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{s.nama}</p>
                          {s.mapel?.length > 0 && (
                            <p className="text-[11px] text-slate-400 truncate">{s.mapel.join(', ')}</p>
                          )}
                        </div>
                        {s.whatsapp ? (
                          <a
                            href={`https://wa.me/${s.whatsapp.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-emerald-600 hover:underline shrink-0"
                          >
                            Hubungi
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-300 shrink-0">No WA</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}