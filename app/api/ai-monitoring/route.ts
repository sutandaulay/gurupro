import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * GET /api/ai-monitoring
 * Get AI generation monitoring statistics from the persistent TokenUsage table.
 *
 * Query params:
 *   - feature: Filter by feature name
 *   - limit: Limit recent failures (default: 50)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const feature = searchParams.get('feature') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const featureFilter = feature ? 'WHERE feature = $1' : '';
    const params: any[] = feature ? [feature] : [];

    // Summary per feature
    const summaryRes = await query(
      `SELECT
         feature,
         COUNT(*) AS total,
         SUM(CASE WHEN success THEN 1 ELSE 0 END) AS success_count,
         SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) AS error_count,
         SUM(tokens_charged) AS tokens_charged,
         SUM(total_cost_idr) AS total_cost_idr
       FROM "TokenUsage"
       ${featureFilter}
       GROUP BY feature
       ORDER BY total DESC`,
      params
    );

    // Recent failures
    const failParams: any[] = feature ? [feature, limit] : [limit];
    const failFilter = feature ? 'WHERE feature = $1' : '';
    const recentFailures = await query(
      `SELECT id, user_id, feature, model, provider, error_message, duration_ms, created_at
       FROM "TokenUsage"
       ${failFilter} AND success = false
       ORDER BY created_at DESC
       LIMIT $${feature ? 2 : 1}`,
      failParams
    );

    const summary = (summaryRes.rows || []).map((r: any) => {
      const total = Number(r.total) || 0;
      const errorCount = Number(r.error_count) || 0;
      return {
        feature: r.feature,
        total,
        successCount: Number(r.success_count) || 0,
        errorCount,
        errorRate: total > 0 ? errorCount / total : 0,
        tokensCharged: Number(r.tokens_charged) || 0,
        totalCostIdr: Number(r.total_cost_idr) || 0,
      };
    });

    const totalEvents = summary.reduce((a, b) => a + b.total, 0);
    const totalErrors = summary.reduce((a, b) => a + b.errorCount, 0);

    return NextResponse.json({
      summary,
      totalEvents,
      totalErrors,
      errorRate: totalEvents > 0 ? totalErrors / totalEvents : 0,
      recentFailures: recentFailures.rows || [],
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[AI Monitoring] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get monitoring data' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai-monitoring
 * Clear monitoring data (admin only, via secret)
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');

    if (secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await query(`DELETE FROM "TokenUsage" WHERE success = true`);

    return NextResponse.json({
      success: true,
      message: 'All successful usage logs cleared',
    });
  } catch (error: any) {
    console.error('[AI Monitoring] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to clear events' },
      { status: 500 }
    );
  }
}
