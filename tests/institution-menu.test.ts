import { describe, it, expect } from 'vitest'
import {
  masterMenus,
  institutionSubmenus,
  isInstitutionHref,
  resolveInstitutionHref,
  resolveActiveInstitutionId,
  getLucideIcon,
  resolveCategory,
  type MenuItem,
} from '@/lib/menuConfig'

const institutionMenu = masterMenus.find((m) => m.label === 'Institusi')

describe('Menu Institusi — struktur masterMenus', () => {
  it('menu "Institusi" terdefinisi dengan submenu', () => {
    expect(institutionMenu).toBeDefined()
    expect(institutionMenu?.submenu?.length).toBeGreaterThan(0)
  })

  it('submenu "Institusi" berisi 7 item sesuai fitur yang ada', () => {
    const labels = institutionMenu?.submenu?.map((s) => s.label) ?? []
    expect(labels).toEqual([
      'Overview Institusi',
      'Anggota Institusi',
      'Rekap TPG',
      'Laporan Mengajar',
      'Approval / Persetujuan',
      'Langganan & Billing',
      'Pengaturan Institusi',
    ])
  })

  it('setiap submenu memakai href marker di bawah /dashboard/institution/', () => {
    for (const sub of institutionSubmenus ?? []) {
      expect(isInstitutionHref(sub.href)).toBe(true)
      expect(sub.href).toMatch(/^\/dashboard\/institution/)
    }
  })

  it('masterMenus dan institutionSubmenus sinkron (tidak duplikat definisi)', () => {
    expect(institutionMenu?.submenu).toEqual(institutionSubmenus)
  })
})

describe('Menu Institusi — resolusi href dengan isi data (institutionId aktif)', () => {
  const INSTITUTION_ID = 42
  const base = `/institusi/${INSTITUTION_ID}`

  const cases: { label: string; href: string; expected: string }[] = [
    { label: 'Overview Institusi', href: '/dashboard/institution', expected: `${base}/dashboard` },
    { label: 'Anggota Institusi', href: '/dashboard/institution/members', expected: `/dashboard/institution/${INSTITUTION_ID}/operator` },
    { label: 'Rekap TPG', href: '/dashboard/institution/tpg', expected: `${base}/dashboard/tpg` },
    { label: 'Laporan Mengajar', href: '/dashboard/institution/laporan-mengajar', expected: `/dashboard/institution/${INSTITUTION_ID}/laporan-mengajar` },
    { label: 'Approval / Persetujuan', href: '/dashboard/institution/approval', expected: `${base}/dashboard/approval` },
    { label: 'Langganan & Billing', href: '/dashboard/institution/langganan', expected: `${base}/dashboard/langganan` },
    { label: 'Pengaturan Institusi', href: '/dashboard/institution/settings', expected: `${base}/dashboard/pengaturan` },
  ]

  it.each(cases)('$label → $expected', ({ href, expected }) => {
    expect(resolveInstitutionHref(href, INSTITUTION_ID)).toBe(expected)
  })

  it('setiap submenu menu "Institusi" menghasilkan URL ke institusi yang sama', () => {
    for (const sub of institutionSubmenus ?? []) {
      const resolved = resolveInstitutionHref(sub.href!, INSTITUTION_ID)
      expect(resolved).toContain(String(INSTITUTION_ID))
    }
  })

  it('href selain marker institusi diteruskan apa adanya', () => {
    expect(resolveInstitutionHref('/dashboard/billing', INSTITUTION_ID)).toBe('/dashboard/billing')
  })
})

describe('Menu Institusi — fallback tanpa institusi aktif', () => {
  it('semua submenu jatuh ke /dashboard bila activeInstitutionId null', () => {
    for (const sub of institutionSubmenus ?? []) {
      expect(resolveInstitutionHref(sub.href!, null)).toBe('/dashboard')
    }
  })

  it('fallback juga untuk angka 0 / undefined', () => {
    expect(resolveInstitutionHref('/dashboard/institution', 0 as any)).toBe('/dashboard')
    expect(resolveInstitutionHref('/dashboard/institution', undefined as any)).toBe('/dashboard')
  })

  it('isInstitutionHref hanya true untuk marker institusi', () => {
    expect(isInstitutionHref('/dashboard/institution')).toBe(true)
    expect(isInstitutionHref('/dashboard/institution/members')).toBe(true)
    expect(isInstitutionHref('/dashboard/billing')).toBe(false)
    expect(isInstitutionHref('/institusi/42/dashboard')).toBe(false)
    expect(isInstitutionHref(undefined)).toBe(false)
  })
})

describe('Menu Institusi — resolusi institusi aktif (resolveActiveInstitutionId)', () => {
  it('memakai institutionId dari activeContext ketika konteks institusi', () => {
    expect(resolveActiveInstitutionId({ activeContext: { institutionId: 7 } })).toBe(7)
  })

  it('fallback ke institusi pertama saat activeContext masih "individual"', () => {
    expect(
      resolveActiveInstitutionId({
        activeContext: 'individual',
        institutions: [{ id: 3 }, { id: 10 }],
      })
    ).toBe(3)
  })

  it('fallback ke institusi pertama saat activeContext undefined', () => {
    expect(
      resolveActiveInstitutionId({
        institutions: [{ id: 1 }],
      })
    ).toBe(1)
  })

  it('null saat tidak ada keanggotaan institusi sama sekali', () => {
    expect(resolveActiveInstitutionId({ activeContext: 'individual', institutions: [] })).toBeNull()
    expect(resolveActiveInstitutionId({})).toBeNull()
  })
})

describe('Menu Institusi — ikon & kategori', () => {
  it('semua label submenu punya ikon yang ter-resolve', () => {
    for (const sub of institutionSubmenus ?? []) {
      expect(getLucideIcon(sub.label)).toBeTruthy()
    }
  })

  it('label "Institusi" memiliki ikon dan kategori institution', () => {
    expect(getLucideIcon('Institusi')).toBeTruthy()
    expect(resolveCategory('Institusi')).toBe('institution')
  })

  it('kategori submenu ter-resolve (kecuali Pengaturan → settings)', () => {
    const expected: Record<string, string> = {
      'Overview Institusi': 'institution',
      'Anggota Institusi': 'people',
      'Rekap TPG': 'reports',
      'Laporan Mengajar': 'academic',
      'Approval / Persetujuan': 'admin',
      'Langganan & Billing': 'finance',
      'Pengaturan Institusi': 'institution',
    }
    for (const sub of institutionSubmenus ?? []) {
      expect(resolveCategory(sub.label)).toBe(expected[sub.label])
    }
  })

  it('MenuItem type kompatibel untuk renderer submenu', () => {
    const menu: MenuItem = { label: 'Institusi', submenu: institutionSubmenus }
    expect(menu.submenu?.length).toBe(7)
  })
})
