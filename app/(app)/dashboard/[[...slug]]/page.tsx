"use client";

import { useParams } from "next/navigation";
import { DashboardParamsProvider } from "../_shared/params-context";
import { resolveRoute } from "../_shared/route-registry";

export default function DashboardCatchAllPage() {
  const params = useParams();
  const slug = (params.slug as string[]) || [];
  const { component: Component, params: pageParams } = resolveRoute(slug);

  return (
    <DashboardParamsProvider params={pageParams}>
      <Component />
    </DashboardParamsProvider>
  );
}
