import { NextResponse } from 'next/server';
import {
  getAISummary,
  getRecentTruncations,
  getFrequentTruncations,
  exportEvents,
  clearEvents,
} from '@/lib/ai/monitoring';

/**
 * GET /api/ai-monitoring
 * Get AI generation monitoring statistics
 *
 * Query params:
 *   - feature: Filter by feature name
 *   - limit: Limit recent truncations (default: 50)
 *   - minRate: Minimum truncation rate for frequent issues (default: 0.1)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const feature = searchParams.get('feature') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const minRate = parseFloat(searchParams.get('minRate') || '0.1', 10);

    // Get summary
    const summary = getAISummary(feature);

    // Get recent truncations
    const recentTruncations = getRecentTruncations(limit);

    // Get frequent truncation issues
    const frequentIssues = getFrequentTruncations(minRate);

    return NextResponse.json({
      summary,
      recentTruncations,
      frequentIssues,
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
 * Clear all monitoring events (for testing/admin)
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');

    // Simple secret check (in production, use proper auth)
    if (secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    clearEvents();

    return NextResponse.json({
      success: true,
      message: 'All monitoring events cleared',
    });
  } catch (error: any) {
    console.error('[AI Monitoring] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to clear events' },
      { status: 500 }
    );
  }
}
