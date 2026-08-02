/**
 * Generate Next Materi Suggestion
 * Part of Selesai Mengajar pipeline
 */

import { PrismaClient } from '@prisma/client';
import { generateAIContent } from '@/lib/ai/generators';
import type { SelesaiMengajarInput, NextMateriResult } from './types';

const prisma = new PrismaClient();

interface NextMateriContent {
  topik_berikutnya: string;
  sub_materi: string[];
  perlu_remedial: boolean;
  catatan_persiapan: string;
}

export async function generateNextMateri(
  data: SelesaiMengajarInput
): Promise<NextMateriResult | null> {
  try {
    // Get ATP if exists
    let atpContent: any = null;
    const existingATP = await prisma.guru_administrasi.findFirst({
      where: {
        user_id: data.guru_id,
        tipe_dokumen: 'atp',
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    if (existingATP) {
      atpContent = existingATP.konten;
    }

    // Get RPP if exists (for next topic hint)
    let nextTopicHint = '';
    if (data.rpp_id) {
      const rpp = await prisma.guru_administrasi.findFirst({
        where: { id: data.rpp_id, tipe_dokumen: 'rpp' },
      });
      if (rpp) {
        const rppData = rpp.konten as any;
        nextTopicHint = rppData?.topik_berikutnya || rppData?.materi_berikutnya || '';
      }
    }

    const prompt = `
Berdasarkan informasi berikut, berikan saran untuk pertemuan berikutnya:

📚 Mata Pelajaran: ${data.mapel_nama}
👨‍🎓 Kelas: ${data.kelas_nama}
✅ Topik yang baru saja diajarkan: ${data.topik_diajarkan}
${data.catatan_tambahan ? `📋 Catatan Guru: ${data.catatan_tambahan}` : ''}
${atpContent ? `📄 ATP Content:\n${JSON.stringify(atpContent)?.substring(0, 1000)}` : ''}
${nextTopicHint ? `📌 Saran dari RPP: ${nextTopicHint}` : ''}

Generate JSON dengan format:
{
  "topik_berikutnya": "Nama topik yang harus diajarkan di pertemuan berikutnya",
  "sub_materi": ["Sub materi 1 yang perlu disiapkan", "Sub materi 2", "Sub materi 3"],
  "perlu_remedial": true/false - apakah perlu remedial berdasarkan catatan guru,
  "catatan_persiapan": "Catatan penting untuk persiapan mengajar berikutnya"
}

Berikan saran yang praktis dan langsung bisa digunakan.
`;

    const result = await generateAIContent<NextMateriContent>(prompt, {
      topik_berikutnya: 'Lanjutkan topik berikutnya',
      sub_materi: [],
      perlu_remedial: false,
      catatan_persiapan: '',
    });

    if (!result.success || !result.data) {
      console.error('Failed to generate next materi:', result.error);
      return null;
    }

    return {
      topik_berikutnya: result.data.topik_berikutnya,
      sub_materi: result.data.sub_materi.join(', '),
      perlu_remedial: result.data.perlu_remedial,
      catatan_persiapan: result.data.catatan_persiapan,
      ai_generated: result.success,
    };
  } catch (error: any) {
    console.error('Error generating next materi:', error);
    return null;
  }
}