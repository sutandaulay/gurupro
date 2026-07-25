'use client';
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Clock, 
  MapPin, 
  User, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Eye,
  Download,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

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

export default function AttendanceFlaggedPage() {
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AttendanceLog | null>(null);

  // Simulasi pengambilan data dari API
  useEffect(() => {
    const fetchFlaggedAttendance = async () => {
      try {
        setLoading(true);
        
        // Simulasi API call untuk mendapatkan log presensi yang di-flag
        // Dalam implementasi nyata, ini akan memanggil API endpoint
        const response = await apiFetch('/api/attendance/logs/flagged');
        
        // Karena ini hanya simulasi, kita buat data dummy
        const dummyData: AttendanceLog[] = [
          {
            id: 'log-1',
            teacherId: 'teacher-1',
            teacherName: 'Ahmad Fauzi',
            institutionId: 'inst-1',
            institutionName: 'SDN Cempaka Putih 01',
            type: 'masuk',
            timestamp: '2024-06-15T07:30:00Z',
            latitude: -6.175394,
            longitude: 106.827061,
            accuracy: 65.2,
            ipAddress: '192.168.1.100',
            distanceFromInstitution: 1200,
            faceMatchScore: 0.85,
            livenessPassed: true,
            qrCodeVerified: false,
            browserFingerprint: 'fp-abc123',
            trustScore: 0.4,
            status: 'flagged',
            flagReasons: ['outside_radius', 'low_accuracy', 'ip_gps_mismatch'],
            createdAt: '2024-06-15T07:32:15Z',
          },
          {
            id: 'log-2',
            teacherId: 'teacher-2',
            teacherName: 'Siti Nurhaliza',
            institutionId: 'inst-2',
            institutionName: 'SMPN 1 Jakarta',
            type: 'pulang',
            timestamp: '2024-06-15T15:45:00Z',
            latitude: -6.208803,
            longitude: 106.845591,
            accuracy: 5.0,
            ipAddress: '203.145.20.50',
            distanceFromInstitution: 300,
            faceMatchScore: 0.92,
            livenessPassed: true,
            qrCodeVerified: null,
            browserFingerprint: 'fp-def456',
            trustScore: 0.55,
            status: 'flagged',
            flagReasons: ['impossible_speed'],
            createdAt: '2024-06-15T15:47:30Z',
          },
          {
            id: 'log-3',
            teacherId: 'teacher-3',
            teacherName: 'Budi Santoso',
            institutionId: 'inst-1',
            institutionName: 'SDN Cempaka Putih 01',
            type: 'masuk',
            timestamp: '2024-06-15T06:45:00Z',
            latitude: -6.175394,
            longitude: 106.827061,
            accuracy: 0,
            ipAddress: '114.121.240.10',
            distanceFromInstitution: 50,
            faceMatchScore: 0.78,
            livenessPassed: false,
            qrCodeVerified: null,
            browserFingerprint: 'fp-ghi789',
            trustScore: 0.3,
            status: 'flagged',
            flagReasons: ['accuracy_anomaly', 'liveness_failed'],
            createdAt: '2024-06-15T06:46:20Z',
          },
        ];
        
        setAttendanceLogs(dummyData);
      } catch (error) {
        console.error('Error fetching flagged attendance:', error);
        toast.error('Gagal mengambil data presensi yang di-flag');
      } finally {
        setLoading(false);
      }
    };

    fetchFlaggedAttendance();
  }, []);

  const handleViewDetails = (log: AttendanceLog) => {
    setSelectedLog(log);
  };

  const handleApprove = async (logId: string) => {
    try {
      // Simulasi API call untuk approve log
      // Dalam implementasi nyata, ini akan memanggil API endpoint
      toast.success('Presensi berhasil disetujui');
      
      // Update status lokal
      setAttendanceLogs(prev => 
        prev.map(log => 
          log.id === logId ? { ...log, status: 'valid' } : log
        )
      );
    } catch (error) {
      console.error('Error approving attendance:', error);
      toast.error('Gagal menyetujui presensi');
    }
  };

  const handleReject = async (logId: string) => {
    try {
      // Simulasi API call untuk reject log
      // Dalam implementasi nyata, ini akan memanggil API endpoint
      toast.info('Presensi berhasil ditolak');
      
      // Update status lokal
      setAttendanceLogs(prev => 
        prev.map(log => 
          log.id === logId ? { ...log, status: 'rejected' } : log
        )
      );
    } catch (error) {
      console.error('Error rejecting attendance:', error);
      toast.error('Gagal menolak presensi');
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'masuk': return 'Masuk';
      case 'pulang': return 'Pulang';
      case 'mengajar_mulai': return 'Mulai Mengajar';
      case 'mengajar_selesai': return 'Selesai Mengajar';
      default: return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid': return 'bg-green-100 text-green-800';
      case 'flagged': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-10 px-4 max-w-6xl">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

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
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Ekspor Laporan
            </Button>
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
                  <TableHead>Waktu</TableHead>
                  <TableHead>Skor Kepercayaan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceLogs.length > 0 ? (
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
                          {new Date(log.timestamp).toLocaleString('id-ID')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2.5 mr-2">
                            <div 
                              className="bg-blue-600 h-2.5 rounded-full" 
                              style={{ width: `${log.trustScore * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-xs">{Math.round(log.trustScore * 100)}%</span>
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
                        ))}
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
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Tidak ada presensi yang perlu ditinjau
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
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
                  <p><span className="font-medium">Waktu:</span> {new Date(selectedLog.timestamp).toLocaleString('id-ID')}</p>
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}