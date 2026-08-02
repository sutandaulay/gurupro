"use client";

import { ReactNode } from "react";
import Providers from "./providers";
import VoiceBriefingPlayer from "@/components/voice/VoiceBriefingPlayer";

interface ClientProvidersWrapperProps {
  children: ReactNode;
  gurupro_session?: string;
  gurupro_school_selected?: string;
}

export default function ClientProvidersWrapper({ 
  children, 
  gurupro_session, 
  gurupro_school_selected 
}: ClientProvidersWrapperProps) {
  let userId: string | null = null;
  if (gurupro_session) {
    try {
      const parsed = JSON.parse(gurupro_session);
      userId = parsed.id || null;
    } catch {
      userId = null;
    }
  }

  return (
    <Providers 
      gurupro_session={gurupro_session} 
      gurupro_school_selected={gurupro_school_selected}
    >
      {userId ? <VoiceBriefingPlayer userId={userId} /> : null}
      {children}
    </Providers>
  );
}
