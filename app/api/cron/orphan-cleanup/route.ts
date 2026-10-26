import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { listR2Objects, deleteFromR2 } from '@/lib/r2'

export async function GET(req: Request) {
  // Auth: Bearer token
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get all r2_keys from DB
    const dbFiles = await query('SELECT r2_key FROM user_files')
    const dbKeys = new Set(dbFiles.rows.map((r: any) => r.r2_key))

    // List all objects in R2
    const r2Objects = await listR2Objects()

    // Find orphans (objects in R2 but not in DB)
    const orphans = r2Objects.filter(obj => !dbKeys.has(obj.Key))

    // Delete orphans
    let deleted = 0
    for (const orphan of orphans) {
      try {
        await deleteFromR2(orphan.Key)
        deleted++
      } catch (e) {
        console.error(`Failed to delete orphan ${orphan.Key}:`, e)
      }
    }

    return NextResponse.json({
      total_in_r2: r2Objects.length,
      total_in_db: dbKeys.size,
      orphans_found: orphans.length,
      orphans_deleted: deleted,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Orphan cleanup error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
