/**
 * Generate Jurnal with AI
 * Part of Selesai Mengajar pipeline
 */

import { PrismaClient } from '@prisma/client';
import { generateAIContent } from '@/lib/ai/generators';
import type { SelesaiMengajarInput, JurnalResult } from './types';
import { uploadToR2 } from '@/lib/r2';
import { generatePdfBuffer, generateDocBuffer } from '@/lib/doc-compiler';
import { parseLocalDate } from '@/lib/utils';

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

  // Fallback bila AI gagal — tetap simpan jurnal agar laporan mengajar muncul
  let jurnalContent: JurnalContent;
  if (result.success && result.data) {
    const raw = result.data as any;
    jurnalContent = {
      materi_pembelajaran: typeof raw?.materi_pembelajaran === 'string' ? raw.materi_pembelajaran : (data.topik_diajarkan || 'Materi tidak tersedia'),
      tujuan_pembelajaran: Array.isArray(raw?.tujuan_pembelajaran) ? raw.tujuan_pembelajaran : [],
      aktivitas_pembelajaran: typeof raw?.aktivitas_pembelajaran === 'string' ? raw.aktivitas_pembelajaran : '-',
      media_pembelajaran: typeof raw?.media_pembelajaran === 'string' ? raw.media_pembelajaran : '-',
      asesmen_pembelajaran: typeof raw?.asesmen_pembelajaran === 'string' ? raw.asesmen_pembelajaran : '-',
      refleksi_guru: typeof raw?.refleksi_guru === 'string' ? raw.refleksi_guru : '-',
      tindak_lanjut: typeof raw?.tindak_lanjut === 'string' ? raw.tindak_lanjut : '-',
    };
  } else {
    console.error('Jurnal AI generation failed, using fallback:', result.error);
    jurnalContent = {
      materi_pembelajaran: data.topik_diajarkan || 'Materi tidak tersedia',
      tujuan_pembelajaran: [],
      aktivitas_pembelajaran: '-',
      media_pembelajaran: '-',
      asesmen_pembelajaran: '-',
      refleksi_guru: '-',
      tindak_lanjut: '-',
    };
  }

  let pdfUrl: string | null = null;
  let docxUrl: string | null = null;

  try {
    // Resolve school name
    let schoolName = "-";
    if (data.school_id) {
      const school = await prisma.schools.findUnique({
        where: { id: data.school_id }
      });
      if (school) schoolName = school.nama_sekolah;
    }

    const markdown = `
# JURNAL HARIAN MENGAJAR GURU

## IDENTITAS KBM
- **Nama Guru**: ${guruName || "-"}
- **Sekolah**: ${schoolName || "-"}
- **Mata Pelajaran**: ${data.mapel_nama || "-"}
- **Kelas**: Kelas ${data.kelas_nama || "-"}
- **Tanggal**: ${data.tanggal || "-"}

## DETAIL PEMBELAJARAN
### 1. Materi Pembelajaran
${jurnalContent.materi_pembelajaran}

### 2. Tujuan Pembelajaran
${jurnalContent.tujuan_pembelajaran.join('\n')}

### 3. Aktivitas Pembelajaran
${jurnalContent.aktivitas_pembelajaran}

### 4. Media Pembelajaran
${jurnalContent.media_pembelajaran || "-"}

### 5. Asesmen Pembelajaran
${jurnalContent.asesmen_pembelajaran || "-"}

### 6. Refleksi Guru
${jurnalContent.refleksi_guru || "-"}

### 7. Rencana Tindak Lanjut
${jurnalContent.tindak_lanjut || "-"}

## REKAP KEHADIRAN SISWA
- **Hadir**: ${data.jumlah_hadir || 0} siswa
- **Izin**: ${data.jumlah_izin || 0} siswa
- **Sakit**: ${data.jumlah_sakit || 0} siswa
- **Alpha**: ${data.jumlah_alpha || 0} siswa
`;

    const title = `Jurnal Mengajar - ${data.mapel_nama} Kelas ${data.kelas_nama}`;
    
    // Generate PDF
    const pdfBuf = await generatePdfBuffer(markdown, title);
    pdfUrl = await uploadToR2(pdfBuf, `${Date.now()}-Jurnal.pdf`, "application/pdf");

    // Generate DOC
    const docBuf = generateDocBuffer(markdown, title);
    docxUrl = await uploadToR2(docBuf, `${Date.now()}-Jurnal.doc`, "application/msword");
  } catch (err) {
    console.error("Failed to compile or upload journal files to R2:", err);
  }

  // Save to database
  const today = parseLocalDate(data.tanggal);

  // Resolve school_id — wajib UUID di tabel teacher_journals
  let resolvedSchoolId: string | null = data.school_id || null;
  if (!resolvedSchoolId) {
    const school = await prisma.schools.findFirst({
      where: { user_id: data.guru_id },
      select: { id: true },
    });
    resolvedSchoolId = school?.id || null;
  }

  const jurnal = await prisma.teacher_journals.create({
    data: {
      user_id: data.guru_id,
      school_id: resolvedSchoolId || '',
      class_id: data.kelas_id,
      subject_id: data.mapel_id,
      tanggal: today,
      kelas: data.kelas_nama || '',
      mapel: data.mapel_nama || '',
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
      custom_values: {
        pdf_url: pdfUrl,
        docx_url: docxUrl
      }
    },
  });

  return {
    id: jurnal.id,
    materi_pembelajaran: jurnalContent.materi_pembelajaran,
    refleksi: jurnalContent.refleksi_guru,
    ai_generated: result.success && !!result.data,
  };
}