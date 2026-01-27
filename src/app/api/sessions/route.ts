import { NextResponse } from "next/server";

const GATEWAY_URL = process.env.GATEWAY_URL || "https://peters-macbook-pro-4.tail2e18e2.ts.net";
const AUTH_TOKEN = process.env.AUTH_TOKEN || "";

export async function GET() {
  try {
    const response = await fetch(`${GATEWAY_URL}/api/sessions/list`, {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        "Content-Type": "application/json",
      },
      // Don't cache
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
    
    // Normalize the response structure
    const sessions = Array.isArray(data) ? data : data.sessions || [];
    
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
