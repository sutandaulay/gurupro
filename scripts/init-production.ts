// Contoh inisialisasi database untuk Production
// Jalankan: npx tsx scripts/init-production.ts

import { getPayload as getPayloadClient } from 'payload'
import config from '../payload.config'
import { getPayload } from 'payload'

async function initProduction() {
  console.log('🚀 Memulai inisialisasi Production...')

  try {
    // Sambungkan ke Payload
    console.log('📦 Menginisialisasi Payload...')
    const payload = await getPayload({ config })
    console.log('✅ Payload tersambung!')

    // Inisialisasi pengguna admin
    console.log('\n👤 Membuat akun admin...')
    await createAdminUser(payload)

    // Inisialisasi pricing plan
    console.log('\n💰 Membuat pricing plan...')
    await createPricingPlans(payload)

    // Inisialisasi fitur
    console.log('\n🌟 Membuat fitur-fitur...')
    await createFeatures(payload)

    console.log('\n🎉 Inisialisasi Production selesai!')
    console.log('\n📌 Langkah selanjutnya:')
    console.log('1. Jalankan: npm run dev')
    console.log('2. Buka: http://localhost:3000')
    console.log('3. Akun admin: admin@gurupro.id / Admin@Grup123')

  } catch (error) {
    console.error('❌ Inisialisasi Production gagal:', error)
    process.exit(1)
  }
}

async function createAdminUser(payload: any) {
  try {
    const existingAdmin = await payload.find({
      collection: 'users',
      where: {
        email: { equals: 'admin@gurupro.id' }
      }
    })

    if (existingAdmin.docs.length > 0) {
      console.log('✅ Admin sudah ada')
      return
    }

    const adminUser = await payload.create({
      collection: 'users',
      data: {
        email: 'admin@gurupro.id',
        username: 'admin',
        password: 'Admin@Grup123',
        nama_lengkap: 'Super Admin',
        role: 'admin',
        whatsapp: '+62 812-3456-7890',
        is_active: true,
        subscription_start: new Date(),
        subscription_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 tahun
        status_langganan: 'paid',
        token_limit: 1000,
        cashback_balance: 0,
      }
    })

    console.log(`✅ Admin diinisiasi: ${adminUser.email}`)
    console.log(`   Password: Admin@Grup123`)

  } catch (error) {
    console.log('⚠️ Gagal membuat admin:', (error as Error).message)
  }
}

async function createPricingPlans(payload: any) {
  // Sumber harga = CMS Landing Page (public.pricing_plans),
  // dikelola via Dashboard Admin > CMS Landing > Paket.
  const { pool } = await import('../lib/db')
  const plans = [
    {
      package_name: '1 Bulan',
      price: 10000,
      tokens: 5,
      duration_days: 30,
      is_active: true,
      is_popular: false,
      sort_order: 0,
      features: ['5 Poin Kuota Utama', 'Masa Aktif 30 Hari'],
    },
    {
      package_name: '3 Bulan',
      price: 60000,
      tokens: 100,
      duration_days: 90,
      is_active: true,
      is_popular: true,
      sort_order: 1,
      features: ['100 Poin Kuota Utama', 'Masa Aktif 90 Hari'],
    },
    {
      package_name: '6 Bulan',
      price: 100000,
      tokens: 300,
      duration_days: 180,
      is_active: true,
      is_popular: false,
      sort_order: 2,
      features: ['300 Poin Kuota Utama', 'Masa Aktif 180 Hari'],
    },
    {
      package_name: '1 Tahun',
      price: 150000,
      tokens: 1000,
      duration_days: 365,
      is_active: true,
      is_popular: false,
      sort_order: 3,
      features: ['1000 Poin Kuota Utama', 'Masa Aktif 365 Hari'],
    },
  ]

  for (const plan of plans) {
    try {
      await pool.query(
        `INSERT INTO pricing_plans (package_name, price, duration_days, tokens, features, is_active, popular, sort_order, updated_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, NOW())
         ON CONFLICT DO NOTHING`,
        [
          plan.package_name,
          plan.price,
          plan.duration_days,
          plan.tokens,
          JSON.stringify(plan.features),
          plan.is_active,
          plan.is_popular,
          plan.sort_order,
        ]
      )
      console.log(`✅ Pricing plan dibuat: ${plan.package_name}`)
    } catch (error) {
      console.log(`⚠️ Gagal membuat pricing plan ${plan.package_name}:`, (error as Error).message)
    }
  }
}

async function createFeatures(payload: any) {
  const features = [
    {
      title: 'Pembuat RPP AI',
      description: 'Buat RPP sesuai Kurikulum Merdeka otomatis',
      icon: 'IconFileTextAi',
      is_active: true,
      sort_order: 0,
    },
    {
      title: 'Jurnal Mengajar',
      description: 'Catat aktivitas harian kelas dengan mudah',
      icon: 'IconBook2',
      is_active: true,
      sort_order: 1,
    },
    {
      title: 'Absensi Digital',
      description: 'Kelola kehadiran siswa secara digital',
      icon: 'IconClipboardCheck',
      is_active: true,
      sort_order: 2,
    },
    {
      title: 'Buku Nilai & Rapor',
      description: 'Input nilai dan cetak rapor otomatis',
      icon: 'IconReportAnalytics',
      is_active: true,
      sort_order: 3,
    },
    {
      title: 'PKG & SKP',
      description: 'Bantu proses Penilaian Kinerja Guru',
      icon: 'IconAward',
      is_active: true,
      sort_order: 4,
    },
    {
      title: 'Komunikasi Orang Tua',
      description: 'Kirim notifikasi ke wali murid',
      icon: 'IconMessages',
      is_active: true,
      sort_order: 5,
    },
  ]

  for (const feature of features) {
    try {
      const existing = await payload.find({
        collection: 'features',
        where: { title: { equals: feature.title } }
      })

      if (existing.docs.length === 0) {
        await payload.create({
          collection: 'features',
          data: feature
        })
        console.log(`✅ Fitur dibuat: ${feature.title}`)
      } else {
        console.log(`ℹ️ Fitur sudah ada: ${feature.title}`)
      }
    } catch (error) {
      console.log(`⚠️ Gagal membuat fitur ${feature.title}:`, (error as Error).message)
    }
  }
}

initProduction();