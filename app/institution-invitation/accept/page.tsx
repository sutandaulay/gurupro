'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function InstitutionInvitationAcceptPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'loading' | 'accepting' | 'success' | 'error' | 'login'>(() => {
    return token ? 'loading' : 'error'
  })
  const [message, setMessage] = useState(() => {
    return token ? '' : 'Token undangan tidak ditemukan'
  })
  const [institutionName, setInstitutionName] = useState('')

  useEffect(() => {
    if (!token) return

    let cancelled = false

    async function accept() {
      setStatus('accepting')
      try {
        const tokenValue = new URLSearchParams(window.location.search).get('token')
        const res = await fetch(`/api/institution-invitation/accept?token=${encodeURIComponent(tokenValue || '')}`, {
          method: 'GET',
        })
        const data = await res.json()
        if (!res.ok) {
          if (data.requiresLogin) {
            setStatus('login')
            setInstitutionName(data.invitation?.institutionName || '')
            setMessage(data.message || 'Silakan masuk untuk menerima undangan')
            return
          }
          setStatus('error')
          setMessage(data.error || 'Gagal menerima undangan')
          return
        }
        setStatus('success')
        setMessage(`Selamat! Anda telah bergabung dengan ${data.institutionName || 'institusi'}.`)
        setTimeout(() => router.push('/dashboard'), 2000)
      } catch {
        if (!cancelled) {
          setStatus('error')
          setMessage('Terjadi kesalahan jaringan')
        }
      }
    }

    accept()

    return () => {
      cancelled = true
    }
  }, [token, router])

  const handleLogin = () => {
    router.push(`/login?invitation_token=${encodeURIComponent(token || '')}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Undangan Institusi</h1>
        <p className="text-gray-600 mb-6">
          Halaman ini memproses undangan bergabung institusi Anda.
        </p>
        {status === 'loading' && <p className="text-gray-500">Memverifikasi undangan...</p>}
        {status === 'accepting' && <p className="text-blue-600">Sedang menerima undangan...</p>}
        {status === 'success' && (
          <div>
            <p className="text-green-600 font-medium mb-4">{message}</p>
            <p className="text-gray-500 text-sm">Mengarahkan ke dashboard...</p>
          </div>
        )}
        {status === 'login' && (
          <div>
            <p className="text-blue-600 font-medium mb-2">Anda belum masuk</p>
            <p className="text-gray-600 mb-4">{message}</p>
            {institutionName && (
              <p className="text-gray-500 text-sm mb-4">Institut: {institutionName}</p>
            )}
            <button
              onClick={handleLogin}
              className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Masuk / Daftar
            </button>
          </div>
        )}
        {status === 'error' && (
          <div>
            <p className="text-red-600 font-medium mb-4">{message}</p>
            <button
              onClick={() => router.push('/login')}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Masuk
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
