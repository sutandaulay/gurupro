/**
 * Raport-specific notification system.
 * Extends the existing notification infrastructure (lib/notifications.ts)
 * to support raport lifecycle events.
 */

import { query, getUserById, UserRecord } from '@/lib/db';
import { getWaliKelasForKelas, getActiveTahunAjaran, getCurrentSemester } from '@/lib/wali-kelas';
import { sendEmailNotification, sendWhatsAppNotification } from '@/lib/notifications';

export type RaportStatusEvent =
  | 'draft'
  | 'dikirim_ke_wali_kelas'
  | 'dikonfirmasi'
  | 'difinalisasi'
  | 'siap_print'
  | 'nilai_diubah_setelah_konfirmasi';

interface RaportInfo {
  siswaNama: string;
  kelasNama: string;
  templateNama: string;
  periode: string;
}

interface SendRaportNotificationParams {
  event: RaportStatusEvent;
  raportId: string;
  raport: RaportInfo;
  kelasId: string;
  changedBy: string;
}

interface RaportNotificationTemplate {
  emailSubject: string;
  emailBody: string;
  waMessage: string;
}

const NOTIFICATION_TEMPLATES: Record<RaportStatusEvent, RaportNotificationTemplate> = {
  draft: {
    emailSubject: 'Raport Dikembalikan ke Draft',
    emailBody: `<div style="font-family: sans-serif; padding: 20px;">
<h2 style="color: #6b7280;">Raport Dikembalikan ke Draft</h2>
<p>Yth. {$penerimaNama},</p>
<p>Raport untuk siswa <strong>{$siswaNama}</strong> ({$kelasNama}) periode <strong>{$periode}</strong> telah dikembalikan ke status <em>draft</em>.</p>
<p>Silakan periksa dan lakukan perbaikan yang diperlukan.</p>
<p><em>Dokumen ini dibuat secara otomatis oleh sistem.</em></p>
</div>`,
    waMessage: 'ℹ️ *Raport Dikembalikan ke Draft*\n\nYth. {$penerimaNama},\n\nRaport siswa {$siswaNama} ({$kelasNama}) periode {$periode} telah dikembalikan ke status *draft*.\n\nMohon进行检查 dan perbaikan yang diperlukan.',
  },
  dikirim_ke_wali_kelas: {
    emailSubject: 'Raport Baru Menunggu Review',
    emailBody: `<div style="font-family: sans-serif; padding: 20px;">
<h2 style="color: #3b82f6;">Raport Baru Menunggu Review</h2>
<p>Yth. {$penerimaNama},</p>
<p>Raport untuk siswa <strong>{$siswaNama}</strong> ({$kelasNama}) periode <strong>{$periode}</strong> telah dikirim dan menunggu review Anda.</p>
<p>Silakan login untuk memeriksa dan mengkonfirmasi raport.</p>
<p><em>Dokumen ini dibuat secara otomatis oleh sistem.</em></p>
</div>`,
    waMessage: '📋 *Raport Baru Menunggu Review*\n\nYth. {$penerimaNama},\n\nRaport siswa {$siswaNama} ({$kelasNama}) periode {$periode} telah dikirim dan menunggu review Anda.\n\nSilakan login untuk memeriksa dan mengkonfirmasi raport.',
  },
  dikonfirmasi: {
    emailSubject: 'Raport Dikonfirmasi',
    emailBody: `<div style="font-family: sans-serif; padding: 20px;">
<h2 style="color: #10b981;">Raport Dikonfirmasi</h2>
<p>Yth. {$penerimaNama},</p>
<p>Raport untuk siswa <strong>{$siswaNama}</strong> ({$kelasNama}) periode <strong>{$periode}</strong> telah dikonfirmasi oleh Wali Kelas.</p>
<p>Raport siap untuk proses finalisasi.</p>
<p><em>Dokumen ini dibuat secara otomatis oleh sistem.</em></p>
</div>`,
    waMessage: '✅ *Raport Dikonfirmasi*\n\nYth. {$penerimaNama},\n\nRaport siswa {$siswaNama} ({$kelasNama}) periode {$periode} telah dikonfirmasi oleh Wali Kelas.\n\nRaport siap untuk proses finalisasi.',
  },
  difinalisasi: {
    emailSubject: 'Raport Difinalisasi - Siap Cetak',
    emailBody: `<div style="font-family: sans-serif; padding: 20px;">
<h2 style="color: #10b981;">Raport Difinalisasi</h2>
<p>Yth. {$penerimaNama},</p>
<p>Raport untuk siswa <strong>{$siswaNama}</strong> ({$kelasNama}) periode <strong>{$periode}</strong> telahifinalisasi.</p>
<p>Silakan print raport untuk distribusi.</p>
<p><em>Dokumen ini dibuat secara otomatis oleh sistem.</em></p>
</div>`,
    waMessage: '🎉 *Raport Difinalisasi*\n\nYth. {$penerimaNama},\n\nRaport siswa {$siswaNama} ({$kelasNama}) periode {$periode} telah *difinalisasi*.\n\nRaport siap untuk diprint dan dibagikan!',
  },
  siap_print: {
    emailSubject: 'Raport Siap Cetak',
    emailBody: `<div style="font-family: sans-serif; padding: 20px;">
<h2 style="color: #059669;">Raport Siap Cetak</h2>
<p>Yth. {$penerimaNama},</p>
<p>Raport untuk siswa <strong>{$siswaNama}</strong> ({$kelasNama}) periode <strong>{$periode}</strong> telah siap untuk dicetak.</p>
<p><em>Dokumen ini dibuat secara otomatis oleh sistem.</em></p>
</div>`,
    waMessage: '🖨️ *Raport Siap Cetak*\n\nYth. {$penerimaNama},\n\nRaport siswa {$siswaNama} ({$kelasNama}) periode {$periode} telah siap untuk dicetak!',
  },
  nilai_diubah_setelah_konfirmasi: {
    emailSubject: 'Perubahan Nilai pada Raport Terkunci',
    emailBody: `<div style="font-family: sans-serif; padding: 20px;">
<h2 style="color: #f59e0b;">⚠️ Peringatan: Nilai Berubah Setelah Konfirmasi</h2>
<p>Yth. {$penerimaNama},</p>
<p>Kami informasikan bahwa terdapat perubahan nilai pada raport siswa <strong>{$siswaNama}</strong> ({$kelasNama}) periode <strong>{$periode}</strong>.</p>
<p>Perubahan ini terjadi setelah raport dikonfirmasi/difinalisasi.</p>
<p>Silakan periksa dan putuskan apakah perlu ada peninjauan ulang status raport.</p>
<p><em>Dokumen ini dibuat secara otomatis oleh sistem.</em></p>
</div>`,
    waMessage: '⚠️ *Peringatan: Nilai Berubah Setelah Konfirmasi*\n\nYth. {$penerimaNama},\n\nTerdapat perubahan nilai pada raport siswa {$siswaNama} ({$kelasNama}) periode {$periode}.\n\nPerubahan terjadi setelah raport dikonfirmasi/difinalisasi.\n\nMohon进行检查 dan putuskan apakah perlu peninjauan ulang status raport.',
  },
};

function interpolate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

/**
 * Send in-app notification to a user
 */
async function sendInAppNotification(
  userId: string,
  title: string,
  body: string,
  referenceType: string,
  referenceId: string,
  type: 'info' | 'warning' | 'success' = 'info'
): Promise<void> {
  try {
    await query(
      `INSERT INTO in_app_notifications (user_id, title, body, type, reference_type, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, title, body, type, referenceType, referenceId]
    );
  } catch (err) {
    console.error('Failed to send in-app notification:', err);
  }
}

/**
 * Main function to send raport notifications.
 * Determines recipients based on event type and sends via appropriate channels.
 */
export async function sendRaportNotification(
  params: SendRaportNotificationParams
): Promise<void> {
  const { event, raportId, raport, kelasId, changedBy } = params;

  // Get active tahun ajaran and semester
  let tahunAjaran = '';
  let semester: 'ganjil' | 'genap' = 'ganjil';

  try {
    const ta = await getActiveTahunAjaran();
    if (ta) {
      tahunAjaran = ta.nama;
      semester = getCurrentSemester();
    }
  } catch {
    // Continue without tahun ajaran
  }

  // Determine recipients based on event type
  let recipients: { userId: string; nama: string; email?: string; whatsapp?: string }[] = [];

  switch (event) {
    case 'dikirim_ke_wali_kelas':
      // Notify wali kelas
      if (tahunAjaran) {
        const waliKelas = await getWaliKelasForKelas(kelasId, tahunAjaran, semester);
        if (waliKelas?.guru) {
          recipients.push({
            userId: waliKelas.waliKelasMemberId,
            nama: waliKelas.guru.nama,
            email: waliKelas.guru.email,
            whatsapp: waliKelas.guru.whatsapp,
          });
        }
      }
      break;

    case 'dikonfirmasi':
    case 'difinalisasi':
      // Notify guru mapel who have nilai in this raport
      const guruMapelRes = await query(
        `SELECT DISTINCT im.app_user_id as member_id, u.nama_lengkap, u.email, u.whatsapp
         FROM data_raport_nilai_mapel nm
          JOIN public.institution_members im ON nm.guru_mapel_member_id::text = im.app_user_id
         JOIN users u ON u.id::text = im.app_user_id
         WHERE nm.data_raport_id = $1`,
        [raportId]
      );
      for (const row of guruMapelRes.rows) {
        recipients.push({
          userId: row.member_id,
          nama: row.nama_lengkap,
          email: row.email,
          whatsapp: row.whatsapp,
        });
      }
      break;

    case 'nilai_diubah_setelah_konfirmasi':
      // Notify wali kelas
      if (tahunAjaran) {
        const waliKelas = await getWaliKelasForKelas(kelasId, tahunAjaran, semester);
        if (waliKelas?.guru) {
          recipients.push({
            userId: waliKelas.waliKelasMemberId,
            nama: waliKelas.guru.nama,
            email: waliKelas.guru.email,
            whatsapp: waliKelas.guru.whatsapp,
          });
        }
      }
      break;

    case 'siap_print':
      // Notify wali kelas and guru mapel
      if (tahunAjaran) {
        const waliKelas = await getWaliKelasForKelas(kelasId, tahunAjaran, semester);
        if (waliKelas?.guru) {
          recipients.push({
            userId: waliKelas.waliKelasMemberId,
            nama: waliKelas.guru.nama,
            email: waliKelas.guru.email,
            whatsapp: waliKelas.guru.whatsapp,
          });
        }
      }
      const allGuruRes = await query(
        `SELECT DISTINCT im.app_user_id as member_id, u.nama_lengkap, u.email, u.whatsapp
         FROM data_raport_nilai_mapel nm
          JOIN public.institution_members im ON nm.guru_mapel_member_id::text = im.app_user_id
         JOIN users u ON u.id::text = im.app_user_id
         WHERE nm.data_raport_id = $1`,
        [raportId]
      );
      for (const row of allGuruRes.rows) {
        if (!recipients.find(r => r.userId === row.member_id)) {
          recipients.push({
            userId: row.member_id,
            nama: row.nama_lengkap,
            email: row.email,
            whatsapp: row.whatsapp,
          });
        }
      }
      break;

    default:
      // For draft and other transitions, notify the person who changed it
      if (changedBy && changedBy !== 'system') {
        const user = await getUserById(changedBy);
        if (user) {
          recipients.push({
            userId: user.id,
            nama: user.nama_lengkap,
            email: user.email,
            whatsapp: user.whatsapp,
          });
        }
      }
  }

  const template = NOTIFICATION_TEMPLATES[event];
  if (!template) {
    console.warn(`No notification template for event: ${event}`);
    return;
  }

  // Deduplicate recipients
  const uniqueRecipients = recipients.filter(
    (r, idx, arr) => arr.findIndex(x => x.userId === r.userId) === idx
  );

  // Send notifications to each recipient
  for (const recipient of uniqueRecipients) {
    const vars: Record<string, string> = {
      '$penerimaNama': recipient.nama,
      '$siswaNama': raport.siswaNama || '-',
      '$kelasNama': raport.kelasNama || '-',
      '$periode': raport.periode || '-',
    };

    const emailSubject = interpolate(template.emailSubject, vars);
    const emailBody = interpolate(template.emailBody, vars);
    const waMessage = interpolate(template.waMessage, vars);

    // Send in-app notification
    await sendInAppNotification(
      recipient.userId,
      emailSubject,
      emailBody.replace(/<[^>]*>/g, ' ').substring(0, 200),
      'raport',
      raportId,
      event === 'nilai_diubah_setelah_konfirmasi' ? 'warning' : 'success'
    );

    // Send email if enabled
    if (recipient.email) {
      await sendEmailNotification(recipient.email, emailSubject, emailBody);
    }

    // Send WhatsApp if enabled
    if (recipient.whatsapp) {
      await sendWhatsAppNotification(recipient.whatsapp, waMessage);
    }
  }
}

/**
 * Get notification history for a raport
 */
export async function getRaportNotificationHistory(
  raportId: string
): Promise<Array<{
  id: string;
  userId: string;
  userName: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: Date;
}>> {
  const res = await query(
    `SELECT n.id, n.user_id, n.title, n.body, n.type, n.is_read, n.created_at,
            u.nama_lengkap as user_name
     FROM in_app_notifications n
     JOIN users u ON u.id = n.user_id
     WHERE n.reference_type = 'raport' AND n.reference_id = $1
     ORDER BY n.created_at DESC
     LIMIT 50`,
    [raportId]
  );

  return res.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    title: row.title,
    body: row.body,
    type: row.type,
    isRead: row.is_read,
    createdAt: row.created_at,
  }));
}
