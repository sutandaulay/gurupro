/**
 * AI Generation Monitoring Utility
 * Track output lengths, truncation events, and rendering issues
 *
 * Usage:
 *   import { trackAIOutput } from '@/lib/ai/monitoring';
 *   trackAIOutput('silabus', { field: 'topik', length: 150, maxAllowed: 100 });
 */

import { z } from 'zod';

// Schema for tracking events
export const AIOutputEventSchema = z.object({
  feature: z.string(),
  field: z.string(),
  originalLength: z.number(),
  maxAllowed: z.number(),
  wasTruncated: z.boolean(),
  timestamp: z.string(),
});

export type AIOutputEvent = z.infer<typeof AIOutputEventSchema>;

// In-memory store for development/testing
// In production, this would send to your analytics service
let eventStore: AIOutputEvent[] = [];
const MAX_EVENTS = 1000;

// Track an AI output event
export function trackAIOutput(
  feature: string,
  data: {
    field: string;
    originalLength: number;
    maxAllowed: number;
  }
): void {
  const event: AIOutputEvent = {
    feature,
    field: data.field,
    originalLength: data.originalLength,
    maxAllowed: data.maxAllowed,
    wasTruncated: data.originalLength > data.maxAllowed,
    timestamp: new Date().toISOString(),
  };

  // Store event (circular buffer)
  eventStore.push(event);
  if (eventStore.length > MAX_EVENTS) {
    eventStore = eventStore.slice(-MAX_EVENTS);
  }

  // Log for development
  if (process.env.NODE_ENV === 'development') {
    if (event.wasTruncated) {
      console.warn(
        `[AI Monitor] ${feature}.${data.field} truncated:`,
        `${data.originalLength} → ${data.maxAllowed} chars`
      );
    }
  }

  // TODO: Send to analytics service in production
  // e.g., sendToAnalytics(event);
}

// Track multiple fields at once
export function trackAIMultiple(
  feature: string,
  fields: Record<string, { length: number; maxAllowed: number }>
): void {
  for (const [field, data] of Object.entries(fields)) {
    trackAIOutput(feature, { field, ...data });
  }
}

// Get summary statistics
export function getAISummary(feature?: string): {
  totalEvents: number;
  truncatedCount: number;
  truncationRate: number;
  byField: Record<string, { count: number; truncated: number }>;
} {
  const events = feature
    ? eventStore.filter(e => e.feature === feature)
    : eventStore;

  const truncated = events.filter(e => e.wasTruncated);
  const byField: Record<string, { count: number; truncated: number }> = {};

  for (const event of events) {
    if (!byField[event.field]) {
      byField[event.field] = { count: 0, truncated: 0 };
    }
    byField[event.field].count++;
    if (event.wasTruncated) {
      byField[event.field].truncated++;
    }
  }

  return {
    totalEvents: events.length,
    truncatedCount: truncated.length,
    truncationRate: events.length > 0 ? truncated.length / events.length : 0,
    byField,
  };
}

// Get recent truncation events
export function getRecentTruncations(limit: number = 50): AIOutputEvent[] {
  return eventStore
    .filter(e => e.wasTruncated)
    .slice(-limit);
}

// Get fields that are frequently truncated (potential for limit adjustment)
export function getFrequentTruncations(minRate: number = 0.1): {
  field: string;
  feature: string;
  rate: number;
  avgOriginal: number;
  avgMax: number;
}[] {
  const stats = getAISummary();

  return Object.entries(stats.byField)
    .map(([field, data]) => ({
      field,
      feature: 'all',
      rate: data.truncated / data.count,
      avgOriginal: 0, // Would need to track this separately
      avgMax: 0,
    }))
    .filter(s => s.rate >= minRate)
    .sort((a, b) => b.rate - a.rate);
}

// Clear all events (for testing)
export function clearEvents(): void {
  eventStore = [];
}

// Export events for external processing
export function exportEvents(): AIOutputEvent[] {
  return [...eventStore];
}

// ============================================
// PRESET TRACKING HELPERS
// ============================================

export const FEATURE_LIMITS = {
  silabus: {
    topik: 100,
    tujuanPembelajaran: 200,
    kataKunciMateri: 50,
    catatanKokurikuler: 300,
    capaianPembelajaran: 2000,
  },
  lkpd: {
    instruksi: 400,
    tujuanKegiatan: 300,
    petunjukPengerjaan: 150,
    refleksiSingkat: 200,
  },
  laporanEvaluasi: {
    ringkasanEksekutif: 500,
    temuanUtama: 300,
    rekomendasiTindakLanjut: 250,
  },
  raport: {
    deskripsi: 500,
    saran: 200,
  },
  bankSoal: {
    pertanyaan: 500,
    opsi: 150,
    pembahasan: 300,
  },
} as const;

export default {
  trackAIOutput,
  trackAIMultiple,
  getAISummary,
  getRecentTruncations,
  getFrequentTruncations,
  clearEvents,
  exportEvents,
  FEATURE_LIMITS,
};
