import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { query } from '@/lib/db'

// =====================================================
// Wakasek Dashboard API
// - Raport review (lapis 2: dikonfirmasi → difinalisasi)
// - Input observasi kelas
// - Riwayat observasi
// =====================================================

// GET — data dashboard wakasek
export async function GET(
  req: Request,
  context: { params: Promise<{ institutionId: string }> }
) {
  try {
    const session = await requireSession()
    const { institutionId } = await context.params
    const instId = parseInt(institutionId, 10)
    if (isNaN(instId)) {
      return NextResponse.json({ error: 'Invalid institutionId' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const view = searchParams.get('view') || 'raport'

    // RBAC
    const memberRes = await query(
      `SELECT imr.value AS role
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'
         AND imr.value IN ('wakasek','kepala_sekolah','operator','admin_sekolah')`,
      [session.id, instId]
    )
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (view === 'raport') {
      return NextResponse.json(await getRaportData(instId))
    }
    if (view === 'observasi') {
      const guruId = searchParams.get('guruId') || undefined
      return NextResponse.json(await getObservasiData(instId, guruId))
    }
    return NextResponse.json({ error: 'Unknown view' }, { status: 400 })
  } catch (err) {
    console.error('GET /api/institution/wakasek error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

async function getRaportData(instId: number) {
  // Raport yang perlu di-review wakasek: dikirim_ke_wali_kelas
  const pendingRes = await query(
    `SELECT dr.id, dr.kelas_id, dr.siswa_id, dr.periode, dr.updated_at,
            c.nama_kelas, s.nama_lengkap AS siswa_nama
     FROM data_raport dr
     JOIN classes c ON c.id = dr.kelas_id
     JOIN institutions i ON i.school_id = c.school_id
     LEFT JOIN students s ON s.id = dr.siswa_id
     WHERE i.id = $1 AND dr.status = 'dikirim_ke_wali_kelas'
     ORDER BY dr.updated_at DESC
     LIMIT 50`,
    [instId]
  )

  // Raport sudah difinalisasi
  const finalizedRes = await query(
    `SELECT dr.id, dr.kelas_id, dr.siswa_id, dr.periode, dr.updated_at,
            c.nama_kelas, s.nama_lengkap AS siswa_nama
     FROM data_raport dr
     JOIN classes c ON c.id = dr.kelas_id
     JOIN institutions i ON i.school_id = c.school_id
     LEFT JOIN students s ON s.id = dr.siswa_id
     WHERE i.id = $1 AND dr.status = 'difinalisasi'
     ORDER BY dr.updated_at DESC
     LIMIT 20`,
    [instId]
  )

  const statsRes = await query(
    `SELECT dr.status, COUNT(*)::int AS jumlah
     FROM data_raport dr
     JOIN classes c ON c.id = dr.kelas_id
     JOIN institutions i ON i.school_id = c.school_id
     WHERE i.id = $1
     GROUP BY dr.status`,
    [instId]
  )
  const stats: Record<string, number> = {}
  for (const row of statsRes.rows) {
    stats[row.status] = Number(row.jumlah)
  }

  return {
    pending: pendingRes.rows,
    finalized: finalizedRes.rows,
    stats,
    totalPending: pendingRes.rows.length,
  }
}

async function getObservasiData(instId: number, guruId?: string) {
  // Guru di institusi
  const guruRes = await query(
    `SELECT im.app_user_id AS guru_id, u.nama_lengkap AS nama
     FROM public.institution_members im
     JOIN public.institution_members_role imr ON imr.parent_id = im.id
     LEFT JOIN users u ON u.id::text = im.app_user_id
     WHERE im.institution_id = $1 AND im.status = 'active' AND imr.value = 'guru'
     ORDER BY u.nama_lengkap`,
    [instId]
  )

  // Observasi terbaru
  let obsWhere = 'go.institution_id = $1'
  const obsParams: any[] = [instId]
  if (guruId) {
    obsWhere += ' AND go.guru_id = $2'
    obsParams.push(guruId)
  }
  const obsRes = await query(
    `SELECT go.id, go.guru_id, go.guru_nama, go.tanggal, go.skor, go.aspek, go.catatan, go.status, go.observer
     FROM guru_observasi go
     WHERE ${obsWhere}
     ORDER BY go.tanggal DESC, go.created_at DESC
     LIMIT 50`,
    obsParams
  )

  // Rata-rata skor per guru
  const avgRes = await query(
    `SELECT go.guru_id, go.guru_nama,
            AVG(go.skor)::numeric(5,2) AS rata_skor,
            COUNT(*)::int AS jumlah_observasi
     FROM guru_observasi go
     WHERE go.institution_id = $1 AND go.skor IS NOT NULL
     GROUP BY go.guru_id, go.guru_nama
     ORDER BY AVG(go.skor) DESC`,
    [instId]
  )

  return {
    guru: guruRes.rows,
    observasi: obsRes.rows,
    avgPerGuru: avgRes.rows,
  }
}

// POST — approve/finalize raport / buat observasi
export async function POST(
  req: Request,
  context: { params: Promise<{ institutionId: string }> }
) {
  try {
    const session = await requireSession()
    const { institutionId } = await context.params
    const instId = parseInt(institutionId, 10)
    if (isNaN(instId)) {
      return NextResponse.json({ error: 'Invalid institutionId' }, { status: 400 })
    }

    // RBAC
    const memberRes = await query(
      `SELECT imr.value AS role
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'
         AND imr.value IN ('wakasek','kepala_sekolah','operator','admin_sekolah')`,
      [session.id, instId]
    )
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { action } = body

    if (action === 'approve_raport') {
      const { raportId } = body
      if (!raportId) return NextResponse.json({ error: 'raportId wajib' }, { status: 400 })

      const result = await query(
        `UPDATE data_raport SET status = 'difinalisasi', updated_at = NOW()
         WHERE id = $1
         RETURNING id, status`,
        [raportId]
      )
      return NextResponse.json(result.rows[0] || { error: 'Not found' }, { status: 200 })
    }

    if (action === 'reject_raport') {
      const { raportId, catatan } = body
      if (!raportId) return NextResponse.json({ error: 'raportId wajib' }, { status: 400 })

      const result = await query(
        `UPDATE data_raport SET status = 'draft', updated_at = NOW()
         WHERE id = $1
         RETURNING id, status`,
        [raportId]
      )
      return NextResponse.json(result.rows[0] || { error: 'Not found' }, { status: 200 })
    }

    if (action === 'observasi') {
      const { guruId, guruNama, tanggal, skor, aspek, catatan } = body
      if (!guruId || !tanggal) {
        return NextResponse.json({ error: 'guruId dan tanggal wajib' }, { status: 400 })
      }

      // Get observer nama
      const obsNama = await query(`SELECT nama_lengkap FROM users WHERE id = $1`, [session.id])
      const observerNama = obsNama.rows[0]?.nama_lengkap || 'Wakasek'

      // Get guru nama
      let finalGuruNama = guruNama || 'Guru'
      const guruRes = await query(`SELECT nama_lengkap FROM users WHERE id::text = $1`, [guruId])
      if (guruRes.rows.length > 0) {
        finalGuruNama = guruRes.rows[0].nama_lengkap || guruNama || 'Guru'
      }

      const result = await query(
        `INSERT INTO guru_observasi
           (institution_id, guru_id, guru_nama, observer_id, observer, tanggal, skor, aspek, catatan, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'done')
         RETURNING *`,
        [instId, guruId, finalGuruNama, session.id, observerNama, tanggal, skor || null, aspek || 'kelas', catatan || null]
      )
      return NextResponse.json(result.rows[0], { status: 201 })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/institution/wakasek error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
