import {
  sendEmailNotification,
  sendWhatsAppNotification,
} from '@/lib/notifications';
import { getActiveTahunAjaran, getCurrentSemester, getWaliKelasForKelas } from '@/lib/wali-kelas';

/**
 * Status transitions that trigger a notification to the wali kelas.
 * `nilai_diubah_setelah_konfirmasi` is emitted by the aggregator when a grade
 * is edited after the wali kelas already confirmed the report.
 */
export type RaportStatusEvent =
  | 'draft'
  | 'dikirim_ke_wali_kelas'
  | 'dikonfirmasi'
  | 'difinalisasi'
  | 'siap_print'
  | 'nilai_diubah_setelah_konfirmasi';

export interface RaportNotificationParams {
  event: RaportStatusEvent;
  raportId: string;
  raport: {
    siswaNama: string;
    kelasNama: string;
    templateNama: string;
    periode: string;
  };
  kelasId: string;
  changedBy: string;
}

const EVENT_SUBJECT: Record<RaportStatusEvent, string> = {
  draft: 'Raport diperbarui',
  dikirim_ke_wali_kelas: 'Raport perlu dikonfirmasi',
  dikonfirmasi: 'Raport dikonfirmasi',
  difinalisasi: 'Raport finalized',
  siap_print: 'Raport siap dicetak',
  nilai_diubah_setelah_konfirmasi: 'Nilai raport diubah setelah konfirmasi',
};

const EVENT_MESSAGE: Record<RaportStatusEvent, string> = {
  draft: 'Raport untuk {siswa} telah diperbarui.',
  dikirim_ke_wali_kelas: 'Raport untuk {siswa} ({kelas}) telah dikirim dan menunggu konfirmasi Anda.',
  dikonfirmasi: 'Raport untuk {siswa} ({kelas}) telah dikonfirmasi.',
  difinalisasi: 'Raport untuk {siswa} ({kelas}) telah difinalisasi.',
  siap_print: 'Raport untuk {siswa} ({kelas}) siap untuk dicetak.',
  nilai_diubah_setelah_konfirmasi: 'Nilai raport ({kelas}) telah diubah oleh {changedBy} setelah Anda mengonfirmasi.',
};

/**
 * Notify the wali kelas of the class when a report status changes.
 * Failures are swallowed by the caller — a failed notification must never
 * block the status transition.
 */
export async function sendRaportNotification(params: RaportNotificationParams): Promise<void> {
  const { event, raport, kelasId, changedBy } = params;

  const tahunAjaran = await getActiveTahunAjaran();
  const semester = getCurrentSemester();

  const assignment = await getWaliKelasForKelas(kelasId, tahunAjaran?.nama ?? '', semester);
  const recipient = assignment?.guru;

  if (!recipient?.email && !recipient?.whatsapp) {
    return;
  }

  const variables = {
    siswa: raport.siswaNama || '-',
    kelas: raport.kelasNama || '-',
    template: raport.templateNama || '-',
    periode: raport.periode || '-',
    changedBy,
  };

  const subject = `${EVENT_SUBJECT[event]} — GuruPRO`;
  const message = EVENT_MESSAGE[event].replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = (variables as Record<string, string>)[key];
    return value ?? '';
  });

  const jobs: Promise<unknown>[] = [];

  if (recipient.email) {
    jobs.push(sendEmailNotification(recipient.email, subject, `<p>${message}</p>`));
  }
  if (recipient.whatsapp) {
    jobs.push(sendWhatsAppNotification(recipient.whatsapp, message));
  }

  const results = await Promise.allSettled(jobs);
  results.forEach(result => {
    if (result.status === 'rejected') {
      console.error('[RaportNotification] send failed:', result.reason);
    }
  });
}
