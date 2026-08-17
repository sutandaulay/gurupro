'use client'
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/app/components/ui'
import { cn } from '@/lib/utils'

interface IndikatorItem {
  id: string
  kode: string
  nama: string
  deskripsi: string | null
  komponen: string
  bobot_persen: number
  min_evidence: number
  is_active: boolean
}

interface SelectedIndikator {
  indikatorId: string
  targetSelf: number
}

export default function SkpPlanningPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [indikatorList, setIndikatorList] = useState<IndikatorItem[]>([])
  const [selectedIndikator, setSelectedIndikator] = useState<Record<string, SelectedIndikator>>({})
  const [catatanGuru, setCatatanGuru] = useState('')
  const [tahunAjaranId, setTahunAjaranId] = useState('')

  useEffect(() => {
    const taId = localStorage.getItem('tahunAjaranId') || ''
    setTahunAjaranId(taId)
    fetchData(taId)
  }, [])

  const fetchData = async (taId: string) => {
    setLoading(true)
    try {
      const [indikatorRes, skpRes] = await Promise.all([
        apiFetch('/api/indikator-kinerja'),
        taId ? apiFetch(`/api/skp?tahun_ajaran_id=${taId}`) : Promise.resolve(null),
      ])

      if (indikatorRes.ok) {
        const data = await indikatorRes.json()
        setIndikatorList(data)
      }

      if (skpRes?.ok) {
        const data = await skpRes.json()
        if (data.length > 0) {
          const existing = data[0]
          // Pre-select existing indicators
          const selected: Record<string, SelectedIndikator> = {}
          if (existing.indikator_list) {
            existing.indikator_list.forEach((ind: any) => {
              selected[ind.indikator_id] = {
                indikatorId: ind.indikator_id,
                targetSelf: ind.target_self,
              }
            })
          }
          setSelectedIndikator(selected)
          setCatatanGuru(existing.catatan_guru || '')
        }
      }
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleIndikator = (ind: IndikatorItem) => {
    setSelectedIndikator(prev => {
      const next = { ...prev }
      if (next[ind.id]) {
        delete next[ind.id]
      } else {
        next[ind.id] = {
          indikatorId: ind.id,
          targetSelf: ind.min_evidence,
        }
      }
      return next
    })
  }

  const setTarget = (indikatorId: string, value: number) => {
    setSelectedIndikator(prev => ({
      ...prev,
      [indikatorId]: {
        ...prev[indikatorId],
        targetSelf: Math.max(1, value),
      },
    }))
  }

  const handleSimpan = async () => {
    if (Object.keys(selectedIndikator).length === 0) {
      setError('Pilih minimal satu indikator kinerja')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await apiFetch('/api/skp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tahunAjaranId,
          indikator: Object.values(selectedIndikator),
          catatanGuru,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Gagal menyimpan SKP')
      }

      router.push('/dashboard/laporan-kinerja')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const totalBobot = Object.keys(selectedIndikator).reduce((sum, id) => {
    const ind = indikatorList.find(i => i.id === id)
    return sum + (ind?.bobot_persen || 0)
  }, 0)

  if (loading) {
    return (
      <div className="container max-w-3xl mx-auto py-6 px-4">
        <div className="h-96 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-3xl mx-auto py-6 px-4">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4 gap-2">
        <span>←</span>
        <span>Kembali</span>
      </Button>

      <h1 className="text-2xl font-bold mb-2">Rencana SKP Tahunan</h1>
      <p className="text-muted-foreground mb-6">
        Pilih indikator kinerja yang akan menjadi fokus Anda tahun ini sesuai PKG 2026
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Ringkasan */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-violet-800">
              Indikator dipilih: <strong>{Object.keys(selectedIndikator).length}</strong> dari {indikatorList.length}
            </p>
            <p className="text-xs text-violet-600">
              Total bobot: {totalBobot}% (minimal 60% disarankan)
            </p>
          </div>
          <Button onClick={handleSimpan} disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan SKP'}
          </Button>
        </div>
      </div>

      {/* Daftar Indikator */}
      <div className="space-y-3">
        {indikatorList.map((ind) => {
          const isSelected = !!selectedIndikator[ind.id]
          return (
            <div
              key={ind.id}
              className={cn(
                'border rounded-xl p-4 transition-all',
                isSelected
                  ? 'border-violet-300 bg-violet-50/50'
                  : 'border-gray-200 bg-card hover:bg-muted/30'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleIndikator(ind)}
                      className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                    />
                    <span className="font-medium text-sm">{ind.kode}</span>
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                      {ind.komponen}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Bobot {ind.bobot_persen}%
                    </span>
                  </div>
                  <p className="text-sm mt-1 ml-6">{ind.nama}</p>
                  {ind.deskripsi && (
                    <p className="text-xs text-muted-foreground mt-0.5 ml-6">{ind.deskripsi}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 ml-6">
                    Min. evidence: {ind.min_evidence}
                  </p>
                </div>
              </div>

              {isSelected && (
                <div className="mt-3 ml-6 flex items-center gap-3">
                  <label className="text-xs text-muted-foreground">Target sendiri:</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={selectedIndikator[ind.id]?.targetSelf || ind.min_evidence}
                    onChange={(e) => setTarget(ind.id, parseInt(e.target.value) || 1)}
                    className="w-20 px-2 py-1 text-sm border rounded-lg bg-background text-center"
                  />
                  <span className="text-xs text-muted-foreground">evidence</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Catatan */}
      <div className="mt-6">
        <label className="block text-sm font-medium mb-2">Catatan / Komitmen (opsional)</label>
        <textarea
          value={catatanGuru}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCatatanGuru(e.target.value)}
          placeholder="Tuliskan komitmen atau target khusus Anda tahun ini..."
          rows={3}
          className="w-full px-3 py-2 rounded-lg border bg-background resize-none"
        />
      </div>

      <div className="mt-6 flex gap-3">
        <Button variant="secondary" onClick={() => router.back()} className="flex-1">
          Batal
        </Button>
        <Button onClick={handleSimpan} disabled={saving} className="flex-1">
          {saving ? 'Menyimpan...' : 'Simpan SKP'}
        </Button>
      </div>
    </div>
  )
}
