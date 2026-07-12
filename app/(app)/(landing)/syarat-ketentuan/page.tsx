import LegalPage from "@/components/landing/LegalPage";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SyaratKetentuanPage() {
  let data: any = null;
  try {
    const res = await query("SELECT value FROM system_settings WHERE key = 'terms_conditions'");
    if (res.rows.length > 0) {
      const val = res.rows[0].value;
      data = typeof val === "string" ? JSON.parse(val) : val;
    }
  } catch {}

  return (
    <LegalPage
      data={data}
      defaultContent={`<p>Dengan menggunakan platform GuruPRO AI, Anda menyetujui syarat dan ketentuan berikut:</p>

<h2>Akun Pengguna</h2>
<p>Anda bertanggung jawab untuk menjaga kerahasiaan informasi akun Anda, termasuk password. Segala aktivitas yang terjadi dalam akun Anda sepenuhnya menjadi tanggung jawab Anda.</p>

<h2>Layanan</h2>
<p>GuruPRO AI menyediakan layanan generator soal, administrasi guru, dan fitur berbasis AI lainnya. Kami berhak untuk mengubah, menangguhkan, atau menghentikan layanan sewaktu-waktu dengan pemberitahuan sebelumnya.</p>

<h2>Pembayaran</h2>
<p>Pembayaran langganan diproses melalui pihak ketiga (Xendit/Midtrans/Duitku). Harga dan paket dapat berubah sewaktu-waktu dengan pemberitahuan sebelumnya.</p>

<h2>Pembatasan Tanggung Jawab</h2>
<p>GuruPRO AI tidak bertanggung jawab atas kerugian langsung atau tidak langsung yang timbul dari penggunaan platform ini. Konten yang dihasilkan oleh AI harus diverifikasi oleh pengguna sebelum digunakan.</p>`}
    />
  );
}