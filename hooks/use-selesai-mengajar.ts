"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  SelesaiMengajarInput,
  ProgressEvent,
  SelesaiMengajarResult,
  ScheduleInfo,
  AttendanceSummary,
} from '@/lib/selesai-mengajar/types';

interface UseSelesaiMengajarOptions {
  onComplete?: (result: SelesaiMengajarResult) => void;
  onError?: (error: string) => void;
}

interface StepProgress {
  step: string;
  status: 'pending' | 'loading' | 'done' | 'error';
  message: string;
  data?: any;
}

const STEPS = ['jurnal', 'absensi', 'atp', 'memory', 'next'] as const;

export function useSelesaiMengajar(options: UseSelesaiMengajarOptions = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'confirm' | 'processing' | 'result'>('confirm');
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleInfo | null>(null);
  const [progress, setProgress] = useState<StepProgress[]>([]);
  const [result, setResult] = useState<SelesaiMengajarResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize progress steps
  const initializeProgress = useCallback(() => {
    return STEPS.map((step) => ({
      step,
      status: 'pending' as const,
      message: '',
      data: undefined,
    }));
  }, []);

  // Update progress for a specific step
  const updateProgress = useCallback(
    (event: ProgressEvent) => {
      if (event.step === 'start' || event.step === 'complete' || event.step === 'error') {
        return;
      }

      setProgress((prev) => {
        const existing = prev.find((p) => p.step === event.step);
        if (existing) {
          return prev.map((p) =>
            p.step === event.step
              ? { ...p, status: event.status || 'done', message: event.message || '', data: event.data }
              : p
          );
        }
        return [
          ...prev,
          {
            step: event.step,
            status: event.status || 'done',
            message: event.message || '',
            data: event.data,
          },
        ];
      });
    },
    []
  );

  // Calculate overall progress percentage
  const progressPercentage = useCallback(() => {
    if (progress.length === 0) return 0;
    const doneCount = progress.filter((p) => p.status === 'done').length;
    const errorCount = progress.filter((p) => p.status === 'error').length;
    return Math.round(((doneCount + errorCount) / STEPS.length) * 100);
  }, [progress]);

  // Open modal
  const openModal = useCallback((schedule?: ScheduleInfo) => {
    setIsOpen(true);
    setCurrentStep('confirm');
    setSelectedSchedule(schedule || null);
    setProgress(initializeProgress());
    setResult(null);
    setError(null);
  }, [initializeProgress]);

  // Close modal
  const closeModal = useCallback(() => {
    if (isProcessing) {
      // Cancel ongoing request
      abortControllerRef.current?.abort();
    }
    setIsOpen(false);
    setIsProcessing(false);
    setCurrentStep('confirm');
    setProgress(initializeProgress());
    setResult(null);
    setError(null);
  }, [isProcessing, initializeProgress]);

  // Execute Selesai Mengajar
  const selesaikanMengajar = useCallback(
    async (input: Partial<SelesaiMengajarInput> & { attendance: AttendanceSummary }) => {
      setIsProcessing(true);
      setCurrentStep('processing');
      setProgress(initializeProgress());
      setError(null);

      // Create abort controller
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch('/api/selesai-mengajar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Terjadi kesalahan');
        }

        // Read SSE stream
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event: ProgressEvent = JSON.parse(line.slice(6));
                updateProgress(event);

                if (event.step === 'complete' && event.data) {
                  setResult(event.data);
                  setCurrentStep('result');
                  setIsProcessing(false);
                  options.onComplete?.(event.data);
                }

                if (event.step === 'error') {
                  throw new Error(event.message);
                }
              } catch (parseError) {
                console.error('Failed to parse SSE event:', parseError);
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('Request was cancelled');
        } else {
          const errorMessage = err.message || 'Terjadi kesalahan saat memproses';
          setError(errorMessage);
          setCurrentStep('confirm');
          setIsProcessing(false);
          options.onError?.(errorMessage);
        }
      }
    },
    [initializeProgress, updateProgress, options]
  );

  // Fetch available schedules
  const fetchSchedules = useCallback(async (): Promise<ScheduleInfo[]> => {
    try {
      const response = await fetch('/api/selesai-mengajar');
      if (!response.ok) throw new Error('Failed to fetch schedules');
      const data = await response.json();
      return data.schedules || [];
    } catch (err) {
      console.error('Failed to fetch schedules:', err);
      return [];
    }
  }, []);

  // Cancel processing
  const cancelProcessing = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsProcessing(false);
    setCurrentStep('confirm');
    setProgress(initializeProgress());
  }, [initializeProgress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    // State
    isOpen,
    isProcessing,
    currentStep,
    selectedSchedule,
    progress,
    result,
    error,
    progressPercentage: progressPercentage(),

    // Actions
    openModal,
    closeModal,
    selesaikanMengajar,
    fetchSchedules,
    cancelProcessing,
    setSelectedSchedule,
    setResult,
  };
}