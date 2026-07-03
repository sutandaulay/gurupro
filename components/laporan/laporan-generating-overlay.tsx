'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface LaporanGeneratingOverlayProps {
  onComplete?: (laporanId: string) => void
  onError?: (error: string) => void
  tahunAjaranId?: string
  semester?: string
}

const STEPS = [
  { key: 'collecting', label: 'Mengumpulkan data aktivitas' },
  { key: 'analyzing', label: 'Menganalisis capaian kinerja' },
  { key: 'generating', label: 'AI menyusun narasi laporan' },
  { key: 'saving', label: 'Menyimpan laporan' },
]

export function LaporanGeneratingOverlay({
  onComplete,
  onError,
  tahunAjaranId = '',
  semester = 'ganjil',
}: LaporanGeneratingOverlayProps) {
  const [currentStep, setCurrentStep] = useState<string>('')
  const [doneSteps, setDoneSteps] = useState<string[]>([])
  const [streamText, setStreamText] = useState<string>('')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const startGeneration = async () => {
      try {
        const response = await fetch('/api/ai/laporan-kinerja', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tahunAjaranId,
            semester,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to start generation')
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))

                if (data.step === 'chunk') {
                  setStreamText(prev => prev + data.text)
                } else if (data.step === 'complete') {
                  onComplete?.(data.laporan_id)
                  return
                } else if (data.step === 'error') {
                  onError?.(data.message)
                  return
                } else {
                  const stepIndex = STEPS.findIndex(s => s.key === data.step)
                  if (stepIndex >= 0) {
                    setCurrentStep(data.step)
                    setDoneSteps(STEPS.slice(0, stepIndex).map(s => s.key))
                    setProgress(Math.round(((stepIndex + 1) / STEPS.length) * 100))
                  }
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e)
              }
            }
          }
        }
      } catch (err: any) {
        onError?.(err.message)
      }
    }

    startGeneration()
  }, [onComplete, onError, tahunAjaranId, semester])

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className={cn(
        'bg-card border rounded-2xl p-6 max-w-md w-full mx-4',
        'shadow-2xl animate-in fade-in zoom-in-95 duration-300'
      )}>
        <div className="text-center mb-6">
          <div className="text-4xl mb-3 animate-bounce">📊</div>
          <h2 className="text-lg font-semibold">Sedang menyusun laporan kinerja Anda...</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Biasanya selesai dalam 15-30 detik
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {STEPS.map((step, index) => {
            const isDone = doneSteps.includes(step.key)
            const isActive = currentStep === step.key
            const isPending = !isDone && !isActive

            return (
              <div key={step.key} className="flex items-center gap-3">
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                  isDone && 'bg-green-500 text-white',
                  isActive && 'bg-violet-500 text-white animate-pulse',
                  isPending && 'bg-muted text-muted-foreground'
                )}>
                  {isDone ? '✓' : isActive ? '⟳' : index + 1}
                </div>
                <span className={cn(
                  'text-sm',
                  isDone && 'text-green-600',
                  isActive && 'text-violet-600 font-medium',
                  isPending && 'text-muted-foreground'
                )}>
                  {step.label}
                  {isActive && '...'}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-violet-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {streamText && (
          <div className="bg-muted/50 rounded-lg p-3 max-h-32 overflow-y-auto">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {streamText.slice(-500)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
