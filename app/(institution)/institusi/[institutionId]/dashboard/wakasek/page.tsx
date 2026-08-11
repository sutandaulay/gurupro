"use client";

import WakasekDashboardContent from "@/app/(app)/dashboard/institution/[institutionId]/wakasek/content";

export default function WakasekPage({
  params,
}: {
  params: Promise<{ institutionId: string }>;
}) {
  return <WakasekDashboardContent />;
}
