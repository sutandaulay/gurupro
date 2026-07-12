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
  const plans = [
    {
      package_name: 'Gratis',
      token_amount: 5,
      price: 0,
      duration_days: 30,
      description: 'Paket dasar untuk pemula',
      sort_order: 0,
      is_popular: false,
      is_active: true,
    },
    {
      package_name: 'Profesional',
      token_amount: 100,
      price: 99000,
      duration_days: 30,
      description: 'Ideal untuk guru penuh waktu',
      sort_order: 1,
      is_popular: true,
      is_active: true,
    },
    {
      package_name: 'Lanjutan',
      token_amount: 500,
      price: 450000,
      duration_days: 90,
      description: 'Paket hemat untuk penggunaan intensif',
      sort_order: 2,
      is_popular: false,
      is_active: true,
    },
    {
      package_name: 'Enterprise',
      token_amount: 2000,
      price: 1500000,
      duration_days: 365,
      description: 'Untuk sekolah dan institusi',
      sort_order: 3,
      is_popular: false,
      is_active: true,
    },
  ]

  for (const plan of plans) {
    try {
      const existing = await payload.find({
        collection: 'pricing_plans',
        where: { package_name: { equals: plan.package_name } }
      })

      if (existing.docs.length === 0) {
        await payload.create({
          collection: 'pricing_plans',
          data: plan
        })
        console.log(`✅ Pricing plan dibuat: ${plan.package_name}`)
      } else {
        console.log(`ℹ️ Pricing plan sudah ada: ${plan.package_name}`)
      }
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
n      icon: 'IconBook2',
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