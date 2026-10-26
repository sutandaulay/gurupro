import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const checks: Record<string, { status: string; latency_ms?: number; error?: string }> = {}
  let allHealthy = true

  // 1. Database check
  try {
    const start = Date.now()
    await query('SELECT 1')
    checks.database = { status: 'UP', latency_ms: Date.now() - start }
  } catch (error: any) {
    allHealthy = false
    checks.database = { status: 'DOWN', error: error.message }
  }

  // 2. R2 Storage check
  try {
    const start = Date.now()
    const { isR2Configured } = await import('@/lib/r2')
    checks.storage = {
      status: isR2Configured ? 'UP' : 'CONFIGURED_OFF',
      latency_ms: Date.now() - start
    }
  } catch (error: any) {
    checks.storage = { status: 'DOWN', error: error.message }
  }

  // 3. AI Config check
  try {
    const { getAIConfig } = await import('@/lib/settings')
    const config = await getAIConfig()
    checks.ai = {
      status: config?.default_vendor ? 'UP' : 'UNCONFIGURED'
    }
  } catch (error: any) {
    checks.ai = { status: 'DOWN', error: error.message }
  }

  const status = allHealthy ? 'UP' : 'DEGRADED'
  const httpStatus = allHealthy ? 200 : 503

  return NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    checks,
  }, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    }
  })
}
