"use client";

import dynamic from "next/dynamic";

export default dynamic(
  () => import("@/app/(app)/attendance/teaching/page"),
  { ssr: false }
);
