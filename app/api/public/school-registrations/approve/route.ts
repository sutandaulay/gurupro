import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { approveSchoolRegistration } from '@/lib/school-registration-approval';
import { sendWhatsAppNotification, sendEmailNotification } from '@/lib/notifications';

async function sendApprovalNotifications(data: any) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const loginUrl = `${baseUrl}/login`;

  if (data.whatsapp) {
    const waMessage = `[GuruPRO] Pendaftaran Institusi Disetujui

Halo tim ${data.nama_lembaga},

Pendaftaran institusi Anda telah disetujui dan akun Anda telah aktif.

Silakan masuk ke akun GuruPRO untuk mulai menggunakan fitur institusi:
${loginUrl}

Jika email ini baru pertama kali digunakan, gunakan menu "Lupa Kata Sandi" pada halaman masuk untuk membuat kata sandi Anda.

Terima kasih,
Tim GuruPRO`;

    try {
      await sendWhatsAppNotification(data.whatsapp, waMessage);
    } catch (err) {
      console.error('Failed to send WhatsApp notification:', err);
    }
  }

  if (data.email) {
    try {
      await sendEmailNotification(
        data.email,
        `Pendaftaran Institusi Disetujui - ${data.nama_lembaga}`,
        `<div style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #4f46e5;">Pendaftaran Institusi Disetujui</h2>
          <p>Halo tim <strong>${data.nama_lembaga}</strong>,</p>
          <p>Pendaftaran institusi Anda telah disetujui dan akun Anda telah aktif.</p>
          <p><a href="${loginUrl}" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Masuk ke GuruPRO</a></p>
          <p style="color:#666;font-size:14px;">Jika email ini baru pertama kali digunakan, gunakan menu <strong>"Lupa Kata Sandi"</strong> pada halaman masuk untuk membuat kata sandi Anda.</p>
          <p>Terima kasih,<br>Tim GuruPRO</p>
        </div>`
      );
    } catch (err) {
      console.error('Failed to send email notification:', err);
    }
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token diperlukan' }, { status: 400 });
    }

    const registration = await query(
      'SELECT * FROM school_registrations WHERE approval_token = $1 AND status = \'pending\' LIMIT 1',
      [token]
    );

    if (registration.rows.length === 0) {
      return NextResponse.json({ error: 'Pendaftaran tidak ditemukan atau sudah diproses' }, { status: 404 });
    }

    const reg = registration.rows[0];

    if (reg.approval_token_expires && new Date(reg.approval_token_expires) < new Date()) {
      return NextResponse.json({ error: 'Token sudah kadaluwarsa' }, { status: 410 });
    }

    // Buat institusi + akun + membership dahulu; jika gagal,
    // status tetap 'pending' sehingga token bisa dicoba ulang.
    const result = await approveSchoolRegistration(reg);

    await query('UPDATE school_registrations SET status = \'approved\', updated_at = NOW() WHERE id = $1', [reg.id]);

    await sendApprovalNotifications({
      nama_lembaga: reg.nama_lembaga,
      email: reg.email_kontak,
      whatsapp: reg.whatsapp,
    });

    return NextResponse.json({
      success: true,
      message: 'Pendaftaran telah disetujui',
      institutionId: result.institutionId,
    });
  } catch (error: any) {
    console.error('Approve school registration error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}