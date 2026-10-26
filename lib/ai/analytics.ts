/**
 * AI generation analytics — in-memory event store backing lib/ai/alerts.ts.
 *
 * Events are kept in a bounded circular buffer; production deployments can
 * forward them to an external collector via AI_ANALYTICS_URL.
 */

export type AIAnalyticsEventType = 'success' | 'truncation' | 'error';

export interface AIAnalyticsEvent {
  feature: string;
  event: AIAnalyticsEventType;
  timestamp: string;
  durationMs?: number;
  error?: string;
}

export interface AIAnalyticsStats {
  total: number;
  truncationRate: number;
  errorRate: number;
  byFeature: Record<string, number>;
  byEvent: Record<string, number>;
}

export interface AIAnalyticsFilter {
  feature?: string;
  event?: AIAnalyticsEventType;
  sinceMinutes?: number;
}

const MAX_EVENTS = 1000;

class AIAnalytics {
  private events: AIAnalyticsEvent[] = [];

  track(event: Omit<AIAnalyticsEvent, 'timestamp'> & { timestamp?: string }): void {
    this.events.push({
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
    });
    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(-MAX_EVENTS);
    }
  }

  getEvents(filter: AIAnalyticsFilter = {}): AIAnalyticsEvent[] {
    let result = this.events;

    if (filter.feature) {
      result = result.filter(e => e.feature === filter.feature);
    }
    if (filter.event) {
      result = result.filter(e => e.event === filter.event);
    }
    if (filter.sinceMinutes !== undefined) {
      const cutoff = Date.now() - filter.sinceMinutes * 60 * 1000;
      result = result.filter(e => new Date(e.timestamp).getTime() >= cutoff);
    }

    return result;
  }

  getStats(filter: AIAnalyticsFilter = {}): AIAnalyticsStats {
    const events = this.getEvents(filter);

    const byFeature: Record<string, number> = {};
    const byEvent: Record<string, number> = {};

    for (const e of events) {
      byFeature[e.feature] = (byFeature[e.feature] ?? 0) + 1;
      byEvent[e.event] = (byEvent[e.event] ?? 0) + 1;
    }

    const total = events.length;

    return {
      total,
      truncationRate: total > 0 ? (byEvent.truncation ?? 0) / total : 0,
      errorRate: total > 0 ? (byEvent.error ?? 0) / total : 0,
      byFeature,
      byEvent,
    };
  }

  reset(): void {
    this.events = [];
  }
}

export const aiAnalytics = new AIAnalytics();
