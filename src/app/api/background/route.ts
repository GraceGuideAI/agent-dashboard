import { NextResponse } from 'next/server';

const GATEWAY_URL = process.env.GATEWAY_URL;
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || process.env.AUTH_TOKEN || '';
const BACKGROUND_TOOL = process.env.GATEWAY_BACKGROUND_TOOL;

interface GatewayHistoryEntry {
  role: string;
  content?: string;
  timestamp?: string;
  tool_calls?: Array<{ function?: { name?: string } }>;
}

interface GatewayHistoryResponse {
  session_id?: string;
  sessionKey?: string;
  label?: string;
  history?: GatewayHistoryEntry[];
  messages?: GatewayHistoryEntry[];
}

interface BackgroundItem {
  id: string;
  title: string;
  status?: string;
  detail?: string;
  source?: string;
  timestamp: string;
}

function buildHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (GATEWAY_TOKEN) {
    headers['Authorization'] = `Bearer ${GATEWAY_TOKEN}`;
  }
  return headers;
}

function parseGatewayResult(result: unknown) {
  if (!result) return result;
  const record = result as Record<string, unknown>;
  const content = record.content as Array<{ type?: string; text?: string }> | undefined;
  if (content && content[0]?.text) {
    try {
      return JSON.parse(content[0].text);
    } catch {
      return result;
    }
  }
  return result;
}

async function invokeGateway(tool: string, args: Record<string, unknown>) {
  if (!GATEWAY_URL) return null;
  const response = await fetch(`${GATEWAY_URL}/tools/invoke`, {
    method: 'POST',
    headers: buildHeaders(),
    cache: 'no-store',
    body: JSON.stringify({ tool, args }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return parseGatewayResult(data?.result ?? null);
}

function coerceString(value: unknown) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function coerceTimestamp(value: unknown) {
  const candidate = coerceString(value);
  if (!candidate) return undefined;
  const date = new Date(candidate);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function normalizeRuns(tool: string, result: unknown): BackgroundItem[] {
  const runs =
    (Array.isArray(result) && result) ||
    (Array.isArray((result as { runs?: unknown[] })?.runs) && (result as { runs: unknown[] }).runs) ||
    (Array.isArray((result as { items?: unknown[] })?.items) && (result as { items: unknown[] }).items) ||
    (Array.isArray((result as { records?: unknown[] })?.records) && (result as { records: unknown[] }).records) ||
    (Array.isArray((result as { events?: unknown[] })?.events) && (result as { events: unknown[] }).events) ||
    [];

  return runs.map((run, index) => {
    const record = run as Record<string, unknown>;
    const id =
      coerceString(record.id) ||
      coerceString(record.run_id) ||
      coerceString(record.task_id) ||
      coerceString(record.event_id) ||
      `${tool}-${index}-${Date.now()}`;
    const title =
      coerceString(record.name) ||
      coerceString(record.task) ||
      coerceString(record.job) ||
      coerceString(record.title) ||
      coerceString(record.type) ||
      tool;
    const status = coerceString(record.status) || coerceString(record.state);
    const detail =
      coerceString(record.message) ||
      coerceString(record.summary) ||
      coerceString(record.result) ||
      coerceString(record.output) ||
      coerceString(record.error);
    const timestamp =
      coerceTimestamp(record.timestamp) ||
      coerceTimestamp(record.started_at) ||
      coerceTimestamp(record.created_at) ||
      coerceTimestamp(record.time) ||
      new Date().toISOString();

    return {
      id,
      title,
      status,
      detail: detail ? detail.slice(0, 140) : undefined,
      source: tool,
      timestamp,
    };
  });
}

async function fetchBackgroundRuns(): Promise<BackgroundItem[] | null> {
  const tools = [
    BACKGROUND_TOOL,
    'cron_runs_list',
    'cron_history',
    'background_runs_list',
    'task_history',
    'tasks_history',
    'system_events_list',
  ].filter(Boolean) as string[];

  for (const tool of tools) {
    const result = await invokeGateway(tool, { limit: 20 });
    if (!result) continue;
    const normalized = normalizeRuns(tool, result);
    if (normalized.length > 0) return normalized;
  }

  return null;
}

async function fetchSessionHistory(sessionId: string): Promise<GatewayHistoryResponse | null> {
  const result = await invokeGateway('sessions_history', { sessionKey: sessionId, limit: 20 });
  return (result as GatewayHistoryResponse) ?? null;
}

async function fetchAllSessions(): Promise<string[]> {
  const result = await invokeGateway('sessions_list', {});
  const sessions = (result as { sessions?: Array<{ session_id?: string; key?: string }> })?.sessions || [];
  return sessions.map((s) => s.session_id || s.key || '').filter(Boolean);
}

async function fetchMainSession(): Promise<string | null> {
  const sessions = await fetchAllSessions();
  return sessions.find((s) => s.includes(':main:main')) || sessions[0] || null;
}

function parseLabel(sessionId: string, label?: string): string {
  if (label) return label;
  const parts = sessionId.split(':');
  if (parts.length >= 3 && parts[2] === 'subagent') {
    return `Subagent ${parts[3]?.slice(0, 8) || ''}`;
  }
  return sessionId.slice(0, 16);
}

async function fallbackFromHistory(): Promise<BackgroundItem[]> {
  const sessionId = await fetchMainSession();
  if (!sessionId) return [];

  const history = await fetchSessionHistory(sessionId);
  const entries = history?.history || history?.messages || [];
  if (!entries.length) return [];

  const label = parseLabel(sessionId, history?.label);
  const items: BackgroundItem[] = [];

  for (const entry of entries.slice(-40)) {
    const content = typeof entry.content === 'string'
      ? entry.content
      : Array.isArray(entry.content)
        ? (entry.content as Array<{ text?: string }>).map((c) => c.text).filter(Boolean).join(' ')
        : '';

    const toolNames = entry.tool_calls?.map((tc) => tc.function?.name || 'unknown').join(', ');
    const isTool = Boolean(entry.tool_calls?.length);

    if (!content && !isTool) continue;

    const title = isTool ? 'tool_call' : entry.role || 'event';
    const detail = isTool ? `tools: ${toolNames}` : content;

    items.push({
      id: `${sessionId}-${entry.timestamp || Date.now()}-${Math.random()}`,
      title,
      status: entry.role,
      detail: detail.slice(0, 400),
      source: label,
      timestamp: entry.timestamp || new Date().toISOString(),
    });
  }

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return items.slice(0, 30);
}

export async function GET() {
  if (!GATEWAY_URL) {
    const fallback = await fallbackFromHistory();
    return NextResponse.json({ items: fallback, source: 'sessions_history' });
  }

  const gatewayItems = await fetchBackgroundRuns();
  if (gatewayItems && gatewayItems.length > 0) {
    return NextResponse.json({ items: gatewayItems, source: 'gateway' });
  }

  const fallback = await fallbackFromHistory();
  return NextResponse.json({ items: fallback, source: 'sessions_history' });
}
