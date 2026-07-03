import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET() {
  try {
    const result = await query(
      `SELECT id, kode, nama, deskripsi, komponen, bobot_persen, min_evidence, is_active
       FROM indikator_kinerja_config
       WHERE is_active = true
       ORDER BY kode`
    )
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error('GET /api/indikator-kinerja error:', err)
    return NextResponse.json({ error: 'Failed to fetch indikator' }, { status: 500 })
  }
}
