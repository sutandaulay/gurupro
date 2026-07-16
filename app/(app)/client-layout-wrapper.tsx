"use client";

import React, { ReactNode } from "react";

interface ClientLayoutProps {
  children: ReactNode;
  gurupro_session?: string;
  gurupro_school_selected?: string;
}

// 使用动态导入避免循环依赖
const getProviders = async () => {
  const ProvidersModule = await import("./providers");
  return ProvidersModule.default;
};

export default function ClientLayout({ 
  children, 
  gurupro_session, 
  gurupro_school_selected 
}: ClientLayoutProps) {
  // 使用React.lazy和动态导入
  const Providers = React.lazy(getProviders);

  return (
    <React.Suspense fallback="Loading...">
      <Providers 
        gurupro_session={gurupro_session} 
        gurupro_school_selected={gurupro_school_selected}
      >
        {children}
      </Providers>
    </React.Suspense>
  );
}