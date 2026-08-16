'use client'
import { apiFetch } from "@/lib/api-client";

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function ApproveSchoolRegistrationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">Memuat...</div>}>
      <ApproveSchoolRegistrationInner />
    </Suspense>
  )
}

function ApproveSchoolRegistrationInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(() => {
    return token ? 'loading' : 'error'
  })
  const [message, setMessage] = useState(() => {
    return token ? '' : 'Token tidak ditemukan'
  })

  useEffect(() => {
    if (!token) return

    async function approve() {
      try {
        const res = await apiFetch(`/api/public/school-registrations/approve?token=${encodeURIComponent(token ?? '')}`, {
          method: 'GET',
        })
        const data = await res.json()
        if (!res.ok) {
          setStatus('error')
          setMessage(data.error || 'Gagal menyetujui pendaftaran')
          return
        }
        setStatus('success')
        setMessage('Pendaftaran institusi berhasil diaktifkan. Silakan masuk ke akun Anda. Untuk email baru, gunakan "Lupa Kata Sandi" pada halaman masuk agar dapat membuat kata sandi.')
        setTimeout(() => router.push('/login'), 4000)
      } catch {
        setStatus('error')
        setMessage('Terjadi kesalahan jaringan')
      }
    }

    approve()
  }, [token, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Konfirmasi Pendaftaran Institusi</h1>
        <p className="text-gray-600 mb-6">Halaman ini memproses konfirmasi pendaftaran institusi Anda.</p>
        {status === 'loading' && <p className="text-gray-500">Memproses konfirmasi...</p>}
        {status === 'success' && (
          <div>
            <p className="text-green-600 font-medium mb-4">{message}</p>
            <p className="text-gray-500 text-sm">Mengarahkan ke halaman masuk...</p>
          </div>
        )}
        {status === 'error' && (
          <div>
            <p className="text-red-600 font-medium mb-4">{message}</p>
            <button
              onClick={() => router.push('/daftar-sekolah')}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Daftar Ulang
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
