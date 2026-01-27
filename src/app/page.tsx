'use client';

import { useState, useEffect, useCallback } from 'react';
import SessionCard from '@/components/SessionCard';
import ActivityFeed from '@/components/ActivityFeed';
import StatsBar from '@/components/StatsBar';
import type { Session, ActivityItem, DashboardStats } from '@/lib/types';

const POLL_INTERVAL = 5000; // 5 seconds

export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalSessions: 0,
    activeSessions: 0,
    idleSessions: 0,
    totalMessages: 0,
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [sessionsRes, activityRes] = await Promise.all([
        fetch('/api/sessions'),
        fetch('/api/activity'),
      ]);

      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json();
        setSessions(sessionsData.sessions || []);
        setStats(sessionsData.stats || {
          totalSessions: 0,
          activeSessions: 0,
          idleSessions: 0,
          totalMessages: 0,
        });
      }

      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setActivities(activityData.activities || []);
      }

      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError('Failed to fetch data');
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] pb-8">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Agent Activity</h1>
            <p className="text-xs text-gray-500">
              {lastUpdate ? `Updated ${formatTime(lastUpdate)}` : 'Loading...'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-mono text-gray-300 tabular-nums">
              {formatTime(currentTime)}
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <div className={`w-2 h-2 rounded-full ${stats.activeSessions > 0 ? 'bg-green-500 pulse-active' : 'bg-gray-600'}`} />
              <span className="text-xs text-gray-500">
                {stats.activeSessions > 0 ? 'Working' : 'Idle'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 space-y-6">
        {/* Stats Bar */}
        <StatsBar stats={stats} />

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={fetchData}
              className="mt-2 text-xs text-red-300 underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-8">
            <div className="inline-block w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="mt-2 text-sm text-gray-500">Loading sessions...</p>
          </div>
        )}

        {/* Active Sessions */}
        {!isLoading && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
              <span>Sessions</span>
              <span className="text-xs text-gray-600">({sessions.length})</span>
            </h2>
            {sessions.length > 0 ? (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            ) : (
              <div className="bg-[#111] rounded-xl p-6 text-center border border-gray-800">
                <p className="text-gray-500 text-sm">No active sessions</p>
                <p className="text-gray-600 text-xs mt-1">Agents will appear here when working</p>
              </div>
            )}
          </section>
        )}

        {/* Activity Feed */}
        {!isLoading && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 mb-3">
              Recent Activity
            </h2>
            <ActivityFeed activities={activities} />
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur-sm border-t border-gray-800 px-4 py-2">
        <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
          <span>Clawdbot Dashboard</span>
          <span>•</span>
          <span>Polling every {POLL_INTERVAL / 1000}s</span>
        </div>
      </footer>
    </main>
  );
}
