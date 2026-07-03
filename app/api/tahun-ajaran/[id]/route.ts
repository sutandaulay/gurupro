/**
 * API Route: /api/tahun-ajaran/[id]
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { comparePassword } from '@/lib/auth'
import { cookies } from 'next/headers'

// GET /api/tahun-ajaran/[id]
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const res = await query('SELECT * FROM tahun_ajaran WHERE id = $1', [id])
    if (!res.rows[0]) {
      return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json(res.rows[0])
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// PUT /api/tahun-ajaran/[id]
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await req.json()
    const action = body.action || ''

    // Activate
    if (action === 'activate') {
      await query('UPDATE tahun_ajaran SET is_active = false')
      await query(
        'UPDATE tahun_ajaran SET is_active = true, semester = $1 WHERE id = $2',
        [body.semester || 'ganjil', id]
      )
      return NextResponse.json({ message: 'Berhasil', semester: body.semester })
    }

    // Update fields
    const fields: string[] = []
    const values: any[] = []
    let i = 1

    if (body.nama) {
      fields.push(`nama = $${i++}`)
      values.push(body.nama)
    }
    if (body.tanggalMulai) {
      fields.push(`tanggal_mulai = $${i++}`)
      values.push(body.tanggalMulai)
    }
    if (body.tanggalSelesai) {
      fields.push(`tanggal_selesai = $${i++}`)
      values.push(body.tanggalSelesai)
    }
    if (body.semester) {
      fields.push(`semester = $${i++}`)
      values.push(body.semester)
    }

    if (!fields.length) {
      return NextResponse.json({ error: 'No fields' }, { status: 400 })
    }

    values.push(id)
    const res = await query(
      'UPDATE tahun_ajaran SET ' + fields.join(', ') + ' WHERE id = $' + i + ' RETURNING *',
      values
    )

    if (!res.rows[0]) {
      return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json(res.rows[0])
  } catch (err) {
    console.error('PUT error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// DELETE /api/tahun-ajaran/[id]
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('gurupro_session')?.value
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 })
    }
    const session = JSON.parse(sessionCookie)

    const body = await req.json()
    const { password } = body

    if (!password) {
      return NextResponse.json({ error: 'Password wajib diisi' }, { status: 400 })
    }

    const userRes = await query('SELECT password_hash FROM users WHERE id = $1', [session.id])
    if (!userRes.rows[0]) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 })
    }

    const match = await comparePassword(password, userRes.rows[0].password_hash)
    if (!match) {
      return NextResponse.json({ error: 'Password salah' }, { status: 403 })
    }

    const check = await query('SELECT is_active FROM tahun_ajaran WHERE id = $1', [id])
    if (!check.rows[0]) {
      return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
    }
    if (check.rows[0].is_active) {
      return NextResponse.json({ error: 'Tidak bisa menghapus tahun ajaran yang aktif' }, { status: 400 })
    }

    const res = await query('DELETE FROM tahun_ajaran WHERE id = $1 RETURNING id', [id])
    if (!res.rows[0]) {
      return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json({ message: 'Berhasil' })
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus' }, { status: 500 })
  }
}
