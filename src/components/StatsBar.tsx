'use client';

import type { DashboardStats } from '@/lib/types';

interface Props {
  stats: DashboardStats;
}

export default function StatsBar({ stats }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <div className="bg-[#111] rounded-lg p-3 text-center border border-gray-800">
        <div className="text-lg font-bold text-white">{stats.totalSessions}</div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wide">Total</div>
      </div>
      <div className="bg-[#111] rounded-lg p-3 text-center border border-green-500/20">
        <div className="text-lg font-bold text-green-500">{stats.activeSessions}</div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wide">Active</div>
      </div>
      <div className="bg-[#111] rounded-lg p-3 text-center border border-gray-800">
        <div className="text-lg font-bold text-gray-400">{stats.idleSessions}</div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wide">Idle</div>
      </div>
      <div className="bg-[#111] rounded-lg p-3 text-center border border-purple-500/20">
        <div className="text-lg font-bold text-purple-400">{stats.totalMessages}</div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wide">Msgs</div>
      </div>
    </div>
  );
}
