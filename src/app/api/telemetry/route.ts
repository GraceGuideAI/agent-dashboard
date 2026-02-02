import { NextResponse } from 'next/server';

const GATEWAY_URL = process.env.GATEWAY_URL;
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || process.env.AUTH_TOKEN || '';
const WHOOP_TOKEN_EXPIRES_AT = process.env.WHOOP_TOKEN_EXPIRES_AT;
const SOFI_RISK_LEVEL = process.env.SOFI_RISK_LEVEL;

interface GatewayInvokeResult {
  ok: boolean;
  result?: unknown;
  error?: string;
  latencyMs?: number;
  status?: number;
}

function buildHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (GATEWAY_TOKEN) {
    headers.Authorization = `Bearer ${GATEWAY_TOKEN}`;
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

async function invokeGateway(tool: string, args: Record<string, unknown>): Promise<GatewayInvokeResult> {
  if (!GATEWAY_URL) {
    return { ok: false, error: 'Missing GATEWAY_URL' };
  }
  const startedAt = Date.now();
  try {
    const response = await fetch(`${GATEWAY_URL}/tools/invoke`, {
      method: 'POST',
      headers: buildHeaders(),
      cache: 'no-store',
      body: JSON.stringify({ tool, args }),
    });
    const latencyMs = Date.now() - startedAt;
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const errorMessage =
        (payload as { error?: string })?.error ||
        (payload as { message?: string })?.message ||
        `${response.status} ${response.statusText}`;
      console.warn(`[telemetry] tool ${tool} failed: ${errorMessage}`);
      return { ok: false, error: errorMessage, latencyMs, status: response.status };
    }

    const result = parseGatewayResult((payload as { result?: unknown })?.result ?? payload);
    return { ok: true, result, latencyMs, status: response.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gateway request failed';
    console.warn(`[telemetry] tool ${tool} request error: ${message}`);
    return { ok: false, error: message };
  }
}

function coerceString(value: unknown) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function coerceNumber(value: unknown) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function coerceTimestamp(value: unknown) {
  const candidate = coerceString(value);
  if (!candidate) return undefined;
  const date = new Date(candidate);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function normalizeArray(result: unknown) {
  if (Array.isArray(result)) return result;
  const record = result as Record<string, unknown> | null;
  if (!record) return [];
  const candidates = ['sessions', 'items', 'runs', 'jobs', 'events', 'processes', 'queues', 'records', 'data'];
  for (const key of candidates) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function isErrorResult(result: unknown) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return false;
  return Boolean((result as { error?: unknown }).error);
}

async function firstAvailable(tools: string[], args: Record<string, unknown>, warnings: string[], label: string) {
  for (const tool of tools) {
    const response = await invokeGateway(tool, args);
    if (response.ok && !isErrorResult(response.result)) {
      return { tool, result: response.result };
    }
  }
  const note = `${label} unavailable (tried ${tools.join(', ')})`;
  warnings.push(note);
  console.warn(`[telemetry] ${note}`);
  return null;
}

function normalizeSessions(result: unknown) {
  const sessions =
    (result as { sessions?: Array<Record<string, unknown>> })?.sessions ||
    (result as { details?: { sessions?: Array<Record<string, unknown>> } })?.details?.sessions ||
    [];

  return sessions.map((session) => {
    const updatedAt =
      coerceTimestamp(session.updated_at) ||
      coerceTimestamp(session.updatedAt) ||
      coerceTimestamp(session.last_activity) ||
      coerceTimestamp(session.lastActivity);

    return {
      key: coerceString(session.key) || coerceString(session.session_id) || coerceString(session.id) || 'unknown',
      label: coerceString(session.label),
      channel: coerceString(session.channel),
      kind: coerceString(session.kind),
      model: coerceString(session.model),
      updatedAt: updatedAt ? new Date(updatedAt).getTime() : undefined,
      totalTokens: coerceNumber(session.total_tokens) || coerceNumber(session.totalTokens),
      thinkingLevel: coerceString(session.thinking_level) || coerceString(session.thinkingLevel),
      abortedLastRun: Boolean(session.abortedLastRun || session.aborted_last_run),
      turns: coerceNumber(session.turns),
      lastActivity: updatedAt,
    };
  });
}

function normalizeHistory(result: unknown, sessionLabel?: string) {
  const record = result as Record<string, unknown> | null;
  const history =
    (record?.history as Array<Record<string, unknown>> | undefined) ||
    (record?.messages as Array<Record<string, unknown>> | undefined) ||
    [];

  const items: Array<Record<string, unknown>> = [];
  for (const entry of history.slice(-60)) {
    const timestamp = coerceTimestamp(entry.timestamp) || new Date().toISOString();
    const role = coerceString(entry.role) || 'assistant';
    const label = sessionLabel || coerceString(record?.label) || 'session';

    const contentArray = Array.isArray(entry.content) ? entry.content : [];
    const textContent =
      typeof entry.content === 'string'
        ? entry.content
        : (contentArray as Array<{ text?: string }>).map((chunk) => chunk.text).filter(Boolean).join(' ');

    const toolCalls = Array.isArray(entry.tool_calls) ? entry.tool_calls : [];
    if (toolCalls.length) {
      const toolNames = toolCalls
        .map((tc) => (tc as { function?: { name?: string } })?.function?.name || 'unknown')
        .join(', ');
      items.push({
        id: `${label}-${timestamp}-${Math.random()}`,
        type: 'tool_call',
        source: label,
        detail: `tools: ${toolNames}`.slice(0, 260),
        role,
        timestamp,
      });
    }

    for (const chunk of contentArray as Array<{ type?: string; name?: string; arguments?: unknown; content?: unknown; text?: string }>) {
      if (chunk.type === 'toolCall') {
        const args = chunk.arguments ? JSON.stringify(chunk.arguments) : '';
        items.push({
          id: `${label}-${timestamp}-${Math.random()}`,
          type: 'tool_call',
          source: label,
          detail: `${chunk.name || 'tool'} ${args}`.slice(0, 260),
          role,
          timestamp,
        });
        continue;
      }
      if (chunk.type === 'toolResult') {
        const resultText = typeof chunk.content === 'string' ? chunk.content : JSON.stringify(chunk.content ?? '');
        items.push({
          id: `${label}-${timestamp}-${Math.random()}`,
          type: 'tool_result',
          source: label,
          detail: `${chunk.name || 'tool'} ${resultText}`.slice(0, 260),
          role,
          timestamp,
        });
        continue;
      }
    }

    if (role === 'system' && textContent) {
      items.push({
        id: `${label}-${timestamp}-${Math.random()}`,
        type: 'system',
        source: label,
        detail: textContent.slice(0, 260),
        role,
        timestamp,
      });
    }
  }

  return items.sort((a, b) => new Date(String(b.timestamp)).getTime() - new Date(String(a.timestamp)).getTime());
}

function normalizeProcesses(result: unknown) {
  const processes = normalizeArray(result);
  return processes.map((process) => {
    const record = process as Record<string, unknown>;
    return {
      id: coerceString(record.id) || coerceString(record.pid) || `proc-${Math.random()}`,
      name: coerceString(record.name) || coerceString(record.command) || 'process',
      status: coerceString(record.status) || coerceString(record.state) || 'unknown',
      cpu: coerceNumber(record.cpu) || coerceNumber(record.cpu_pct),
      memory: coerceNumber(record.memory) || coerceNumber(record.mem_mb),
    };
  });
}

function normalizeCronJobs(result: unknown) {
  // result is the parsed JSON from content[0].text
  const record = result as Record<string, unknown> | null;
  const jobs = (record?.jobs as Array<Record<string, unknown>> | undefined) || [];
  
  return jobs.map((job) => {
    const state = (job.state as Record<string, unknown> | undefined) || {};
    return {
      id: coerceString(job.id) || `job-${Math.random()}`,
      name: coerceString(job.name) || 'cron-job',
      schedule: coerceString((job.schedule as Record<string, unknown>)?.expr) || coerceString((job.schedule as Record<string, unknown>)?.kind),
      lastRun: coerceTimestamp(state.lastRunAtMs) || coerceTimestamp(job.updatedAtMs),
      lastStatus: coerceString(state.lastStatus) || 'unknown',
      lastFailure: coerceString(state.lastError),
    };
  });
}

function normalizeCronRuns(result: unknown) {
  const record = result as Record<string, unknown> | null;
  const runs = (record?.runs as Array<Record<string, unknown>> | undefined) || [];
  
  return runs.map((run) => {
    return {
      id: coerceString(run.id) || `run-${Math.random()}`,
      jobId: coerceString(run.jobId) || coerceString(run.name),
      status: coerceString(run.status) || 'unknown',
      startedAt: coerceTimestamp(run.startedAtMs) || coerceTimestamp(run.createdAtMs),
      finishedAt: coerceTimestamp(run.finishedAtMs),
      error: coerceString(run.error),
    };
  });
}

function normalizeQueues(result: unknown) {
  const queues = normalizeArray(result);
  return queues.map((queue) => {
    const record = queue as Record<string, unknown>;
    return {
      id: coerceString(record.id) || coerceString(record.name) || `queue-${Math.random()}`,
      name: coerceString(record.name) || coerceString(record.queue) || 'queue',
      direction: coerceString(record.direction),
      depth: coerceNumber(record.depth) || coerceNumber(record.size) || coerceNumber(record.count),
      inflight: coerceNumber(record.inflight) || coerceNumber(record.in_progress),
      updatedAt: coerceTimestamp(record.updated_at) || coerceTimestamp(record.last_updated),
    };
  });
}

function normalizeEvents(result: unknown) {
  const events = normalizeArray(result);
  return events.map((event) => {
    const record = event as Record<string, unknown>;
    return {
      id: coerceString(record.id) || coerceString(record.event_id) || `evt-${Math.random()}`,
      level: coerceString(record.level) || coerceString(record.severity) || 'info',
      message: coerceString(record.message) || coerceString(record.summary) || coerceString(record.detail) || 'event',
      source: coerceString(record.source) || coerceString(record.origin),
      timestamp: coerceTimestamp(record.timestamp) || coerceTimestamp(record.created_at) || new Date().toISOString(),
    };
  });
}

function normalizeUsage(result: unknown) {
  const items = normalizeArray(result);
  return items.map((usage) => {
    const record = usage as Record<string, unknown>;
    return {
      id: coerceString(record.id) || coerceString(record.model) || `usage-${Math.random()}`,
      model: coerceString(record.model) || coerceString(record.name) || 'model',
      tokens: coerceNumber(record.tokens) || coerceNumber(record.total_tokens) || coerceNumber(record.usage),
      cost: coerceNumber(record.cost) || coerceNumber(record.total_cost) || coerceNumber(record.usd),
      window: coerceString(record.window) || coerceString(record.period) || coerceString(record.range),
    };
  });
}

export async function GET() {
  const warnings: string[] = [];

  const sessionsResponse = await invokeGateway('sessions_list', {});
  const gatewayAvailable = sessionsResponse.ok && !isErrorResult(sessionsResponse.result);
  const sessions = gatewayAvailable ? normalizeSessions(sessionsResponse.result) : [];
  const gatewayLatency = sessionsResponse.latencyMs;

  if (!gatewayAvailable) {
    warnings.push(`sessions_list unavailable${sessionsResponse.error ? `: ${sessionsResponse.error}` : ''}`);
  }

  const mainSession = sessions.find((session) => session.key.includes(':main:main')) || sessions[0];

  let terminalItems: Array<Record<string, unknown>> = [];
  if (mainSession?.key) {
    const historyResponse = await invokeGateway('sessions_history', { sessionKey: mainSession.key, limit: 40 });
    if (historyResponse.ok && !isErrorResult(historyResponse.result)) {
      terminalItems = normalizeHistory(historyResponse.result, mainSession.label || mainSession.key);
    } else {
      warnings.push('sessions_history unavailable for terminal feed');
    }
  } else {
    warnings.push('No sessions available for terminal feed');
  }

  let sessionStatus: unknown = null;
  if (mainSession?.key) {
    const statusResponse = await invokeGateway('session_status', { sessionKey: mainSession.key });
    if (statusResponse.ok && !isErrorResult(statusResponse.result)) {
      sessionStatus = statusResponse.result;
    } else {
      warnings.push('session_status unavailable');
    }
  }

  // process list - no dedicated tool available
  const processPayload = null;
  warnings.push('process list unavailable (no process_list tool)');
  const processes = processPayload ? normalizeProcesses(processPayload.result) : [];

  // cron jobs - correct gateway tool: cron with action "list"
  const cronJobsResponse = await invokeGateway('cron', { action: 'list', limit: 50 });
  const cronJobsPayload = cronJobsResponse.ok && !isErrorResult(cronJobsResponse.result) 
    ? { tool: 'cron', result: cronJobsResponse.result } 
    : null;
  if (!cronJobsPayload) warnings.push('cron jobs unavailable (tried cron list)');
  
  // cron runs - try cron with action "runs" or "run"
  let cronRunsPayload = null;
  for (const action of ['runs', 'run']) {
    const response = await invokeGateway('cron', { action, limit: 50 });
    if (response.ok && !isErrorResult(response.result)) {
      cronRunsPayload = { tool: 'cron', result: response.result };
      break;
    }
  }
  if (!cronRunsPayload) warnings.push('cron runs unavailable (tried cron runs, cron run)');

  // queues - no dedicated tool available
  const queuesPayload = null;
  warnings.push('queues unavailable (no queue_status tool)');
  
  // system events - no dedicated tool available
  const eventsPayload = null;
  warnings.push('system events unavailable (no system_events_list tool)');

  // usage/cost - try session_status, no dedicated usage tool available
  const usagePayload = null;
  warnings.push('usage unavailable (no usage_summary tool, try session_status)');

  const response = {
    gateway: {
      available: gatewayAvailable,
      latencyMs: gatewayLatency,
      error: gatewayAvailable ? null : sessionsResponse.error || 'Gateway unavailable',
    },
    sessions: {
      sessions,
      total: sessions.length,
    },
    terminal: {
      items: terminalItems,
      sourceSession: mainSession?.key || null,
    },
    sessionStatus,
    processes: {
      tool: null,
      items: processes,
    },
    cron: {
      tool: 'cron',
      jobs: cronJobsPayload ? normalizeCronJobs(cronJobsPayload.result) : [],
      runs: cronRunsPayload ? normalizeCronRuns(cronRunsPayload.result) : [],
    },
    queues: {
      tool: null,
      items: [],
    },
    systemEvents: {
      tool: null,
      items: [],
    },
    usage: {
      tool: null,
      items: [],
    },
    risk: {
      whoopTokenExpiresAt: WHOOP_TOKEN_EXPIRES_AT || null,
      sofiRisk: SOFI_RISK_LEVEL || null,
      gatewayDown: !gatewayAvailable,
    },
    warnings,
  };

  return NextResponse.json(response);
}
