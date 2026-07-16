// Server Component
// Ini adalah wrapper yang akan mengirim data dari server ke client component
import { ReactNode } from "react";
import ClientProvidersWrapper from "./client-providers-wrapper";

interface ProvidersWrapperProps {
  children: ReactNode;
  gurupro_session?: string;
  gurupro_school_selected?: string;
}

export default function ProvidersWrapper({ 
  children, 
  gurupro_session, 
  gurupro_school_selected 
}: ProvidersWrapperProps) {
  // Kirim data dari server ke client component
  return (
    <ClientProvidersWrapper 
      gurupro_session={gurupro_session} 
      gurupro_school_selected={gurupro_school_selected}
    >
      {children}
    </ClientProvidersWrapper>
  );
}