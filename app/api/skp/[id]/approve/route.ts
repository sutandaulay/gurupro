import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const sessionCookie = req.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('gurupro_session='))

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionData = JSON.parse(decodeURIComponent(sessionCookie.split('=')[1]))

    // Verifikasi peran jika SKP dikaitkan dengan sekolah yang terhubung ke institusi
    const skpRes = await query("SELECT sekolah_id FROM skp_tahunan WHERE id = $1", [id])
    if (skpRes.rows.length === 0) {
      return NextResponse.json({ error: 'SKP tidak ditemukan' }, { status: 404 })
    }
    const { sekolah_id } = skpRes.rows[0]

    if (sekolah_id) {
      const schoolRes = await query("SELECT npsn FROM schools WHERE id = $1", [sekolah_id])
      if (schoolRes.rows.length > 0 && schoolRes.rows[0].npsn) {
        const npsn = schoolRes.rows[0].npsn
        const instRes = await query("SELECT id FROM public.institutions WHERE npsn = $1", [npsn])
        if (instRes.rows.length > 0) {
          const instId = instRes.rows[0].id
          // Cari peran pengguna pada institusi ini
          const roleRes = await query(
            `SELECT imr.value FROM public.institution_members im
             JOIN public.institution_members_role imr ON imr.parent_id = im.id
             WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'`,
            [sessionData.id, instId]
          )
          const roles = roleRes.rows.map((r: any) => r.value)

          // approval_layer_config hanya ada di payload.institutions — fallback aman ke 'single'
          let layer = 'single'
          try {
            const configRes = await query(
              `SELECT approval_layer_config FROM payload.institutions WHERE npsn = $1`,
              [npsn]
            )
            layer = configRes.rows[0]?.approval_layer_config || 'single'
          } catch {
            layer = 'single'
          }

          let hasApprovalPermission = false
          if (roles.includes('kepala_sekolah')) {
            hasApprovalPermission = true
          } else if (roles.includes('wakasek')) {
            hasApprovalPermission = layer === 'double'
          }
          
          if (!hasApprovalPermission) {
            return NextResponse.json(
              { error: 'Forbidden: Anda tidak memiliki wewenang untuk menyetujui dokumen ini' },
              { status: 403 }
            )
          }
        }
      }
    }

    const body = await req.json()
    const { catatanKepsek } = body

    const result = await query(
      `UPDATE skp_tahunan SET
        status = 'approved',
        catatan_kepsek = COALESCE($1, catatan_kepsek),
        updated_at = NOW()
       WHERE id = $2 AND status = 'submitted'
       RETURNING *`,
      [catatanKepsek || null, id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'SKP tidak ditemukan atau status bukan submitted' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (err) {
    console.error('POST /api/skp/[id]/approve error:', err)
    return NextResponse.json({ error: 'Failed to approve SKP' }, { status: 500 })
  }
}
