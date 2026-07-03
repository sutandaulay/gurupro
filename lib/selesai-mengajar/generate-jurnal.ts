/**
 * Generate Jurnal with AI
 * Part of Selesai Mengajar pipeline
 */

import { PrismaClient } from '@prisma/client';
import { generateAIContent } from '@/lib/ai/generators';
import type { SelesaiMengajarInput, JurnalResult } from './types';

const prisma = new PrismaClient();

interface JurnalContent {
  materi_pembelajaran: string;
  tujuan_pembelajaran: string[];
  aktivitas_pembelajaran: string;
  media_pembelajaran: string;
  asesmen_pembelajaran: string;
  refleksi_guru: string;
  tindak_lanjut: string;
}

export async function generateAndSaveJurnal(
  data: SelesaiMengajarInput,
  guruName: string
): Promise<JurnalResult> {
  // Get RPP if available
  let rppContent: string | null = null;
  if (data.rpp_id) {
    const rpp = await prisma.guru_administrasi.findFirst({
      where: {
        id: data.rpp_id,
        tipe_dokumen: 'rpp',
      },
    });
    if (rpp) {
      rppContent = JSON.stringify(rpp.konten);
    }
  }

  // Generate content with AI
  const prompt = `
Buatkan jurnal mengajar untuk guru ${guruName} dengan detail berikut:

📚 Mata Pelajaran: ${data.mapel_nama}
👨‍🎓 Kelas: ${data.kelas_nama}
📅 Tanggal: ${data.tanggal}
📝 Topik yang diajarkan: ${data.topik_diajarkan}
👥 Kehadiran: ${data.jumlah_hadir} hadir, ${data.jumlah_izin} izin, ${data.jumlah_sakit} sakit, ${data.jumlah_alpha} alpha
${data.catatan_tambahan ? `📋 Catatan Guru: ${data.catatan_tambahan}` : ''}
${rppContent ? `📄 Konten RPP:\n${rppContent.substring(0, 2000)}` : ''}

Generate JSON dengan format:
{
  "materi_pembelajaran": "Deskripsi materi yang diajarkan",
  "tujuan_pembelajaran": ["Tujuan 1", "Tujuan 2", "Tujuan 3"],
  "aktivitas_pembelajaran": "Deskripsi aktivitas pembelajaran yang dilakukan",
  "media_pembelajaran": "Media yang digunakan",
  "asesmen_pembelajaran": "Metode asesmen yang digunakan",
  "refleksi_guru": "Refleksi diri guru tentang pembelajaran hari ini",
  "tindak_lanjut": "Rencana tindak lanjut untuk pertemuan berikutnya"
}

Buat dalam Bahasa Indonesia yang formal dan sesuai standar administrasi guru.
`;

  const result = await generateAIContent<JurnalContent>(prompt, {
    materi_pembelajaran: data.topik_diajarkan,
    tujuan_pembelajaran: [],
    aktivitas_pembelajaran: '',
    media_pembelajaran: '',
    asesmen_pembelajaran: '',
    refleksi_guru: '',
    tindak_lanjut: '',
  });

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Gagal generate jurnal');
  }

  const jurnalContent = result.data;

  // Save to database
  const today = new Date(data.tanggal);
  today.setHours(0, 0, 0, 0);

  const jurnal = await prisma.teacher_journals.create({
    data: {
      teacher_id: data.guru_id,
      school_id: data.school_id || '',
      class_id: data.kelas_id,
      subject_id: data.mapel_id,
      tanggal: today,
      materi_pembelajaran: jurnalContent.materi_pembelajaran,
      tujuan_pembelajaran: jurnalContent.tujuan_pembelajaran.join('\n'),
      aktivitas_pembelajaran: jurnalContent.aktivitas_pembelajaran,
      media_pembelajaran: jurnalContent.media_pembelajaran,
      asesmen_pembelajaran: jurnalContent.asesmen_pembelajaran,
      refleksi_guru: jurnalContent.refleksi_guru,
      tindak_lanjut: jurnalContent.tindak_lanjut,
      status: 'Draft',
      auto_generated: true,
      source_schedule_id: data.schedule_id,
    },
  });

  return {
    id: jurnal.id,
    materi_pembelajaran: jurnalContent.materi_pembelajaran,
    refleksi: jurnalContent.refleksi_guru,
  };
}