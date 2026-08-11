"use client";

import BendaharaDashboardContent from "@/app/(app)/dashboard/institution/[institutionId]/bendahara/content";

export default function BendaharaPage({
  params,
}: {
  params: Promise<{ institutionId: string }>;
}) {
  return <BendaharaDashboardContent />;
}
