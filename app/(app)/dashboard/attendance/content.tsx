"use client";

import dynamic from "next/dynamic";

export default dynamic(
  () => import("@/app/(app)/attendance/page"),
  { ssr: false }
);
