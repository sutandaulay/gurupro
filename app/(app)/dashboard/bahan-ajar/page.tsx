/**
 * Redirect /dashboard/bahan-ajar to /dashboard/administrasi
 * All Bahan Ajar functionality is now in Administrasi page
 */

import { redirect } from "next/navigation";

export default function BahanAjarPage() {
  redirect("/dashboard/administrasi?tipe=bahan_ajar");
}
