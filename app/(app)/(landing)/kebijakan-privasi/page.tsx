import LegalPage from "@/components/landing/LegalPage";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function KebijakanPrivasiPage() {
  let data: any = null;
  try {
    const res = await query("SELECT value FROM system_settings WHERE key = 'privacy_policy'");
    if (res.rows.length > 0) {
      const val = res.rows[0].value;
      data = typeof val === "string" ? JSON.parse(val) : val;
    }
  } catch {}

  return (
    <LegalPage
      data={data}
      defaultContent={`<p>Kebijakan Privasi ini menjelaskan bagaimana GuruPRO AI mengumpulkan, menggunakan, dan melindungi informasi pribadi Anda saat menggunakan platform kami.</p>

<h2>Informasi yang Kami Kumpulkan</h2>
<p>Kami mengumpulkan informasi yang Anda berikan secara langsung saat mendaftar, termasuk nama lengkap, alamat email, nomor WhatsApp, dan informasi sekolah. Kami juga mengumpulkan data penggunaan platform untuk meningkatkan layanan kami.</p>

<h2>Penggunaan Informasi</h2>
<p>Informasi yang kami kumpulkan digunakan untuk: menyediakan dan memelihara layanan, memproses transaksi, mengirimkan pembaruan dan informasi terkait layanan, serta meningkatkan pengalaman pengguna.</p>

<h2>Perlindungan Data</h2>
<p>Kami menerapkan langkah-langkah keamanan yang wajar untuk melindungi data pribadi Anda dari akses tidak sah, perubahan, pengungkapan, atau penghancuran.</p>

<h2>Kontak</h2>
<p>Jika Anda memiliki pertanyaan mengenai Kebijakan Privasi ini, silakan hubungi kami di support@gurupro.id.</p>`}
    />
  );
}