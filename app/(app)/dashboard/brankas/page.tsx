'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const StoragePage = dynamic(
  () => import('@/app/components/storage/StoragePage'),
  { ssr: false }
);

export default function BrankasPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <StoragePage />
    </Suspense>
  );
}
