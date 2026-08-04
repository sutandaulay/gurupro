/**
 * Integration Test Suite: Institusi Menu (Real Database, Seeded Data)
 *
 * Meng-seed 1 institusi + 3 anggota aktif (kepala_sekolah, operator, guru)
 * lalu memvalidasi bahwa menu "Institusi" di lib/menuConfig merujuk ke halaman
 * yang benar-benar ada (bukan link mati) dan ter-resolve terhadap ID institusi
 * nyata yang diambil dari database.
 *
 * Data dihapus kembali setelah test (afterAll) — tidak mencemari database.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { pool } from '@/lib/db'
import { getUserActiveMemberships } from '@/lib/institution-members'
import { institutionSubmenus, resolveInstitutionHref } from '@/lib/menuConfig'

const UNIQUE = randomUUID().slice(0, 8)
const INSTITUTION_NAME = `SD Test Menu ${UNIQUE}`
const NPSN = `9${Math.floor(Math.random() * 89999999 + 10000000)}`
const MAIL_DOMAIN = `menu.test.${UNIQUE}@gurupro.test`

let seeded = false
let institutionId: number | null = null
const appUserIds: string[] = []
const cmsUserIds: number[] = []
const memberIds: number[] = []

async function seedData() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const inst = await client.query(
      `INSERT INTO payload.institutions (name, npsn, jenjang, naungan, subscription_tier, approval_layer_config, status, academic_year_active)
       VALUES ($1, $2, 'SD', 'Kemendikbud', 'trial', 'single', 'active', '2025/2026')
       RETURNING id`,
      [INSTITUTION_NAME, NPSN]
    )
    institutionId = inst.rows[0].id

    const roles = ['kepala_sekolah', 'operator', 'guru']
    for (let i = 0; i < roles.length; i++) {
      const role = roles[i]
      const suffix = `m${i + 1}.${UNIQUE}`

      const app = await client.query(
        `INSERT INTO users (email, whatsapp, nama_lengkap, role, is_active)
         VALUES ($1, $2, $3, 'guru', true)
         RETURNING id`,
        [`${role}.${suffix}@${MAIL_DOMAIN}`, `+62810000000${i}`, `Anggota Test ${role}`]
      )
      const appUserId = app.rows[0].id
      appUserIds.push(appUserId)

      const cms = await client.query(
        `INSERT INTO payload.cms_users (name, email, role, salt, hash, pdp_consent_given, pdp_consent_version, pdp_consent_consented_at)
         VALUES ($1, $2, 'admin', '', '', true, '1.0', NOW())
         RETURNING id`,
        [`Anggota Test ${role}`, `${role}.${suffix}@${MAIL_DOMAIN}`]
      )
      const cmsUserId = cms.rows[0].id
      cmsUserIds.push(cmsUserId)

      const member = await client.query(
        `INSERT INTO payload.institution_members (user_id, app_user_id, institution_id, status, joined_at)
         VALUES ($1, $2, $3, 'active', NOW())
         RETURNING id`,
        [cmsUserId, appUserId, institutionId]
      )
      const memberId = member.rows[0].id
      memberIds.push(memberId)

      await client.query(
        `INSERT INTO payload.institution_members_role ("order", parent_id, value)
         VALUES ($1, $2, $3)`,
        [1, memberId, role]
      )
    }

    await client.query('COMMIT')
    seeded = true
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

beforeAll(async () => {
  try {
    await pool.query('SELECT 1')
    await seedData()
  } catch (err) {
    console.warn('[institution-menu-data] seeding gagal, test di-skip:', (err as Error).message)
  }
}, 30000)

afterAll(async () => {
  if (!seeded && institutionId === null && memberIds.length === 0) return
  try {
    if (memberIds.length) {
      await pool.query('DELETE FROM payload.institution_members WHERE id = ANY($1::int[])', [memberIds])
    }
    if (institutionId) {
      await pool.query('DELETE FROM payload.institutions WHERE id = $1', [institutionId])
    }
    if (cmsUserIds.length) {
      await pool.query('DELETE FROM payload.cms_users WHERE id = ANY($1::int[])', [cmsUserIds])
    }
    if (appUserIds.length) {
      await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [appUserIds])
    }
  } catch (err) {
    console.warn('[institution-menu-data] cleanup gagal:', (err as Error).message)
  }
})

function routeFilesFor(href: string): string[] {
  if (href === '/dashboard') return []
  if (href.startsWith('/institusi/')) {
    const m = href.match(/^\/institusi\/(\d+)(\/.*)?$/)
    if (!m) return []
    const sub = m[2] || '/dashboard'
    const dir = `app/(institution)/institusi/[institutionId]${sub}`
    return [resolve(dir, 'page.tsx')]
  }
  if (href.startsWith('/dashboard/institution/')) {
    const m = href.match(/^\/dashboard\/institution\/\d+(\/.*)?$/)
    if (!m) return []
    const sub = m[1] || ''
    return [resolve(`app/(app)/dashboard/institution/[institutionId]${sub}`, 'page.tsx'), resolve(`app/(app)/dashboard/institution/[institutionId]${sub}`, 'content.tsx')]
  }
  return []
}

describe('Institusi Menu - Data Ter-Seed', () => {
  it('institusi & 3 anggota aktif berhasil di-seed', () => {
    expect(seeded).toBe(true)
    expect(institutionId).toBeTruthy()
  })

  it('institusi tersimpan dengan data yang benar', async () => {
    if (!institutionId) return
    const res = await pool.query(
      'SELECT name, npsn, jenjang, naungan, status FROM payload.institutions WHERE id = $1',
      [institutionId]
    )
    expect(res.rows).toHaveLength(1)
    const inst = res.rows[0]
    expect(inst.name).toBe(INSTITUTION_NAME)
    expect(inst.npsn).toBe(NPSN)
    expect(inst.jenjang).toBe('SD')
    expect(inst.status).toBe('active')
  })

  it('memiliki 3 anggota aktif dengan role kepala_sekolah, operator, guru', async () => {
    if (!institutionId) return
    const res = await pool.query(
      `SELECT im.status, r.value AS role
       FROM payload.institution_members im
       JOIN payload.institution_members_role r ON r.parent_id = im.id
       WHERE im.institution_id = $1`,
      [institutionId]
    )
    const roles = res.rows.map((r: any) => r.role)
    expect(roles).toHaveLength(3)
    expect(roles).toEqual(expect.arrayContaining(['kepala_sekolah', 'operator', 'guru']))
    expect(res.rows.every((r: any) => r.status === 'active')).toBe(true)
  })

  it('setiap anggota dikenali sebagai anggota aktif via getUserActiveMemberships', async () => {
    if (!institutionId) return
    for (const appUserId of appUserIds) {
      const memberships = await getUserActiveMemberships(appUserId)
      expect(memberships.length).toBeGreaterThanOrEqual(1)
      expect(memberships.map((m) => Number(m.institution_id))).toContain(institutionId)
    }
  })

  it('menu Institusi ter-resolve ke URL dengan ID institusi dari database', () => {
    expect(institutionId).toBeTruthy()
    if (!institutionId) return
    expect(institutionSubmenus).toHaveLength(7)
    for (const item of institutionSubmenus!) {
      const resolved = resolveInstitutionHref(item.href, institutionId)
      const isInstitusiRoute = resolved.startsWith(`/institusi/${institutionId}/`)
      const isOperatorRoute = resolved.startsWith(`/dashboard/institution/${institutionId}/`)
      expect(isInstitusiRoute || isOperatorRoute, `${item.label} → ${resolved}`).toBe(true)
      expect(resolved).not.toBe('/dashboard')
    }
  })

  it('setiap URL submenu menu Institusi menunjuk ke halaman yang benar-benar ada', () => {
    expect(institutionId).toBeTruthy()
    if (!institutionId) return
    for (const item of institutionSubmenus!) {
      const resolved = resolveInstitutionHref(item.href, institutionId)
      const files = routeFilesFor(resolved)
      expect(files.length, `${resolved} harus punya file route`).toBeGreaterThan(0)
      const found = files.some((f) => existsSync(f))
      expect(found, `halaman untuk ${resolved} (${files.join(', ')}) tidak ditemukan`).toBe(true)
    }
  })
})
