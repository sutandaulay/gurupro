/**
 * API Route: Backfill Wali Kelas Assignments
 * Purpose: One-time migration to populate wali_kelas_assignments from existing kelas.wali_kelas text field
 * Note: This endpoint should be secured and only accessible to admins
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { backfillWaliKelasAssignments } from '@/lib/wali-kelas';

// GET /api/wali-kelas/backfill?tahun_ajaran=2025/2026&semester=ganjil
// Note: This should only be called once during migration
export async function GET(req: Request) {
  try {
    // Check for admin API key or session
    const authHeader = req.headers.get('authorization');
    const apiKey = process.env.WALI_KELAS_BACKFILL_API_KEY;

    // Allow if API key is provided or if it's a system call
    if (apiKey && authHeader !== `Bearer ${apiKey}`) {
      // Also allow if user is logged in (for manual triggering)
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get('gurupro_session')?.value;
      if (!sessionCookie) {
        return NextResponse.json(
          { error: 'Unauthorized. Provide valid API key or be logged in.' },
          { status: 401 }
        );
      }
    }

    const { searchParams } = new URL(req.url);
    const tahunAjaran = searchParams.get('tahun_ajaran');
    const semester = searchParams.get('semester');

    if (!tahunAjaran || !semester) {
      return NextResponse.json(
        { error: 'tahun_ajaran dan semester wajib diisi. Contoh: ?tahun_ajaran=2025/2026&semester=ganjil' },
        { status: 400 }
      );
    }

    if (!['ganjil', 'genap'].includes(semester)) {
      return NextResponse.json(
        { error: 'Semester harus ganjil atau genap' },
        { status: 400 }
      );
    }

    if (!/^\d{4}\/\d{4}$/.test(tahunAjaran)) {
      return NextResponse.json(
        { error: 'Format tahun ajaran harus YYYY/YYYY, contoh: 2025/2026' },
        { status: 400 }
      );
    }

    console.log(`Starting backfill for ${tahunAjaran} ${semester}...`);

    const result = await backfillWaliKelasAssignments(tahunAjaran, semester as 'ganjil' | 'genap');

    console.log('Backfill complete:', result);

    return NextResponse.json({
      message: 'Backfill selesai',
      summary: {
        berhasil: result.berhasil,
        tidakMatch: result.tidakMatch.length,
        errors: result.errors.length,
      },
      detail: result,
    });
  } catch (error: any) {
    console.error('Backfill error:', error);
    return NextResponse.json(
      { error: error.message || 'Backfill failed' },
      { status: 500 }
    );
  }
}
