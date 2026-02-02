import { NextResponse } from 'next/server';

const GATEWAY_URL = process.env.GATEWAY_URL;
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || process.env.AUTH_TOKEN || '';

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

async function invokeGateway(tool: string, args: Record<string, unknown>) {
  if (!GATEWAY_URL) {
    return { ok: false, error: 'Missing GATEWAY_URL' };
  }
  try {
    const response = await fetch(`${GATEWAY_URL}/tools/invoke`, {
      method: 'POST',
      headers: buildHeaders(),
      cache: 'no-store',
      body: JSON.stringify({ tool, args }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        (payload as { error?: string })?.error ||
        (payload as { message?: string })?.message ||
        `${response.status} ${response.statusText}`;
      console.warn(`[cron] tool ${tool} failed: ${message}`);
      return { ok: false, error: message };
    }
    return { ok: true, result: parseGatewayResult((payload as { result?: unknown })?.result ?? payload) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gateway request failed';
    console.warn(`[cron] tool ${tool} request error: ${message}`);
    return { ok: false, error: message };
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const jobId = body.jobId || body.name || body.id;

  if (!jobId) {
    return NextResponse.json({ ok: false, error: 'Missing jobId' }, { status: 400 });
  }

  const tools = ['cron_run', 'cron_job_run', 'cron_execute', 'cron_trigger'];
  for (const tool of tools) {
    const response = await invokeGateway(tool, { jobId, name: jobId, id: jobId });
    if (response.ok) {
      return NextResponse.json({ ok: true, tool, result: response.result });
    }
  }

  return NextResponse.json(
    { ok: false, error: `No cron run tool available (tried ${tools.join(', ')})` },
    { status: 503 }
  );
}
