'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, RotateCcw, CheckCircle, AlertCircle, Check, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useFaceRecognition } from '@/app/hooks/useFaceRecognition';

interface FaceCapture {
  id: number;
  image: string | null;
  captured: boolean;
  descriptor?: Float32Array;
  confidence?: number;
}

interface FaceEnrollmentSectionProps {
  onEnrollmentChange?: (enrolled: boolean) => void;
}

// Helper component for quality indicator (defined outside to avoid recreation)
function QualityIndicator({ faceDetected, faceQuality }: { faceDetected: boolean; faceQuality: 'low' | 'medium' | 'good' }) {
  if (!faceDetected) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-gray-500/90 text-white">
        <AlertCircle className="h-3 w-3" />
        Tidak Ada Wajah
      </div>
    );
  }

  const config = {
    good: { colors: 'bg-green-500/90', label: 'Bagus', icon: <CheckCircle className="h-3 w-3" /> },
    medium: { colors: 'bg-yellow-500/90', label: 'Cukup', icon: <AlertTriangle className="h-3 w-3" /> },
    low: { colors: 'bg-red-500/90', label: 'Perbaiki Posisi', icon: <AlertCircle className="h-3 w-3" /> },
  };

  const { colors, label, icon } = config[faceQuality];

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${colors}`}>
      {icon}
      {label}
    </div>
  );
}

export default function FaceEnrollmentSection({ onEnrollmentChange }: FaceEnrollmentSectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const detectFaceRef = useRef<(input: HTMLVideoElement) => Promise<ReturnType<typeof detectFace>>>();
  const isModelLoadedRef = useRef(false);
  const runDetectionRef = useRef<() => void>(() => {});

  const [captures, setCaptures] = useState<FaceCapture[]>([
    { id: 1, image: null, captured: false },
    { id: 2, image: null, captured: false },
    { id: 3, image: null, captured: false },
    { id: 4, image: null, captured: false },
    { id: 5, image: null, captured: false },
  ]);
  const [currentCaptureIndex, setCurrentCaptureIndex] = useState(0);
  const [isConsentGiven, setIsConsentGiven] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingEnrollment, setLoadingEnrollment] = useState(true);

  // Face detection state
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceQuality, setFaceQuality] = useState<'low' | 'medium' | 'good'>('low');
  const [isModelLoading, setIsModelLoading] = useState(false);

  const {
    isModelLoaded,
    loadModels,
    detectFace,
    checkLiveness,
  } = useFaceRecognition();

  // Keep refs updated
  useEffect(() => {
    detectFaceRef.current = detectFace;
    isModelLoadedRef.current = isModelLoaded;
  }, [detectFace, isModelLoaded]);

  // Check enrollment status on mount
  useEffect(() => {
    let cancelled = false;
    const checkEnrollment = async (attempt = 1) => {
      try {
        const res = await fetch('/api/face-enrollment');
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setIsEnrolled(data.isEnrolled);
          onEnrollmentChange?.(data.isEnrolled);
          if (data.pdpConsentGiven) {
            setIsConsentGiven(true);
          }
        }
      } catch (err) {
        if (cancelled) return;
        if (attempt < 3) {
          setTimeout(() => checkEnrollment(attempt + 1), 1500 * attempt);
          return;
        }
        console.error('Error checking enrollment after 3 attempts:', err);
      } finally {
        if (!cancelled) setLoadingEnrollment(false);
      }
    };
    const timer = setTimeout(() => checkEnrollment(), 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [onEnrollmentChange]);

  // Request camera permission
  useEffect(() => {
    if (!isConsentGiven || !videoRef.current || mediaStreamRef.current) return;

    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        mediaStreamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        setError('Tidak dapat mengakses kamera. Pastikan Anda memberikan izin dan kamera tersedia.');
      }
    };

    startCamera();

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        mediaStreamRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isConsentGiven]);

  // Load models when consent is given
  useEffect(() => {
    const initModels = async () => {
      if (isConsentGiven && !isModelLoaded) {
        setIsModelLoading(true);
        await loadModels();
        setIsModelLoading(false);
      }
    };
    initModels();
  }, [isConsentGiven, isModelLoaded, loadModels]);

    // Face detection function stored in ref
  const performFaceDetection = useCallback(async () => {
    if (!videoRef.current || !mediaStreamRef.current?.active) return;

    try {
      if (isModelLoadedRef.current && detectFaceRef.current) {
        const result = await detectFaceRef.current(videoRef.current);
        setFaceDetected(result.detected);

        if (result.detected && result.box) {
          const box = result.box;
          const videoWidth = videoRef.current.videoWidth || 640;
          const videoHeight = videoRef.current.videoHeight || 480;

          const faceAreaRatio = (box.width * box.height) / (videoWidth * videoHeight);
          const centerX = box.x + box.width / 2;
          const centerY = box.y + box.height / 2;
          const offsetX = Math.abs(centerX - videoWidth / 2) / videoWidth;
          const offsetY = Math.abs(centerY - videoHeight / 2) / videoHeight;

          if (faceAreaRatio > 0.08 && offsetX < 0.15 && offsetY < 0.2 && result.confidence > 0.7) {
            setFaceQuality('good');
          } else if (faceAreaRatio > 0.04 && offsetX < 0.25 && offsetY < 0.3) {
            setFaceQuality('medium');
          } else {
            setFaceQuality('low');
          }
        } else {
          setFaceQuality('low');
        }
      }
    } catch {
      // Silently handle errors
    }

    // Continue loop
    // eslint-disable-next-line react-hooks/immutability
    if (mediaStreamRef.current?.active) {
      animationFrameRef.current = requestAnimationFrame(performFaceDetection);
    }
  }, []);

  // Update ref with latest function
  useEffect(() => {
    runDetectionRef.current = performFaceDetection;
  }, [performFaceDetection]);

  // Start/stop face detection
  useEffect(() => {
    if (mediaStreamRef.current?.active && isModelLoaded && isConsentGiven) {
      runDetectionRef.current();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isModelLoaded, isConsentGiven]);

  const handleConsent = () => {
    setIsConsentGiven(true);
    toast.success('Persetujuan diberikan. Anda dapat melanjutkan proses perekaman wajah.');
  };

  const captureCurrentImage = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isModelLoaded) {
      toast.error('Model belum dimuat. Mohon tunggu...');
      return;
    }

    if (!faceDetected) {
      toast.error('Wajah tidak terdeteksi. Pastikan wajah Anda terlihat jelas.');
      return;
    }

    if (faceQuality === 'low') {
      toast.warning('Posisikan wajah lebih baik untuk hasil optimal.');
      return;
    }

    const livenessResult = await checkLiveness(videoRef.current);

    if (!livenessResult.passed) {
      let errorMsg = 'Verifikasi gagal: ';
      if (!livenessResult.checks.faceDetected) errorMsg += 'Wajah tidak terdeteksi. ';
      if (!livenessResult.checks.faceNotTooSmall) errorMsg += 'Wajah terlalu kecil. ';
      if (!livenessResult.checks.sufficientLighting) errorMsg += 'Pencahayaan kurang. ';

      toast.error(errorMsg);
      setError(errorMsg);
      return;
    }

    const context = canvasRef.current.getContext('2d');
    if (!context) return;

    canvasRef.current.width = videoRef.current.videoWidth || 640;
    canvasRef.current.height = videoRef.current.videoHeight || 480;
    context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

    const imageData = canvasRef.current.toDataURL('image/jpeg', 0.85);
    const detectionResult = await detectFace(videoRef.current);

    const updatedCaptures = [...captures];
    updatedCaptures[currentCaptureIndex] = {
      ...updatedCaptures[currentCaptureIndex],
      image: imageData,
      captured: true,
      descriptor: detectionResult.descriptor,
      confidence: detectionResult.confidence,
    };
    setCaptures(updatedCaptures);

    if (currentCaptureIndex < captures.length - 1) {
      setCurrentCaptureIndex(currentCaptureIndex + 1);
      toast.success(`Gambar ${currentCaptureIndex + 1} berhasil diambil!`);
    } else {
      toast.success('Semua gambar berhasil diambil!');
    }
  }, [captures, currentCaptureIndex, faceDetected, faceQuality, isModelLoaded, checkLiveness, detectFace]);

  const retakeImage = (index: number) => {
    const updatedCaptures = [...captures];
    updatedCaptures[index] = {
      ...updatedCaptures[index],
      image: null,
      captured: false,
      descriptor: undefined,
      confidence: undefined,
    };
    setCaptures(updatedCaptures);

    if (index <= currentCaptureIndex) {
      setCurrentCaptureIndex(index);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const allCaptured = captures.every(capture => capture.captured);
      if (!allCaptured) {
        throw new Error('Harap selesaikan semua perekaman wajah sebelum menyimpan.');
      }

      const response = await fetch('/api/face-enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faceImages: captures.map(c => c.image),
          faceDescriptors: captures.map(c => c.descriptor ? JSON.stringify(Array.from(c.descriptor)) : null),
          pdpConsent: true
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Gagal menyimpan data wajah.');
      }

      toast.success('Data wajah berhasil disimpan!');
      setIsEnrolled(true);
      onEnrollmentChange?.(true);

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        mediaStreamRef.current = null;
      }
    } catch (err: any) {
      console.error('Error during face enrollment:', err);
      setError(err.message || 'Terjadi kesalahan saat menyimpan data wajah');
      toast.error(err.message || 'Gagal menyimpan data wajah. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Apakah Anda yakin ingin menghapus data wajah? Anda perlu mendaftarkan ulang.')) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/face-enrollment', { method: 'DELETE' });
      if (res.ok) {
        toast.success('Data wajah berhasil dihapus!');
        setIsEnrolled(false);
        onEnrollmentChange?.(false);
        setCaptures([
          { id: 1, image: null, captured: false },
          { id: 2, image: null, captured: false },
          { id: 3, image: null, captured: false },
          { id: 4, image: null, captured: false },
          { id: 5, image: null, captured: false },
        ]);
        setCurrentCaptureIndex(0);
        setIsConsentGiven(false);
      } else {
        throw new Error('Gagal menghapus data wajah');
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus data wajah');
    } finally {
      setIsLoading(false);
    }
  };

  const resetAll = () => {
    setCaptures([
      { id: 1, image: null, captured: false },
      { id: 2, image: null, captured: false },
      { id: 3, image: null, captured: false },
      { id: 4, image: null, captured: false },
      { id: 5, image: null, captured: false },
    ]);
    setCurrentCaptureIndex(0);
  };

  const completedCaptures = captures.filter(c => c.captured).length;

  if (loadingEnrollment) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Card */}
      {isEnrolled && isConsentGiven && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-full">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-emerald-800">Wajah Telah Terdaftar</p>
              <p className="text-xs text-emerald-600">Data wajah Anda telah terdaftar untuk verifikasi presensi.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={isLoading}
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              Hapus
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      {!isConsentGiven ? (
        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold">Pemberitahuan Perlindungan Data Pribadi</p>
              <p className="text-sm mt-1">
                Kami akan mengambil gambar wajah Anda untuk verifikasi presensi. Data disimpan sesuai UU No. 27 Tahun 2022.
              </p>
            </AlertDescription>
          </Alert>

          <Button onClick={handleConsent} className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold">
            <Check className="mr-2 h-4 w-4" />
            Saya Setuju dan Memberikan Persetujuan
          </Button>
        </div>
      ) : !isEnrolled ? (
        <div className="space-y-4">
          {/* Model loading indicator */}
          {isModelLoading && (
            <Alert className="border-amber-200 bg-amber-50">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription className="flex items-center gap-2">
                Memuat model pengenalan wajah, mohon tunggu...
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Camera Preview */}
            <div className="space-y-3">
              <div className="bg-gray-900 rounded-lg overflow-hidden aspect-video flex items-center justify-center relative">
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
                    <div
                      className="w-52 h-64 border-2 border-dashed rounded-full opacity-50"
                      style={{
                        borderColor: faceDetected
                          ? faceQuality === 'good' ? '#22c55e' : faceQuality === 'medium' ? '#eab308' : '#ef4444'
                          : 'rgba(255,255,255,0.5)',
                      }}
                    />
                  </div>
                </div>

                {/* Face detection status */}
                <div className="absolute top-2 right-2">
                  <QualityIndicator faceDetected={faceDetected} faceQuality={faceQuality} />
                </div>

                {error && (
                  <div className="absolute inset-0 bg-red-500/70 flex items-center justify-center p-4">
                    <p className="text-white font-semibold text-sm">{error}</p>
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>

              <Button
                onClick={captureCurrentImage}
                disabled={
                  currentCaptureIndex >= captures.length ||
                  captures[currentCaptureIndex]?.captured ||
                  !faceDetected ||
                  faceQuality === 'low' ||
                  !isModelLoaded
                }
                className="w-full bg-violet-600 hover:bg-violet-700"
              >
                <Camera className="mr-2 h-4 w-4" />
                {captures[currentCaptureIndex]?.captured
                  ? 'Tersimpan'
                  : !faceDetected
                  ? 'Posisikan Wajah Dulu'
                  : faceQuality === 'low'
                  ? 'Perbaiki Posisi Wajah'
                  : `Ambil Gambar ${currentCaptureIndex + 1}`}
              </Button>

              <p className="text-xs text-slate-500 text-center">
                {completedCaptures}/{captures.length} gambar diambil
              </p>

              {/* Quality tips */}
              <div className="text-xs text-slate-400 bg-slate-50 rounded-lg p-2">
                <p className="font-medium text-slate-600 mb-1">💡 Tips:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Pencahayaan merata dari depan</li>
                  <li>Wajah di tengah oval</li>
                  <li>5 sudut berbeda (depan, kiri, kanan, atas, bawah)</li>
                </ul>
              </div>
            </div>

            {/* Preview Grid */}
            <div className="space-y-3">
              <p className="font-medium text-sm">Preview ({completedCaptures}/{captures.length})</p>
              <div className="grid grid-cols-5 gap-2">
                {captures.map((capture) => (
                  <div key={capture.id} className="aspect-square relative group">
                    {capture.captured ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={capture.image!}
                          alt={`Preview ${capture.id}`}
                          className="w-full h-full object-cover rounded-lg border-2 border-emerald-500"
                        />
                        <div className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5">
                          <CheckCircle className="h-3 w-3" />
                        </div>
                        <button
                          onClick={() => retakeImage(capture.id - 1)}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center"
                        >
                          <RotateCcw className="h-4 w-4 text-white" />
                        </button>
                      </div>
                    ) : (
                      <div className={`border-2 rounded-lg h-full flex items-center justify-center ${
                        capture.id - 1 === currentCaptureIndex && faceDetected
                          ? 'border-violet-500 bg-violet-50'
                          : 'border-dashed border-slate-300 bg-slate-50'
                      }`}>
                        <span className="text-xs text-slate-400">{capture.id}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 text-center">
                Klik untuk mengambil ulang
              </p>
            </div>
          </div>

          {completedCaptures === captures.length && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetAll} className="flex-1">
                <RotateCcw className="mr-2 h-4 w-4" />
                Edit Ulang
              </Button>
              <Button onClick={handleSubmit} disabled={isLoading} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</>
                ) : (
                  <><Check className="mr-2 h-4 w-4" />Simpan</>
                )}
              </Button>
            </div>
          )}

          {error && !error.includes('kamera') && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      ) : null}
    </div>
  );
}
