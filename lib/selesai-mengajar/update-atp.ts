/**
 * Update Progress ATP
 * Part of Selesai Mengajar pipeline
 *
 * Note: ATP (Alur Tujuan Pembelajaran) model needs to be added to schema.prisma
 * This function will check if ATP exists and update progress, or return null if not found
 */

import { PrismaClient } from '@prisma/client';
import type { SelesaiMengajarInput, ATPResult } from './types';

const prisma = new PrismaClient();

export async function updateProgressATP(
  data: SelesaiMengajarInput
): Promise<ATPResult | null> {
  try {
    // Check if ATP exists for this mapel + kelas combination
    // For now, we'll use guru_administrasi table with tipe 'atp'
    const existingATP = await prisma.guru_administrasi.findFirst({
      where: {
        user_id: data.guru_id,
        tipe_dokumen: 'atp',
        // Filter by relevant kelas/mapel in konten if needed
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    if (!existingATP) {
      // No ATP found, skip this step
      console.log('No ATP found for update');
      return null;
    }

    // Parse ATP content to get progress
    const atpContent = existingATP.konten as any;
    const currentProgress = atpContent?.progress_minggu || 0;
    const totalMinggu = atpContent?.total_minggu || 16; // Default 16 weeks
    const newProgress = currentProgress + 1;

    // Update ATP progress
    const updatedATP = await prisma.guru_administrasi.update({
      where: { id: existingATP.id },
      data: {
        konten: {
          ...atpContent,
          progress_minggu: newProgress,
          last_topik: data.topik_diajarkan,
          last_updated: new Date().toISOString(),
        },
      },
    });

    return {
      updated: true,
      progress_minggu: newProgress,
      total_minggu: totalMinggu,
    };
  } catch (error: any) {
    console.error('Error updating ATP:', error);
    // Don't throw - this is non-critical
    return null;
  }
}