import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

async function sendApprovalEmail(to: string, token: string, namaLengkap: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const approveUrl = `${baseUrl}/approve-school-registration?token=${encodeURIComponent(token)}`;

  const subject = `Konfirmasi Pendaftaran Institusi - ${namaLengkap || 'GuruPRO'}`;
  const html = `<div style="font-family: sans-serif; padding: 20px;">
    <h2 style="color: #4f46e5;">Konfirmasi Pendaftaran Institusi</h2>
    <p>Halo Bapak/Ibu,</p>
    <p>Kami menerima permintaan pendaftaran institusi <strong>${namaLengkap || 'Anda'}</strong> di GuruPRO.</p>
    <p>Klik tautan berikut untuk menyetujui dan mengaktifkan pendaftaran:</p>
    <p><a href="${approveUrl}" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Setujui Pendaftaran</a></p>
    <p style="color:#666;font-size:14px;">Tautan ini berlaku selama 7 hari. Jika ini bukan permintaan Anda, abaikan email ini.</p>
    <p>Terima kasih,<br>Tim GuruPRO</p>
  </div>`;

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY || '',
    },
    body: JSON.stringify({
      sender: { name: 'GuruPRO', email: process.env.BREVO_SENDER_EMAIL || 'no-reply@gurupro.id' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nama_lembaga, jenjang, naungan, email_kontak, npsn, alamat, nama_kepala_sekolah, whatsapp } = body;

    if (!nama_lembaga || !jenjang || !naungan || !email_kontak) {
      return NextResponse.json({ error: 'Field wajib belum lengkap' }, { status: 400 });
    }

    const existing = await query(
      `SELECT id FROM school_registrations WHERE LOWER(email_kontak) = LOWER($1) AND status = 'pending' LIMIT 1`,
      [email_kontak]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Pendaftaran dengan email ini sedang diproses' }, { status: 409 });
    }

    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const registration = await query(
      `INSERT INTO school_registrations (nama_lembaga, npsn, jenjang, naungan, alamat, nama_kepala_sekolah, email_kontak, whatsapp, status, approval_token, approval_token_expires, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, NOW(), NOW())
       RETURNING id`,
      [nama_lembaga, npsn || null, jenjang, naungan, alamat || null, nama_kepala_sekolah || null, email_kontak, whatsapp || null, token, expiresAt]
    );

    await sendApprovalEmail(email_kontak, token, nama_lembaga);

    return NextResponse.json({ success: true, message: 'Pendaftaran berhasil dikirim. Cek email untuk konfirmasi.', id: registration.rows[0].id }, { status: 201 });
  } catch (error: any) {
    console.error('School registration error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
