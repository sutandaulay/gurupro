"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FaceEnrollmentPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/profile?tab=pengaturan");
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="mt-4 text-gray-600 font-medium">Mengalihkan...</p>
      </div>
    </div>
  );
}
