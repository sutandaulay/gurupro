"use client";

import { ReactNode } from "react";
import Providers from "./providers";

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
  return (
    <Providers 
      gurupro_session={gurupro_session} 
      gurupro_school_selected={gurupro_school_selected}
    >
      {children}
    </Providers>
  );
}