/**
 * Audiobook Player using wavesurfer.js
 * Mini-player persist state via React context (not localStorage for cross-device)
 * Progress update every ~15s when playing (throttled)
 */

"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";

interface Props {
  fileUrl: string;
  itemId: string;
  coverUrl: string | null;
  initialPosition: number;
  duration: number;
  onClose: () => void;
  onRefreshUrl?: () => Promise<string | null>;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({ fileUrl, itemId, coverUrl, initialPosition, duration, onClose, onRefreshUrl }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialPosition);
  const [totalDuration, setTotalDuration] = useState(duration);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState(fileUrl);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastReportRef = useRef(0);
  const reportIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCountRef = useRef(0);

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  const reportProgress = useCallback(async (time: number) => {
    const now = Date.now();
    if (now - lastReportRef.current < 15000) return; // Throttle 15s
    lastReportRef.current = now;

    const percent = totalDuration > 0 ? Math.round((time / totalDuration) * 100) : 0;
    try {
      await apiFetch("/api/library/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          progressPercent: percent,
          lastPositionSeconds: Math.round(time),
          deltaActiveSeconds: 15,
        }),
      });
    } catch {
      // Silent fail
    }
  }, [itemId, totalDuration]);

  useEffect(() => {
    setCurrentUrl(fileUrl);
    setLoadError(null);
    retryCountRef.current = 0;
  }, [fileUrl]);

  const handleRetry = async () => {
    if (!onRefreshUrl || retryCountRef.current >= 2) return;
    retryCountRef.current++;
    const fresh = await onRefreshUrl();
    if (fresh) {
      setCurrentUrl(fresh);
      setLoadError(null);
    }
  };

  useEffect(() => {
    const audio = new Audio(currentUrl);
    audioRef.current = audio;

    const onError = () => {
      const err = audio.error;
      const code = err?.code;
      if (code === 4 /* MEDIA_ERR_ABORTED */ || retryCountRef.current < 2) {
        setLoadError("Sesi URL berakhir, memuat ulang…");
        handleRetry();
      } else {
        setLoadError("Gagal memuat audio");
      }
    };

    audio.addEventListener("loadedmetadata", () => {
      setTotalDuration(audio.duration || duration);
      setLoadError(null);
      if (initialPosition > 0) {
        audio.currentTime = initialPosition;
      }
    });

    audio.addEventListener("timeupdate", () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      reportProgress(audio.currentTime);
    });

    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.src = "";
      if (reportIntervalRef.current) clearInterval(reportIntervalRef.current);
    };
  }, [currentUrl, initialPosition, duration]);

  // Sync playback rate and volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const skip = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(totalDuration, audioRef.current.currentTime + seconds));
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    audioRef.current.currentTime = pct * totalDuration;
  };

  const speeds = [0.75, 1, 1.25, 1.5, 2];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-900 text-white">
      {loadError ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-slate-400">{loadError}</p>
          <button
            onClick={handleRetry}
            disabled={retryCountRef.current >= 2}
            className="px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 disabled:opacity-40"
          >
            Coba Lagi
          </button>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center">
          <div className="w-64 h-64 rounded-2xl overflow-hidden shadow-2xl mb-8 bg-neutral-800">
            {coverUrl ? (
              <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-600">
                <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
            )}
          </div>

          <div className="w-full max-w-md space-y-4">
        {/* Progress bar */}
        <div>
          <div
            className="h-1.5 bg-neutral-700 rounded-full cursor-pointer group"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-violet-500 rounded-full relative transition-all"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(totalDuration)}</span>
          </div>
        </div>

        {/* Playback controls */}
        <div className="flex items-center justify-center gap-6">
          {/* Skip -15 */}
          <button onClick={() => skip(-15)} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
            <span className="text-[10px] block text-center">-15</span>
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-violet-600 hover:bg-violet-500 flex items-center justify-center transition-colors shadow-lg"
          >
            {isPlaying ? (
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-7 h-7 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Skip +15 */}
          <button onClick={() => skip(15)} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
            </svg>
            <span className="text-[10px] block text-center">+15</span>
          </button>
        </div>

        {/* Speed + Volume */}
        <div className="flex items-center justify-between">
          <select
            value={playbackRate}
            onChange={e => setPlaybackRate(parseFloat(e.target.value))}
            className="bg-neutral-800 border border-neutral-600 rounded-lg px-2 py-1 text-xs text-slate-300 cursor-pointer"
          >
            {speeds.map(s => (
              <option key={s} value={s}>{s}x</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              className="w-20 accent-violet-500"
            />
          </div>
        </div>
        </div>
        </div>
      )}
    </div>
  );
}
