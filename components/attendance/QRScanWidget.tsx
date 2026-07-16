'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QrCode, Camera, Scan, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface QRScanWidgetProps {
  onScan: (token: string) => void;
  hasScanned?: boolean;
}

// QR Code detection using image processing
// This is a simplified implementation - for production, consider using a library like jsQR
const scanQRCode = (canvas: HTMLCanvasElement, video: HTMLVideoElement): string | null => {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Simple QR-like pattern detection (simplified)
    // In production, use a proper QR library like jsQR or zxing-wasm

    // For now, we'll return null and rely on manual input
    // A full implementation would decode QR codes from the image data

    return null;
  } catch (error) {
    console.error('QR scan error:', error);
    return null;
  }
};

export const QRScanWidget = ({ onScan, hasScanned = false }: QRScanWidgetProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedToken, setScannedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanAttempts, setScanAttempts] = useState(0);
  const [manualInputMode, setManualInputMode] = useState(false);
  const [manualToken, setManualToken] = useState('');

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setIsScanning(true);

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      setError(`Tidak dapat mengakses kamera: ${err.message || 'Pastikan Anda memberikan izin akses kamera.'}`);
      setIsScanning(false);
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    setIsScanning(false);
  }, [stream]);

  // QR Scanning loop
  useEffect(() => {
    if (isScanning && videoRef.current && canvasRef.current) {
      scanIntervalRef.current = setInterval(() => {
        const result = scanQRCode(canvasRef.current!, videoRef.current!);
        setScanAttempts(prev => prev + 1);

        if (result) {
          handleScanSuccess(result);
        }
      }, 500); // Scan every 500ms
    }

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, [isScanning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Handle successful scan
  const handleScanSuccess = (token: string) => {
    setScannedToken(token);
    setManualToken(token);
    onScan(token);
    toast.success('QR Code berhasil dipindai!');
    stopCamera();
  };

  // Handle manual input submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken.trim()) {
      handleScanSuccess(manualToken.trim());
    }
  };

  // Toggle manual input mode
  const toggleManualInput = () => {
    setManualInputMode(!manualInputMode);
    if (!manualInputMode) {
      stopCamera();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          Pindai QR Code
        </CardTitle>
        <CardDescription>
          Pindai QR Code institusi untuk verifikasi tambahan (opsional)
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* QR Scanner Area */}
          <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
            {isScanning && stream ? (
              <div className="w-full h-full relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />
                {/* Scan overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative">
                    <div className="w-64 h-64 border-2 border-blue-500 rounded-lg" />
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-blue-500 animate-pulse" />
                  </div>
                </div>
                {/* Corner markers */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 pointer-events-none">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />
                </div>
              </div>
            ) : scannedToken ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-green-50">
                <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                <p className="text-center font-semibold text-green-700">QR Code Terpindai!</p>
                <p className="text-center text-sm text-green-600 break-all mt-2 max-w-full truncate px-4">
                  {scannedToken}
                </p>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                <div className="bg-gray-50 rounded-full p-6 mb-4">
                  <QrCode className="h-12 w-12 text-gray-300" />
                </div>
                <p className="text-sm text-muted-foreground">QR Code verifikasi belum dipindai</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Fitur ini opsional tergantung pengaturan institusi
                </p>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Error display */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Scanning status */}
          {isScanning && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Memindai QR Code...</span>
              <span className="text-xs">({scanAttempts} percobaan)</span>
            </div>
          )}

          {/* Manual input form */}
          {manualInputMode && !scannedToken && (
            <form onSubmit={handleManualSubmit} className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <div>
                <label htmlFor="manual-token" className="block text-sm font-medium mb-1">
                  Masukkan Kode QR Manual
                </label>
                <input
                  id="manual-token"
                  type="text"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Masukkan kode QR..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <Button type="submit" disabled={!manualToken.trim()} className="w-full">
                Verifikasi Kode
              </Button>
            </form>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2">
            {!isScanning && !scannedToken && (
              <Button
                onClick={startCamera}
                className="flex-1 flex items-center gap-2"
              >
                <Camera className="h-4 w-4" />
                Mulai Pemindaian
              </Button>
            )}

            {isScanning && (
              <Button
                onClick={stopCamera}
                variant="outline"
                className="flex-1 flex items-center gap-2"
              >
                <XCircle className="h-4 w-4" />
                Berhenti Memindai
              </Button>
            )}

            <Button
              variant={manualInputMode ? "default" : "secondary"}
              onClick={toggleManualInput}
              className="flex-1 flex items-center gap-2"
            >
              {manualInputMode ? (
                <>
                  <Scan className="h-4 w-4" />
                  Mode Kamera
                </>
              ) : (
                <>
                  <QrCode className="h-4 w-4" />
                  Input Manual
                </>
              )}
            </Button>

            {scannedToken && (
              <Button
                onClick={() => {
                  setScannedToken(null);
                  setManualToken('');
                  setScanAttempts(0);
                }}
                variant="outline"
                className="flex-1 flex items-center gap-2"
              >
                <QrCode className="h-4 w-4" />
                Scan Ulang
              </Button>
            )}
          </div>

          {/* Help text */}
          {!isScanning && !scannedToken && !manualInputMode && (
            <p className="text-xs text-center text-muted-foreground">
              Pastikan QR Code terlihat jelas di dalam bingkai pemindaian
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
