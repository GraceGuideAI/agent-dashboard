'use client';

import type { Session } from '@/lib/types';

interface Props {
  session: Session;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

function formatDuration(startStr: string): string {
  const start = new Date(startStr);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHour = Math.floor(diffMin / 60);

  if (diffMin < 60) return `${diffMin}m`;
  return `${diffHour}h ${diffMin % 60}m`;
}

export default function SessionCard({ session }: Props) {
  const statusColors = {
    processing: 'bg-purple-500',
    active: 'bg-green-500',
    idle: 'bg-gray-500',
  };

  const statusPulse = {
    processing: 'pulse-processing',
    active: 'pulse-active',
    idle: '',
  };

  const borderColors = {
    processing: 'border-purple-500/30',
    active: 'border-green-500/30',
    idle: 'border-gray-700',
  };

  return (
    <div className={`bg-[#111] rounded-xl p-4 border ${borderColors[session.status]} fade-in`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${statusColors[session.status]} ${statusPulse[session.status]}`} />
          <div>
            <h3 className="font-medium text-white text-sm">{session.label}</h3>
            <p className="text-xs text-gray-500 capitalize">{session.status}</p>
          </div>
        </div>
        <span className="text-xs text-gray-500 tabular-nums">
          {formatDuration(session.startedAt)}
        </span>
      </div>

      {session.task && (
        <p className="text-xs text-gray-400 mb-3 line-clamp-2">{session.task}</p>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{session.messageCount} messages</span>
        <span>Last: {formatTimeAgo(session.lastActivity)}</span>
      </div>

      {session.model && (
        <div className="mt-2 pt-2 border-t border-gray-800">
          <span className="text-[10px] text-gray-600 font-mono">{session.model}</span>
        </div>
      )}
    </div>
  );
}
