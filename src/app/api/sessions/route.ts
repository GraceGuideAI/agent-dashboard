import { NextResponse } from 'next/server';
import type { Session, DashboardStats } from '@/lib/types';

// Gateway URL - configurable via env
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:4445';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || '';

interface GatewaySession {
  session_id: string;
  label?: string;
  channel: string;
  model?: string;
  created_at: string;
  last_activity?: string;
  message_count?: number;
  status?: string;
}

async function fetchGatewaySessions(): Promise<GatewaySession[]> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (GATEWAY_TOKEN) {
      headers['Authorization'] = `Bearer ${GATEWAY_TOKEN}`;
    }

    const response = await fetch(`${GATEWAY_URL}/sessions/list`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Gateway response not ok:', response.status);
      return [];
    }

    const data = await response.json();
    return data.sessions || [];
  } catch (error) {
    console.error('Error fetching from gateway:', error);
    return [];
  }
}

function parseSessionLabel(sessionId: string, label?: string): string {
  if (label) return label;
  
  // Parse session ID format: agent:main:subagent:uuid or similar
  const parts = sessionId.split(':');
  if (parts.length >= 3) {
    if (parts[2] === 'subagent') {
      return `Subagent ${parts[3]?.slice(0, 8) || 'unknown'}`;
    }
    return parts.slice(1).join(':');
  }
  return sessionId.slice(0, 20);
}

function determineStatus(session: GatewaySession): 'active' | 'idle' | 'processing' {
  const lastActivity = session.last_activity ? new Date(session.last_activity) : new Date(session.created_at);
  const now = new Date();
  const diffMs = now.getTime() - lastActivity.getTime();
  const diffMinutes = diffMs / (1000 * 60);

  // If activity within last 30 seconds, likely processing
  if (diffMinutes < 0.5) return 'processing';
  // If activity within last 5 minutes, active
  if (diffMinutes < 5) return 'active';
  // Otherwise idle
  return 'idle';
}

export async function GET() {
  const gatewaySessions = await fetchGatewaySessions();

  const sessions: Session[] = gatewaySessions.map((gs) => ({
    id: gs.session_id,
    label: parseSessionLabel(gs.session_id, gs.label),
    status: determineStatus(gs),
    task: gs.channel ? `Channel: ${gs.channel}` : undefined,
    startedAt: gs.created_at,
    lastActivity: gs.last_activity || gs.created_at,
    messageCount: gs.message_count || 0,
    model: gs.model,
  }));

  // Sort: processing first, then active, then idle
  sessions.sort((a, b) => {
    const order = { processing: 0, active: 1, idle: 2 };
    return order[a.status] - order[b.status];
  });

  const stats: DashboardStats = {
    totalSessions: sessions.length,
    activeSessions: sessions.filter(s => s.status === 'active' || s.status === 'processing').length,
    idleSessions: sessions.filter(s => s.status === 'idle').length,
    totalMessages: sessions.reduce((sum, s) => sum + s.messageCount, 0),
  };

  return NextResponse.json({ sessions, stats });
}
