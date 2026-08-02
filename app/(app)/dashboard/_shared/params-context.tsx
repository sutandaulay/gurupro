"use client";

import { createContext, useContext, type ReactNode } from "react";

export type PageParams = Record<string, string>;

const ParamsContext = createContext<PageParams>({});

export function DashboardParamsProvider({
  params,
  children,
}: {
  params: PageParams;
  children: ReactNode;
}) {
  return (
    <ParamsContext.Provider value={params}>{children}</ParamsContext.Provider>
  );
}

export function useDashboardParams(): PageParams {
  return useContext(ParamsContext);
}