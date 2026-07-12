/**
 * Redirect /dashboard/bahan-ajar/[id] to /dashboard/administrasi
 * All Bahan Ajar results are now accessible via Administrasi page
 */

import { redirect } from "next/navigation";

export default function BahanAjarDetailPage({ params }: { params: Promise<{ id: string }> }) {
  redirect("/dashboard/administrasi");
}
