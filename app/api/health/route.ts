import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Test database connectivity
    await query('SELECT 1')

    return NextResponse.json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
      },
    })
  } catch (error: any) {
    console.error('Health check failed:', error)
    return NextResponse.json({
      status: 'DOWN',
      timestamp: new Date().toISOString(),
      error: error.message || 'Database connection error',
    }, { status: 503 })
  }
}
