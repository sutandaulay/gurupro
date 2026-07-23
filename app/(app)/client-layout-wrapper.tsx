"use client";

import React, { ReactNode, Suspense } from "react";

interface ClientLayoutProps {
  children: ReactNode;
  gurupro_session?: string;
  gurupro_school_selected?: string;
}

const getProviders = async (): Promise<{ default: React.ComponentType<{ children: ReactNode; gurupro_session?: string; gurupro_school_selected?: string }> }> => {
  const module = await import("./providers");
  return { default: module.default };
};

export default function ClientLayout({ 
  children, 
  gurupro_session, 
  gurupro_school_selected 
}: ClientLayoutProps) {
  const Providers = React.lazy(getProviders);

  return (
    <Suspense fallback="Loading...">
      <Providers 
        gurupro_session={gurupro_session} 
        gurupro_school_selected={gurupro_school_selected}
      >
        {children}
      </Providers>
    </Suspense>
  );
}