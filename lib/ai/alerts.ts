/**
 * AI Generation Alerting System
 * Alerts when truncation rate or error rate exceeds thresholds
 *
 * Supports:
 * - Console logging (development)
 * - Webhook notifications (Slack, Discord, Teams, custom)
 * - Email (via webhook to email service)
 */

import { aiAnalytics, type AIAnalyticsEvent } from './analytics';

// Alert configuration
interface AlertConfig {
  // Thresholds
  truncationRateThreshold: number; // e.g., 0.15 = 15%
  errorRateThreshold: number; // e.g., 0.05 = 5%
  windowMinutes: number; // Time window for calculation

  // Alert destinations
  webhookUrl?: string;
  slackWebhookUrl?: string;
  emailTo?: string[];

  // Cooldown to prevent alert spam
  cooldownMinutes: number;
}

const DEFAULT_CONFIG: AlertConfig = {
  truncationRateThreshold: 0.15,
  errorRateThreshold: 0.05,
  windowMinutes: 60,
  cooldownMinutes: 30,
};

// Alert types
export type AlertType =
  | 'high_truncation_rate'
  | 'high_error_rate'
  | 'feature_issue'
  | 'system_issue';

export interface Alert {
  type: AlertType;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// Alert manager
class AlertManager {
  private config: AlertConfig;
  private lastAlertTime: Record<AlertType, number> = {
    high_truncation_rate: 0,
    high_error_rate: 0,
    feature_issue: 0,
    system_issue: 0,
  };

  constructor(config: Partial<AlertConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if we should alert (respecting cooldown)
   */
  private shouldAlert(type: AlertType): boolean {
    const lastAlert = this.lastAlertTime[type] || 0;
    const cooldownMs = this.config.cooldownMinutes * 60 * 1000;
    return Date.now() - lastAlert > cooldownMs;
  }

  /**
   * Record that we sent an alert
   */
  private recordAlert(type: AlertType): void {
    this.lastAlertTime[type] = Date.now();
  }

  /**
   * Send alert to configured destinations
   */
  private async sendAlert(alert: Alert): Promise<void> {
    // Send to webhook
    if (this.config.webhookUrl) {
      await this.sendWebhook(this.config.webhookUrl, alert);
    }

    // Send to Slack
    if (this.config.slackWebhookUrl) {
      await this.sendSlack(this.config.slackWebhookUrl, alert);
    }

    // Log to console
    console.warn(`[Alert] ${alert.type}: ${alert.message}`, alert.data);
  }

  private async sendWebhook(url: string, alert: Alert): Promise<void> {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert: alert.type,
          severity: alert.severity,
          message: alert.message,
          data: alert.data,
          timestamp: alert.timestamp,
        }),
        signal: AbortSignal.timeout(10000),
      });
    } catch (error) {
      console.error('[Alert] Webhook failed:', error);
    }
  }

  private async sendSlack(webhookUrl: string, alert: Alert): Promise<void> {
    const color = {
      info: '#36a64f',
      warning: '#ff9800',
      critical: '#f44336',
    }[alert.severity];

    const fields = Object.entries(alert.data)
      .map(([k, v]) => ({
        type: 'mrkdwn' as const,
        text: `*${k}*: ${v}`,
      }));

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachments: [
            {
              color,
              title: alert.title,
              text: alert.message,
              fields,
              ts: Math.floor(Date.now() / 1000),
            },
          ],
        }),
        signal: AbortSignal.timeout(10000),
      });
    } catch (error) {
      console.error('[Alert] Slack webhook failed:', error);
    }
  }

  /**
   * Check metrics and trigger alerts if needed
   */
  async checkAndAlert(): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const stats = aiAnalytics.getStats();

    // Check truncation rate
    if (stats.truncationRate > this.config.truncationRateThreshold) {
      if (this.shouldAlert('high_truncation_rate')) {
        const alert: Alert = {
          type: 'high_truncation_rate',
          severity: stats.truncationRate > 0.3 ? 'critical' : 'warning',
          title: 'High Truncation Rate Detected',
          message: `${(stats.truncationRate * 100).toFixed(1)}% of AI outputs are being truncated. Consider adjusting limits.`,
          data: {
            'Truncation Rate': `${(stats.truncationRate * 100).toFixed(1)}%`,
            'Threshold': `${(this.config.truncationRateThreshold * 100).toFixed(0)}%`,
            'Total Events': stats.total,
          },
          timestamp: new Date().toISOString(),
        };
        alerts.push(alert);
        await this.sendAlert(alert);
        this.recordAlert('high_truncation_rate');
      }
    }

    // Check error rate
    const errorRate = (stats.byEvent.error || 0) / Math.max(stats.total, 1);
    if (errorRate > this.config.errorRateThreshold) {
      if (this.shouldAlert('high_error_rate')) {
        const alert: Alert = {
          type: 'high_error_rate',
          severity: 'critical',
          title: 'High AI Error Rate',
          message: `${(errorRate * 100).toFixed(1)}% of AI generations are failing.`,
          data: {
            'Error Rate': `${(errorRate * 100).toFixed(1)}%`,
            'Threshold': `${(this.config.errorRateThreshold * 100).toFixed(0)}%`,
            'Total Errors': stats.byEvent.error || 0,
          },
          timestamp: new Date().toISOString(),
        };
        alerts.push(alert);
        await this.sendAlert(alert);
        this.recordAlert('high_error_rate');
      }
    }

    return alerts;
  }

  /**
   * Check for feature-specific issues
   */
  async checkFeatureIssues(): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const stats = aiAnalytics.getStats();

    // Check each feature for high truncation
    for (const [feature, count] of Object.entries(stats.byFeature)) {
      if (count < 10) continue; // Skip features with too few events

      const featureEvents = aiAnalytics.getEvents({ feature });
      const truncations = featureEvents.filter(e => e.event === 'truncation').length;
      const rate = truncations / count;

      if (rate > this.config.truncationRateThreshold) {
        if (this.shouldAlert('feature_issue')) {
          const alert: Alert = {
            type: 'feature_issue',
            severity: 'warning',
            title: `Issue with ${feature}`,
            message: `${feature} has ${(rate * 100).toFixed(0)}% truncation rate.`,
            data: {
              Feature: feature,
              'Truncation Rate': `${(rate * 100).toFixed(1)}%`,
              'Total Events': count,
            },
            timestamp: new Date().toISOString(),
          };
          alerts.push(alert);
          await this.sendAlert(alert);
          this.recordAlert('feature_issue');
        }
      }
    }

    return alerts;
  }
}

// Singleton instance
export const alertManager = new AlertManager();

// ============================================
// ALERT CHECKER JOB
// ============================================

/**
 * Run alert checks periodically
 * Call this from a cron job or background task
 */
export async function runAlertChecks(): Promise<Alert[]> {
  const allAlerts: Alert[] = [];

  const [rateAlerts, featureAlerts] = await Promise.all([
    alertManager.checkAndAlert(),
    alertManager.checkFeatureIssues(),
  ]);

  allAlerts.push(...rateAlerts, ...featureAlerts);

  return allAlerts;
}

// ============================================
// API ENDPOINT
// ============================================

import { NextResponse } from 'next/server';

/**
 * POST /api/ai-alerts/check
 * Trigger an alert check manually
 */
export async function POST(req: Request) {
  try {
    // Verify secret
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
    console.error('[Alert Check] Error:', error);
    return NextResponse.json(
      { error: 'Alert check failed' },
      { status: 500 }
    );
  }
}

// ============================================
// EXPORTS
// ============================================

export { AlertManager, AlertConfig, Alert, AlertType };
