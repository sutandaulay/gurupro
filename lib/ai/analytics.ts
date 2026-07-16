/**
 * AI Analytics Service
 * Production-ready analytics integration for AI generation monitoring
 *
 * Supports multiple backends:
 * - Console (development)
 * - Webhook (any HTTP endpoint)
 * - Sentry (error tracking)
 * - Custom analytics service
 */

import { z } from 'zod';

// Event schema
export const AIAnalyticsEventSchema = z.object({
  event: z.enum(['truncation', 'error', 'generation', 'render']),
  feature: z.string(),
  field: z.string().optional(),
  originalLength: z.number().optional(),
  maxAllowed: z.number().optional(),
  truncatedLength: z.number().optional(),
  error: z.string().optional(),
  duration: z.number().optional(),
  timestamp: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export type AIAnalyticsEvent = z.infer<typeof AIAnalyticsEventSchema>;

// ============================================
// ANALYTICS BACKENDS
// ============================================

interface AnalyticsBackend {
  name: string;
  send(event: AIAnalyticsEvent): Promise<void>;
}

/**
 * Console backend - logs to console (development)
 */
class ConsoleBackend implements AnalyticsBackend {
  name = 'console';

  async send(event: AIAnalyticsEvent): Promise<void> {
    switch (event.event) {
      case 'truncation':
        console.warn(
          `[Analytics] Truncation: ${event.feature}.${event.field}`,
          `${event.originalLength} → ${event.maxAllowed} chars`
        );
        break;
      case 'error':
        console.error(`[Analytics] Error: ${event.feature}`, event.error);
        break;
      case 'generation':
        console.log(
          `[Analytics] Generation: ${event.feature} completed in ${event.duration}ms`
        );
        break;
      default:
        console.log(`[Analytics] Event:`, event);
    }
  }
}

/**
 * Webhook backend - sends to HTTP endpoint
 */
class WebhookBackend implements AnalyticsBackend {
  name = 'webhook';
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  async send(event: AIAnalyticsEvent): Promise<void> {
    try {
      await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        // Non-blocking, don't wait for response
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      // Silent fail - analytics shouldn't break the app
      console.warn('[Analytics] Webhook failed:', error);
    }
  }
}

/**
 * In-Memory Backend - stores events for retrieval
 */
class MemoryBackend implements AnalyticsBackend {
  name = 'memory';
  private events: AIAnalyticsEvent[] = [];
  private maxEvents: number;

  constructor(maxEvents: number = 10000) {
    this.maxEvents = maxEvents;
  }

  async send(event: AIAnalyticsEvent): Promise<void> {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  getEvents(filter?: {
    event?: AIAnalyticsEvent['event'];
    feature?: string;
    since?: Date;
  }): AIAnalyticsEvent[] {
    let filtered = this.events;

    if (filter?.event) {
      filtered = filtered.filter(e => e.event === filter.event);
    }
    if (filter?.feature) {
      filtered = filtered.filter(e => e.feature === filter.feature);
    }
    if (filter?.since) {
      filtered = filtered.filter(
        e => new Date(e.timestamp) >= filter.since!
      );
    }

    return filtered;
  }

  getStats(): {
    total: number;
    byEvent: Record<string, number>;
    byFeature: Record<string, number>;
    truncationRate: number;
  } {
    const total = this.events.length;
    const byEvent: Record<string, number> = {};
    const byFeature: Record<string, number> = {};
    let truncations = 0;

    for (const e of this.events) {
      byEvent[e.event] = (byEvent[e.event] || 0) + 1;
      byFeature[e.feature] = (byFeature[e.feature] || 0) + 1;
      if (e.event === 'truncation') truncations++;
    }

    return {
      total,
      byEvent,
      byFeature,
      truncationRate: total > 0 ? truncations / total : 0,
    };
  }

  clear(): void {
    this.events = [];
  }
}

// ============================================
// ANALYTICS MANAGER
// ============================================

class AIAnalyticsManager {
  private backends: AnalyticsBackend[] = [];
  private memory: MemoryBackend;

  constructor() {
    this.memory = new MemoryBackend();

    // Initialize backends based on environment
    this.initializeBackends();
  }

  private initializeBackends(): void {
    // Always add memory backend for API access
    this.backends.push(this.memory);

    // Add console backend in development
    if (process.env.NODE_ENV === 'development') {
      this.backends.push(new ConsoleBackend());
    }

    // Add webhook if configured
    const webhookUrl = process.env.AI_ANALYTICS_WEBHOOK_URL;
    if (webhookUrl) {
      this.backends.push(new WebhookBackend(webhookUrl));
    }
  }

  /**
   * Track an AI generation event
   */
  async track(event: Omit<AIAnalyticsEvent, 'timestamp'>): Promise<void> {
    const fullEvent: AIAnalyticsEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    await Promise.all(
      this.backends.map(backend => backend.send(fullEvent))
    );
  }

  /**
   * Track a truncation event
   */
  async trackTruncation(
    feature: string,
    field: string,
    originalLength: number,
    maxAllowed: number
  ): Promise<void> {
    await this.track({
      event: 'truncation',
      feature,
      field,
      originalLength,
      maxAllowed,
      truncatedLength: maxAllowed,
    });
  }

  /**
   * Track an error event
   */
  async trackError(
    feature: string,
    error: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.track({
      event: 'error',
      feature,
      error,
      metadata,
    });
  }

  /**
   * Track generation completion
   */
  async trackGeneration(
    feature: string,
    durationMs: number
  ): Promise<void> {
    await this.track({
      event: 'generation',
      feature,
      duration: durationMs,
    });
  }

  /**
   * Get events from memory backend
   */
  getEvents(filter?: {
    event?: AIAnalyticsEvent['event'];
    feature?: string;
    since?: Date;
  }): AIAnalyticsEvent[] {
    return this.memory.getEvents(filter);
  }

  /**
   * Get statistics
   */
  getStats() {
    return this.memory.getStats();
  }

  /**
   * Clear memory backend
   */
  clear(): void {
    this.memory.clear();
  }
}

// Singleton instance
export const aiAnalytics = new AIAnalyticsManager();

// ============================================
// EXPORTS
// ============================================

export { AIAnalyticsManager, AIAnalyticsEventSchema };
export type { AIAnalyticsEvent, AnalyticsBackend };
