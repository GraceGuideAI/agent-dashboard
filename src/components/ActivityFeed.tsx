'use client';

import type { ActivityItem } from '@/lib/types';

interface Props {
  activities: ActivityItem[];
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export default function ActivityFeed({ activities }: Props) {
  const typeIcons = {
    message: '💬',
    tool_call: '🔧',
    completion: '✨',
    error: '❌',
  };

  const typeColors = {
    message: 'text-blue-400',
    tool_call: 'text-purple-400',
    completion: 'text-green-400',
    error: 'text-red-400',
  };

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No recent activity
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="bg-[#111] rounded-lg p-3 border border-gray-800 fade-in"
        >
          <div className="flex items-start gap-2">
            <span className="text-sm">{typeIcons[activity.type]}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className={`text-xs font-medium ${typeColors[activity.type]}`}>
                  {activity.sessionLabel}
                </span>
                <span className="text-[10px] text-gray-600 tabular-nums shrink-0">
                  {formatTime(activity.timestamp)}
                </span>
              </div>
              <p className="text-xs text-gray-400 break-words">{activity.content}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
