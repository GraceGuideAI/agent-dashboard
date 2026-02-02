import { NextResponse } from "next/server";

const GATEWAY_URL = process.env.GATEWAY_URL;
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || process.env.AUTH_TOKEN || "";

export async function GET() {
  try {
    if (!GATEWAY_URL) {
      return NextResponse.json(
        { error: "Missing GATEWAY_URL", sessions: [] },
        { status: 503 }
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (GATEWAY_TOKEN) {
      headers.Authorization = `Bearer ${GATEWAY_TOKEN}`;
    }

    const response = await fetch(`${GATEWAY_URL}/sessions/list`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`Gateway returned ${response.status}: ${response.statusText}`);
      return NextResponse.json(
        { error: `Gateway error: ${response.status}`, sessions: [] },
        { status: response.status }
      );
    }

    const data = await response.json();

    const sessions = data?.sessions || [];
    
    return NextResponse.json({
      sessions,
      total: sessions.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to fetch sessions:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Unknown error",
        sessions: [] 
      },
      { status: 500 }
    );
  }
}
