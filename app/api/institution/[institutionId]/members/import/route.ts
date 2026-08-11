import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireSession } from '@/lib/session'
import {
  findAppUserByEmailOrUsername,
  findOrCreateCmsUser,
  createInvitation,
  sendInviteNotification,
} from '@/lib/institution-members'
import * as XLSX from 'xlsx'

interface ImportRow {
  nama: string
  email: string
  nik?: string
  mapel?: string
  kelas?: string
}

function validateRow(row: ImportRow, index: number, allEmails: Set<string>): string[] {
  const errors: string[] = []
  if (!row.nama || !row.nama.trim()) errors.push('Nama tidak boleh kosong')
  if (!row.email || !row.email.trim()) {
    errors.push('Email tidak boleh kosong')
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(row.email.trim())) errors.push('Format email tidak valid')
    if (allEmails.has(row.email.trim().toLowerCase())) errors.push('Email duplikat dalam file')
  }
  if (row.nik && !/^\d+$/.test(row.nik.trim())) errors.push('NIK harus berupa angka')
  return errors
}

async function checkPermission(institutionId: number): Promise<NextResponse | null> {
  try {
    const session = await requireSession()
    const result = await query(
      `SELECT imr.value
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       WHERE im.app_user_id = $1 AND im.institution_id = $2 AND im.status = 'active'`,
      [session.id, institutionId]
    )
    if (result.rows.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const allowed = result.rows.some((r: any) => r.value === 'operator' || r.value === 'admin_sekolah')
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return null
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ institutionId: string }> }
) {
  const { institutionId } = await context.params
  const instId = parseInt(institutionId, 10)
  if (isNaN(instId)) return NextResponse.json({ error: 'Invalid institution ID' }, { status: 400 })

  const permError = await checkPermission(instId)
  if (permError) return permError

  const instResult = await query(`SELECT name FROM institutions WHERE id = $1`, [instId])
  if (instResult.rows.length === 0) {
    return NextResponse.json({ error: 'Institusi tidak ditemukan' }, { status: 404 })
  }
  const institutionName = instResult.rows[0].name

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return NextResponse.json({ error: 'File Excel kosong' }, { status: 400 })
  }

  const sheet = workbook.Sheets[sheetName]
  const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  if (rawRows.length === 0) {
    return NextResponse.json({ error: 'Tidak ada data dalam file Excel' }, { status: 400 })
  }

  const rows: ImportRow[] = rawRows.map((r: any) => ({
    nama: (r.nama || r.Nama || '').toString().trim(),
    email: (r.email || r.Email || '').toString().trim().toLowerCase(),
    nik: (r.nik || r.NIK || r.nik || '').toString().trim(),
    mapel: (r.mapel || r.Mapel || r.mata_pelajaran || r['Mata Pelajaran'] || '').toString().trim(),
    kelas: (r.kelas || r.Kelas || '').toString().trim(),
  }))

  const allEmails = new Set<string>()
  const rowValidationErrors: { baris: number; errors: string[] }[] = []

  rows.forEach((row, i) => {
    const errs = validateRow(row, i, allEmails)
    if (errs.length > 0) {
      rowValidationErrors.push({ baris: i + 2, errors: errs })
    }
    allEmails.add(row.email.toLowerCase())
  })

  const validRows = rows.filter((_, i) => !rowValidationErrors.find((e) => e.baris === i + 2))

  const result = {
    total: rows.length,
    berhasil: 0,
    gagal: 0,
    sudah_punya_akun_individual: 0,
    details: [] as { baris: number; email: string; status: string; keterangan: string }[],
  }

  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i]
    const baris = rows.indexOf(row) + 2

    const validationError = rowValidationErrors.find((e) => e.baris === baris)
    if (validationError) {
      result.gagal++
      result.details.push({
        baris,
        email: row.email,
        status: 'gagal',
        keterangan: validationError.errors.join('; '),
      })
      continue
    }

    try {
      const appUser = await findAppUserByEmailOrUsername(row.email)
      if (!appUser) {
        result.gagal++
        result.details.push({
          baris,
          email: row.email,
          status: 'gagal',
          keterangan: 'Tidak memiliki akun GuruPRO. Silakan daftar terlebih dahulu.',
        })
        continue
      }

      const existingMember = await query(
        `SELECT id, status FROM public.institution_members WHERE app_user_id = $1 AND institution_id = $2`,
        [appUser.id, instId]
      )
      if (existingMember.rows.length > 0) {
        const status = existingMember.rows[0].status
        if (status === 'active') {
          result.berhasil++
          result.details.push({
            baris,
            email: row.email,
            status: 'sudah_aktif',
            keterangan: 'Guru sudah menjadi anggota aktif institusi ini',
          })
        } else {
          result.gagal++
          result.details.push({
            baris,
            email: row.email,
            status: 'gagal',
            keterangan: `Guru sudah terdaftar dengan status "${status}"`,
          })
        }
        continue
      }

      const userMode = await checkUserMode(appUser.id)
      const cmsUserId = await findOrCreateCmsUser({
        id: appUser.id,
        email: appUser.email,
        nama_lengkap: row.nama || appUser.nama_lengkap,
      })

      const membership = await createInvitation(appUser.id, cmsUserId, instId)

      const publicMemberRes = await query(
        `INSERT INTO public.institution_members (app_user_id, institution_id, status, joined_at, created_at, updated_at)
         VALUES ($1, $2, 'invited', NULL, NOW(), NOW())
         RETURNING id`,
        [appUser.id, instId]
      )
      const publicMemberId = publicMemberRes.rows[0]?.id ?? membership.id

      if (row.mapel) {
        const mapelList = row.mapel.split(',').map((m: string) => m.trim()).filter(Boolean)
        for (const m of mapelList) {
          await query(
            `INSERT INTO public.institution_members_assigned_mapel (_order, _parent_id, id, mapel)
             VALUES ((SELECT COALESCE(MAX(_order), 0) + 1 FROM public.institution_members_assigned_mapel WHERE _parent_id = $1), $1, gen_random_uuid()::text, $2)`,
            [publicMemberId, m]
          )
        }
      }

      if (row.kelas) {
        const kelasList = row.kelas.split(',').map((k: string) => k.trim()).filter(Boolean)
        for (const k of kelasList) {
          await query(
            `INSERT INTO public.institution_members_assigned_kelas (_order, _parent_id, id, kelas)
             VALUES ((SELECT COALESCE(MAX(_order), 0) + 1 FROM public.institution_members_assigned_kelas WHERE _parent_id = $1), $1, gen_random_uuid()::text, $2)`,
            [publicMemberId, k]
          )
        }
      }

      await sendInviteNotification(appUser.id, appUser.email, appUser.whatsapp, row.nama || appUser.nama_lengkap, institutionName)

      result.berhasil++
      if (userMode === 'INDIVIDUAL_ONLY') {
        result.sudah_punya_akun_individual++
        result.details.push({
          baris,
          email: row.email,
          status: 'invited',
          keterangan: 'Berhasil diundang. Guru memiliki akun individual dan menunggu konfirmasi.',
        })
      } else {
        result.details.push({
          baris,
          email: row.email,
          status: 'invited',
          keterangan: 'Berhasil diundang.',
        })
      }
    } catch (err: any) {
      result.gagal++
      result.details.push({
        baris,
        email: row.email,
        status: 'gagal',
        keterangan: err.message || 'Kesalahan sistem',
      })
    }
  }

  return NextResponse.json(result)
}

async function checkUserMode(appUserId: string): Promise<string> {
  try {
    const hasSub = await query(
      `SELECT id FROM users WHERE id = $1 AND subscription_status = 'active' AND status_langganan != 'free' AND subscription_end IS NOT NULL AND subscription_end > NOW() LIMIT 1`,
      [appUserId]
    )
    return hasSub.rows.length > 0 ? 'INDIVIDUAL_ONLY' : 'INSTITUTIONAL_ONLY'
  } catch {
    return 'INDIVIDUAL_ONLY'
  }
}
