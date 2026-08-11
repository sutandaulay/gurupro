"use client";

import { useParams } from "next/navigation";
import { DashboardParamsProvider } from "../_shared/params-context";
import { resolveRoute } from "../_shared/route-registry";
import Content from "../content";

export default function DashboardCatchAllPage() {
  const params = useParams();
  const slug = (params.slug as string[]) || [];

  // Root /dashboard — no slug means empty route
  if (slug.length === 0) {
    return (
      <DashboardParamsProvider params={{}}>
        <Content />
      </DashboardParamsProvider>
    );
  }

  const { component: Component, params: pageParams } = resolveRoute(slug);

  return (
    <DashboardParamsProvider params={pageParams}>
      <Component />
    </DashboardParamsProvider>
  );
}
