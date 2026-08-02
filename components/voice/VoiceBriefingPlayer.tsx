"use client";

import { useEffect, useState, useCallback } from "react";
import { useBriefingPolling } from "@/hooks/use-briefing-polling";

function getIndonesianVoice(voices: SpeechSynthesisVoice[], preferredName?: string | null): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  if (preferredName) {
    const match = voices.find((v) => v.name === preferredName);
    if (match) return match;
  }

  const idVoice = voices.find((v) => /id/i.test(v.lang));
  if (idVoice) return idVoice;

  return voices[0] || null;
}

function speakBriefing(message: string, preferredVoiceName?: string | null) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = "id-ID";
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  const voices = window.speechSynthesis.getVoices();
  const voice = getIndonesianVoice(voices, preferredVoiceName);
  if (voice) utterance.voice = voice;

  window.speechSynthesis.speak(utterance);
}

export default function VoiceBriefingPlayer({ userId }: { userId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [voiceName, setVoiceName] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    fetch("/api/notifications/voice-prefs", { cache: "no-store" })
      .then((r) => r.ok && r.json())
      .then((data) => {
        if (!mounted) return;
        if (data) {
          setEnabled(data.voice_briefing_enabled === true);
          setVoiceName(data.voice_name_preference || "");
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [userId]);

  const handleNotify = useCallback((data: { message: string; scheduleId: string | null }) => {
    if (!data.message) return;
    speakBriefing(data.message, voiceName);
  }, [voiceName]);

  useBriefingPolling(enabled, handleNotify);

  return null;
}
