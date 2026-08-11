'use client';
import { apiFetch } from "@/lib/api-client";
import { useState, useEffect } from 'react';

interface AnalyticsEvent {
  event: 'truncation' | 'error' | 'generation' | 'render';
  feature: string;
  field?: string;
  originalLength?: number;
  maxAllowed?: number;
  error?: string;
  duration?: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface AnalyticsStats {
  total: number;
  byEvent: Record<string, number>;
  byFeature: Record<string, number>;
  truncationRate: number;
}

export default function AIMonitoringDashboard() {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  async function fetchAnalytics() {
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('feature', filter);
      const res = await apiFetch(`/api/ai-monitoring?${params}`);
      const data = await res.json();
      setEvents(data.recentTruncations || []);
      setStats(data.summary || null);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAnalytics(); }, [filter]);
  useEffect(() => {
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, [filter]);

  function formatTime(ts: string) {
    return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function StatCard({ title, value, color }: { title: string; value: string; color: string }) {
    const colors: Record<string, string> = {
      blue: 'bg-blue-50 text-blue-600 border-blue-200',
      amber: 'bg-amber-50 text-amber-600 border-amber-200',
      red: 'bg-red-50 text-red-600 border-red-200',
      green: 'bg-green-50 text-green-600 border-green-200',
    };
    return (
      <div className={`rounded-lg border p-4 ${colors[color] || colors.blue}`}>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm opacity-75">{title}</div>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI Generation Monitoring</h1>
        <button onClick={fetchAnalytics} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Refresh</button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Total Events" value={stats.total.toLocaleString()} color="blue" />
          <StatCard title="Truncations" value={(stats.byEvent.truncation || 0).toLocaleString()} color="amber" />
          <StatCard title="Errors" value={(stats.byEvent.error || 0).toLocaleString()} color="red" />
          <StatCard title="Truncation Rate" value={`${(stats.truncationRate * 100).toFixed(1)}%`} color={stats.truncationRate > 0.1 ? 'red' : 'green'} />
        </div>
      )}

      <div className="flex gap-4 items-center">
        <label className="text-sm font-medium">Filter:</label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="all">All</option>
          <option value="silabus">Silabus/ATP</option>
          <option value="lkpd">LKPD</option>
          <option value="laporanEvaluasi">Laporan Evaluasi LKPD</option>
          <option value="raport">Raport</option>
          <option value="bankSoal">Bank Soal</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="text-lg font-medium">Recent Truncation Events</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Feature</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Field</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Overflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {events.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No events recorded</td></tr>
              ) : events.map((e, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatTime(e.timestamp)}</td>
                  <td className="px-4 py-3 text-sm font-medium">{e.feature}</td>
                  <td className="px-4 py-3 text-sm">{e.field || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{e.originalLength || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{e.maxAllowed || '-'}</td>
                  <td className="px-4 py-3 text-sm text-red-600">+{((e.originalLength || 0) - (e.maxAllowed || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
