import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * GET /api/ai-alerts
 * Get current alert status and statistics from the persistent TokenUsage table.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');

    if (process.env.NODE_ENV === 'production' && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const statsRes = await query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) AS error_count
       FROM "TokenUsage"`
    );
    const total = Number(statsRes.rows?.[0]?.total) || 0;
    const errorCount = Number(statsRes.rows?.[0]?.error_count) || 0;
    const errorRate = total > 0 ? errorCount / total : 0;

    const config = {
      truncationRateThreshold: 0.15,
      errorRateThreshold: 0.05,
      cooldownMinutes: 30,
    };

    const alerts: any[] = [];
    if (errorRate > config.errorRateThreshold) {
      alerts.push({
        type: 'high_error_rate',
        severity: errorRate > 0.3 ? 'critical' : 'warning',
        title: 'High AI Error Rate',
        message: `${(errorRate * 100).toFixed(1)}% of AI generations are failing.`,
        data: { 'Error Rate': `${(errorRate * 100).toFixed(1)}%`, 'Total Errors': errorCount },
      });
    }

    return NextResponse.json({
      stats: { total, errorCount, errorRate },
      alertsTriggered: alerts.length,
      recentAlerts: alerts,
      config,
    });
  } catch (error) {
    console.error('[AI Alerts] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get alert status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai-alerts/check
 * Trigger an alert check manually (reads persistent TokenUsage stats)
 */
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const statsRes = await query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) AS error_count
       FROM "TokenUsage"`
    );
    const total = Number(statsRes.rows?.[0]?.total) || 0;
    const errorCount = Number(statsRes.rows?.[0]?.error_count) || 0;
    const errorRate = total > 0 ? errorCount / total : 0;

    const alerts: any[] = [];
    if (errorRate > 0.05) {
      alerts.push({
        type: 'high_error_rate',
        severity: errorRate > 0.3 ? 'critical' : 'warning',
        title: 'High AI Error Rate',
        message: `${(errorRate * 100).toFixed(1)}% of AI generations are failing.`,
        data: { 'Error Rate': `${(errorRate * 100).toFixed(1)}%`, 'Total Errors': errorCount },
      });
    }

    return NextResponse.json({
      success: true,
      alertsTriggered: alerts.length,
      alerts,
    });
  } catch (error) {
    console.error('[AI Alerts] POST error:', error);
    return NextResponse.json(
      { error: 'Alert check failed' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai-alerts
 * Clear analytics data (requires secret)
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      message: 'Alert data is derived from TokenUsage; nothing to clear here.',
    });
  } catch (error) {
    console.error('[AI Alerts] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to clear analytics data' },
      { status: 500 }
    );
  }
}
