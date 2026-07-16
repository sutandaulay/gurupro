import { NextResponse } from 'next/server';
import { aiAnalytics } from '@/lib/ai/analytics';
import { alertManager, runAlertChecks } from '@/lib/ai/alerts';

/**
 * GET /api/ai-alerts
 * Get current alert status and statistics
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');

    // Basic protection (in production, use proper auth)
    if (process.env.NODE_ENV === 'production' && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = aiAnalytics.getStats();
    const alerts = await runAlertChecks();

    return NextResponse.json({
      stats,
      alertsTriggered: alerts.length,
      recentAlerts: alerts,
      config: {
        truncationRateThreshold: 0.15,
        errorRateThreshold: 0.05,
        cooldownMinutes: 30,
      },
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
 * Trigger an alert check manually
 */
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const alerts = await runAlertChecks();

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

    aiAnalytics.clear();

    return NextResponse.json({
      success: true,
      message: 'All analytics data cleared',
    });
  } catch (error) {
    console.error('[AI Alerts] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to clear data' },
      { status: 500 }
    );
  }
}
