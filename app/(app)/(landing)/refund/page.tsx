import LegalPage from "@/components/landing/LegalPage";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RefundPage() {
  let data: any = null;
  try {
    const res = await query("SELECT value FROM system_settings WHERE key = 'refund_policy'");
    if (res.rows.length > 0) {
      const val = res.rows[0].value;
      data = typeof val === "string" ? JSON.parse(val) : val;
    }
  } catch {}

  return (
    <LegalPage
      data={data}
      defaultContent={`<p>Kebijakan pengembalian dana (refund) GuruPRO AI:</p>

<h2>Refund untuk Pembayaran Premier</h2>
<p>Jika Anda mengalami kendala teknis yang menghalangi penggunaan layanan setelah melakukan pembayaran, Anda dapat mengajukan refund dalam waktu 7x24 jam sejak transaksi. Pengajuan refund akan diproses dalam waktu 3-5 hari kerja setelah disetujui.</p>

<h2>Refund Tidak Dapat Dilakukan Apabila</h2>
<ul>
  <li>Poin kuota sudah digunakan sebagian atau seluruhnya</li>
  <li>Melebihi batas waktu 7x24 jam sejak transaksi</li>
  <li>Pembatalan sepihak tanpa alasan teknis yang jelas</li>
</ul>

<h2>Cara Mengajukan Refund</h2>
<p>Hubungi kami melalui email support@gurupro.id atau WhatsApp CS dengan menyertakan bukti transaksi dan alasan pengajuan refund.</p>

<h2>Kebijakan Layanan Gratis</h2>
<p>Paket Gratis tidak dapat direfund karena tidak ada pembayaran yang dilakukan.</p>`}
    />
  );
}