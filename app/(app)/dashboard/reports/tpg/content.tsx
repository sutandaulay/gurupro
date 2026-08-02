"use client";

import dynamic from "next/dynamic";

export default dynamic(
  () => import("@/app/(app)/reports/tpg/page"),
  { ssr: false }
);
