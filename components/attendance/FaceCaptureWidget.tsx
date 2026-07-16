'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, RefreshCw, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useFaceRecognition, type LivenessResult } from '@/app/hooks/useFaceRecognition';
import * as faceapi from 'face-api.js';

interface FaceCaptureData {
  embedding: Float32Array | null;
  faceMatchScore: number;
  livenessPassed: boolean;
  confidence: number;
  descriptor?: string;
}

interface FaceCaptureWidgetProps {
  onCapture: (data: FaceCaptureData) => void;
  hasCaptured?: boolean;
  storedDescriptors?: Float32Array[];
  onVerificationResult?: (matched: boolean, score: number) => void;
}

export const FaceCaptureWidget = ({
  onCapture,
  hasCaptured = false,
  storedDescriptors = [],
  onVerificationResult
}: FaceCaptureWidgetProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const detectFaceRef = useRef<(input: HTMLVideoElement) => Promise<ReturnType<typeof detectFace>>>();
  const runDetectionRef = useRef<() => void>(() => {});

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [faceDetected, setFaceDetected] = useState(false);
  const [facePosition, setFacePosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);

  const {
    isModelLoaded,
    loadModels,
    detectFace,
    checkLiveness,
    verifyFace,
  } = useFaceRecognition();

  // Keep refs updated
  useEffect(() => {
    detectFaceRef.current = detectFace;
  }, [detectFace]);

  // Request camera permission
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        setError(null);
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        });
        activeStream = mediaStream;
        setStream(mediaStream);
      } catch (err: any) {
        console.error('Error accessing camera:', err);
        setError(`Tidak dapat mengakses kamera: ${err.message || 'Pastikan Anda memberikan izin dan kamera tersedia.'}`);
      }
    };

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Connect stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Face detection function stored in ref
  const performFaceDetection = useCallback(async () => {
    if (!videoRef.current || !stream || !detectFaceRef.current) return;

    try {
      const result = await detectFaceRef.current(videoRef.current);

      setFaceDetected(result.detected);
      if (result.box) {
        setFacePosition({
          x: result.box.x,
          y: result.box.y,
          width: result.box.width,
          height: result.box.height,
        });
      } else {
        setFacePosition(null);
      }
    } catch {
      // Silently handle detection errors
    }

    // Continue loop
    // eslint-disable-next-line react-hooks/immutability
    if (stream.active) {
      animationFrameRef.current = requestAnimationFrame(performFaceDetection);
    }
  }, [stream]);

  // Update ref with latest function
  useEffect(() => {
    runDetectionRef.current = performFaceDetection;
  }, [performFaceDetection]);

  // Start/stop face detection based on camera state
  useEffect(() => {
    if (stream && stream.active && videoRef.current && isModelLoaded) {
      runDetectionRef.current();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [stream, isModelLoaded]);

  // Load models when component mounts
  useEffect(() => {
    const initModels = async () => {
      if (!isModelLoaded) {
        setIsModelLoading(true);
        await loadModels();
        setIsModelLoading(false);
      }
    };
    initModels();
  }, [isModelLoaded, loadModels]);

  const captureFace = async () => {
    if (!videoRef.current || !canvasRef.current) {
      toast.error('Gagal mengakses kamera');
      return;
    }

    if (!faceDetected) {
      toast.error('Wajah tidak terdeteksi. Pastikan wajah Anda terlihat jelas.');
      return;
    }

    setIsCapturing(true);
    setError(null);

    try {
      // Step 1: Capture image from video
      const context = canvasRef.current.getContext('2d');
      if (!context) {
        throw new Error('Tidak dapat mengakses konteks canvas');
      }

      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

      const imageData = canvasRef.current.toDataURL('image/jpeg', 0.9);
      setPreviewImage(imageData);

      // Step 2: Perform liveness check
      console.log('Performing liveness check...');
      const livenessResult: LivenessResult = await checkLiveness(videoRef.current);

      if (!livenessResult.passed) {
        const failedChecks = Object.entries(livenessResult.checks)
          .filter(([, passed]) => !passed)
          .map(([check]) => check);

        let errorMsg = 'Verifikasi gagal: ';
        if (failedChecks.includes('faceDetected')) errorMsg += 'Wajah tidak terdeteksi. ';
        if (failedChecks.includes('faceNotTooSmall')) errorMsg += 'Wajah terlalu kecil. ';
        if (failedChecks.includes('faceNotOffCenter')) errorMsg += 'Wajah terlalu di pinggir. ';
        if (failedChecks.includes('sufficientLighting')) errorMsg += 'Pencahayaan kurang. ';
        if (failedChecks.includes('noMultipleFaces')) errorMsg += 'Multiple wajah terdeteksi. ';

        toast.error(errorMsg.trim());
        setError(errorMsg.trim());
        setIsCapturing(false);
        return;
      }

      console.log('Liveness check passed:', livenessResult);

      // Step 3: Extract face descriptor
      console.log('Extracting face descriptor...');
      const detectionResult = await detectFace(videoRef.current);

      if (!detectionResult.detected || !detectionResult.descriptor) {
        throw new Error('Tidak dapat mendeteksi wajah dengan akurat');
      }

      // Step 4: If stored descriptors provided, verify match
      let faceMatchScore = detectionResult.confidence;
      let matched = true;

      if (storedDescriptors.length > 0) {
        console.log('Verifying against stored descriptors...');
        const matchResult = await verifyFace(videoRef.current, storedDescriptors);
        faceMatchScore = matchResult.similarity;
        matched = matchResult.match;

        onVerificationResult?.(matched, matchResult.similarity);

        if (!matched) {
          toast.warning('Wajah terdeteksi tapi tidak cocok dengan data terdaftar.');
        }
      }

      // Step 5: Prepare result
      const result: FaceCaptureData = {
        embedding: detectionResult.descriptor,
        faceMatchScore,
        livenessPassed: livenessResult.passed,
        confidence: detectionResult.confidence,
        descriptor: JSON.stringify(Array.from(detectionResult.descriptor)),
      };

      onCapture(result);
      setIsVerified(true);
      toast.success('Wajah berhasil diverifikasi');

    } catch (err: any) {
      console.error('Error capturing face:', err);
      setError(err.message || 'Gagal mengambil gambar wajah');
      toast.error(err.message || 'Gagal mengambil gambar wajah');
    } finally {
      setIsCapturing(false);
    }
  };

  const resetCapture = () => {
    setPreviewImage(null);
    setIsVerified(false);
    setError(null);
    setFaceDetected(false);
    setFacePosition(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Verifikasi Wajah
        </CardTitle>
        <CardDescription>
          Arahkan wajah Anda ke kamera untuk verifikasi identitas
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Model loading indicator */}
          {isModelLoading && (
            <Alert className="border-amber-200 bg-amber-50">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription className="flex items-center gap-2">
                Memuat model pengenalan wajah...
              </AlertDescription>
            </Alert>
          )}

          {/* Face detection overlay */}
          <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
            {stream ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />

                {/* Face guide overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative">
                    <div className="w-56 h-72 border-2 border-dashed rounded-full opacity-50"
                      style={{
                        borderColor: faceDetected ? '#22c55e' : 'rgba(255,255,255,0.5)',
                      }}
                    />

                    {facePosition && (
                      <div
                        className="absolute border-2 border-green-500 rounded-lg opacity-70"
                        style={{
                          left: facePosition.x,
                          top: facePosition.y,
                          width: facePosition.width,
                          height: facePosition.height,
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Face detection status */}
                <div className="absolute top-3 left-3">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                    faceDetected
                      ? 'bg-green-500/90 text-white'
                      : 'bg-amber-500/90 text-white'
                  }`}>
                    {faceDetected ? (
                      <>
                        <CheckCircle className="h-3 w-3" />
                        Wajah Terdeteksi
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3 w-3" />
                        Posisikan Wajah Anda
                      </>
                    )}
                  </div>
                </div>

                {/* Preview overlay */}
                {previewImage && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewImage}
                      alt="Preview wajah"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-4 text-center text-muted-foreground">
                <Camera className="h-12 w-12 mb-2" />
                <p className="text-sm">Kamera tidak dapat diakses</p>
                <p className="text-xs mt-1">Pastikan Anda memberikan izin akses kamera</p>
              </div>
            )}

            {/* Processing overlay */}
            {isCapturing && (
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white">
                <RefreshCw className="h-8 w-8 animate-spin mb-2" />
                <p className="text-sm font-medium">Menganalisis wajah...</p>
                <p className="text-xs opacity-75 mt-1">Pastikan wajah terlihat jelas</p>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="text-xs text-slate-500 space-y-1">
            <p>💡 Tips untuk hasil terbaik:</p>
            <ul className="list-disc list-inside ml-2">
              <li>Pastikan pencahayaan cukup dan merata</li>
              <li>Posisikan wajah di dalam oval panduan</li>
              <li>Hindari background yang terlalu ramai</li>
              <li>Lihat langsung ke kamera</li>
            </ul>
          </div>

          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isVerified ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Wajah berhasil diverifikasi</span>
              </div>
              <Button
                variant="outline"
                onClick={resetCapture}
                className="w-full flex items-center gap-2"
              >
                <Camera className="h-4 w-4" />
                Ambil Ulang
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={captureFace}
                disabled={isCapturing || !stream || !faceDetected || !isModelLoaded}
                className="flex-1 flex items-center gap-2"
              >
                {isCapturing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Memproses...
                  </>
                ) : !faceDetected ? (
                  <>
                    <AlertTriangle className="h-4 w-4" />
                    Posisikan Wajah Dulu
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    Ambil Gambar Wajah
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Export faceapi for external use
export { faceapi };
