/**
 * Update Lesson Memory
 * Part of Selesai Mengajar pipeline
 */

import { PrismaClient } from '@prisma/client';
import type { SelesaiMengajarInput, MemoryResult } from './types';
import { parseLocalDate } from '@/lib/utils';

const prisma = new PrismaClient();

export async function updateLessonMemory(
  data: SelesaiMengajarInput
): Promise<MemoryResult | null> {
  try {
    const today = parseLocalDate(data.tanggal);

    // Upsert lesson memory for this guru + schedule combination
    const memory = await prisma.lesson_memories.upsert({
      where: {
        id: `${data.guru_id}-${data.schedule_id || data.kelas_id}`,
      },
      update: {
        last_topic: data.mapel_nama,
        last_subtopic: data.topik_diajarkan.substring(0, 255),
        last_page_number: 0, // Could be calculated from RPP
        last_date: today,
        updated_at: new Date(),
      },
      create: {
        id: `${data.guru_id}-${data.schedule_id || data.kelas_id}`,
        user_id: data.guru_id,
        schedule_id: data.schedule_id || data.kelas_id,
        last_topic: data.mapel_nama,
        last_subtopic: data.topik_diajarkan.substring(0, 255),
        last_date: today,
      },
    });

    return {
      updated: true,
      last_topic: memory.last_topic || '',
    };
  } catch (error: any) {
    console.error('Error updating lesson memory:', error);
    return null;
  }
}