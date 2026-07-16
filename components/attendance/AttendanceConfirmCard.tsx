import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, UserCheck, QrCode, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface AttendanceConfirmCardProps {
  result: {
    type: 'check-in' | 'check-out';
    success: boolean;
    timestamp: string;
    institutionName: string;
    distanceFromInstitution?: number;
    faceMatchScore?: number;
    status?: 'valid' | 'flagged' | 'rejected';
    flagReasons?: string[];
    [key: string]: any; // Untuk properti tambahan
  };
}

export const AttendanceConfirmCard = ({ result }: AttendanceConfirmCardProps) => {
  const isCheckIn = result.type === 'check-in';
  const isSuccess = result.success;
  
  // Menentukan badge status
  let statusVariant: "default" | "secondary" | "destructive" | "outline" | "ghost" = "default";
  let statusIcon = <CheckCircle className="h-5 w-5" />;
  let statusText = "Berhasil";
  
  if (result.status === 'flagged') {
    statusVariant = "secondary";
    statusIcon = <AlertTriangle className="h-5 w-5" />;
    statusText = "Perlu Review";
  } else if (result.status === 'rejected') {
    statusVariant = "destructive";
    statusIcon = <XCircle className="h-5 w-5" />;
    statusText = "Ditolak";
  }

  return (
    <Card className="mt-6 animate-in slide-in-from-bottom duration-300">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {isCheckIn ? <UserCheck className="h-5 w-5" /> : <UserCheck className="h-5 w-5 rotate-180" />}
            {isCheckIn ? 'Presensi Masuk' : 'Presensi Pulang'}
          </CardTitle>
          <Badge variant={statusVariant} className="flex items-center gap-1">
            {statusIcon}
            {statusText}
          </Badge>
        </div>
        <CardDescription>
          {result.timestamp} • {result.institutionName}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Waktu Presensi</span>
            </div>
            <span className="text-sm">{result.timestamp}</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Institusi</span>
            </div>
            <span className="text-sm truncate max-w-[200px] text-right">{result.institutionName}</span>
          </div>
          
          {result.distanceFromInstitution !== undefined && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Jarak dari Institusi</span>
              </div>
              <span className="text-sm">{Math.round(result.distanceFromInstitution)} meter</span>
            </div>
          )}
          
          {result.faceMatchScore !== undefined && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Akurasi Wajah</span>
              </div>
              <span className="text-sm">{Math.round(result.faceMatchScore * 100)}%</span>
            </div>
          )}
          
          {result.status === 'flagged' && result.flagReasons && result.flagReasons.length > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">Alasan Ditandai</span>
              </div>
              <ul className="text-xs text-yellow-700 space-y-1">
                {result.flagReasons.map((reason: string, index: number) => (
                  <li key={index}>• {reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Badge variant="outline">
          {isCheckIn ? 'Masuk' : 'Pulang'} • {new Date().toLocaleDateString('id-ID')}
        </Badge>
        <div className="flex items-center gap-2">
          {result.qrToken && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <QrCode className="h-3 w-3" />
              QR Terverifikasi
            </Badge>
          )}
          <Badge variant="outline">{isSuccess ? '✓' : '✗'} Proses</Badge>
        </div>
      </CardFooter>
    </Card>
  );
};