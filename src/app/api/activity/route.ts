import { NextResponse } from 'next/server';
import type { ActivityItem } from '@/lib/types';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:4445';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || '';

interface GatewayHistoryEntry {
  role: string;
  content?: string;
  timestamp?: string;
  tool_calls?: Array<{ function?: { name?: string } }>;
}

interface GatewayHistoryResponse {
  session_id: string;
  label?: string;
  history?: GatewayHistoryEntry[];
}

async function fetchSessionHistory(sessionId: string): Promise<GatewayHistoryResponse | null> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (GATEWAY_TOKEN) {
      headers['Authorization'] = `Bearer ${GATEWAY_TOKEN}`;
    }

    const response = await fetch(`${GATEWAY_URL}/sessions/history?session_id=${encodeURIComponent(sessionId)}&limit=10`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchAllSessions(): Promise<string[]> {
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

    if (!response.ok) return [];
    const data = await response.json();
    return (data.sessions || []).map((s: { session_id: string }) => s.session_id);
  } catch {
    return [];
  }
}

function parseLabel(sessionId: string, label?: string): string {
  if (label) return label;
  const parts = sessionId.split(':');
  if (parts.length >= 3 && parts[2] === 'subagent') {
    return `Subagent ${parts[3]?.slice(0, 8) || ''}`;
  }
  return sessionId.slice(0, 16);
}

export async function GET() {
  const sessionIds = await fetchAllSessions();
  const activities: ActivityItem[] = [];

  // Fetch history from recent sessions (limit to 5 for performance)
  const recentSessions = sessionIds.slice(0, 5);
  
  for (const sessionId of recentSessions) {
    const history = await fetchSessionHistory(sessionId);
    if (!history?.history) continue;

    const label = parseLabel(sessionId, history.label);

    for (const entry of history.history.slice(-5)) {
      let type: ActivityItem['type'] = 'message';
      let content = '';

      if (entry.role === 'assistant') {
        if (entry.tool_calls?.length) {
          type = 'tool_call';
          const toolNames = entry.tool_calls.map(tc => tc.function?.name || 'unknown').join(', ');
          content = `Tool calls: ${toolNames}`;
        } else if (entry.content) {
          type = 'completion';
          content = entry.content.slice(0, 100) + (entry.content.length > 100 ? '...' : '');
        }
      } else if (entry.role === 'user') {
        type = 'message';
        content = typeof entry.content === 'string' 
          ? entry.content.slice(0, 100) + (entry.content.length > 100 ? '...' : '')
          : 'User message';
      }

      if (content) {
        activities.push({
          id: `${sessionId}-${entry.timestamp || Date.now()}-${Math.random()}`,
          sessionId,
          sessionLabel: label,
          type,
          content,
          timestamp: entry.timestamp || new Date().toISOString(),
        });
      }
    }
  }

  // Sort by timestamp descending
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({ activities: activities.slice(0, 20) });
}
