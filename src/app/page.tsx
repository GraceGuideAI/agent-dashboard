"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PixelCharacter } from "@/components/PixelSprite";

// Types
interface Session {
  key: string;
  label?: string;
  channel?: string;
  kind?: string;
  model?: string;
  updatedAt?: number;
  totalTokens?: number;
  thinkingLevel?: string;
  abortedLastRun?: boolean;
  turns?: number;
  lastActivity?: string;
}

interface SessionsResponse {
  sessions: Session[];
  total?: number;
}

type AgentState = "idle" | "thinking" | "executing" | "complete";

function getAgentState(session: Session): AgentState {
  const now = Date.now();
  const lastUpdate = session.updatedAt || 0;
  const isRecent = now - lastUpdate < 30000;
  
  if (isRecent && session.thinkingLevel) return "thinking";
  if (isRecent) return "executing";
  return "idle";
}

// Status badge with pixel art style
function StatusBadge({ state }: { state: AgentState }) {
  const config = {
    idle: { bg: "bg-slate-700", text: "IDLE", color: "text-slate-300" },
    thinking: { bg: "bg-purple-900", text: "THINKING...", color: "text-purple-300" },
    executing: { bg: "bg-blue-900", text: "EXECUTING!", color: "text-blue-300" },
    complete: { bg: "bg-green-900", text: "COMPLETE", color: "text-green-300" },
  };

  const c = config[state];

  return (
    <motion.span 
      className={`inline-flex items-center gap-2 px-3 py-1 ${c.bg} ${c.color} text-xs font-mono tracking-wider border-2 border-current`}
      style={{ 
        imageRendering: 'pixelated',
        boxShadow: state !== 'idle' ? `0 0 10px currentColor` : 'none'
      }}
      animate={state === 'thinking' || state === 'executing' ? { opacity: [1, 0.7, 1] } : {}}
      transition={{ duration: 0.5, repeat: Infinity }}
    >
      <motion.span
        className="w-2 h-2 bg-current"
        animate={state !== 'idle' ? { scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 0.3, repeat: Infinity }}
      />
      {c.text}
    </motion.span>
  );
}

// Operator Card with pixel sprite
function OperatorCard({ session }: { session: Session }) {
  const state = getAgentState(session);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative p-4 rounded-none border-4 border-indigo-500 bg-gradient-to-b from-indigo-950 to-purple-950"
      style={{ 
        boxShadow: '8px 8px 0 rgba(99, 102, 241, 0.3)',
        imageRendering: 'pixelated'
      }}
    >
      {/* Pixel corner decorations */}
      <div className="absolute top-0 left-0 w-4 h-4 bg-indigo-400" />
      <div className="absolute top-0 right-0 w-4 h-4 bg-indigo-400" />
      <div className="absolute bottom-0 left-0 w-4 h-4 bg-indigo-400" />
      <div className="absolute bottom-0 right-0 w-4 h-4 bg-indigo-400" />

      {/* Title bar */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b-2 border-indigo-500">
        <h3 className="text-lg font-mono font-bold text-indigo-200 tracking-wider flex items-center gap-2">
          <span className="text-yellow-400">⚡</span> OPERATOR
        </h3>
        <StatusBadge state={state} />
      </div>

      {/* Sprite arena */}
      <div className="relative h-32 bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-slate-700 mb-3 overflow-hidden">
        {/* Ground pattern */}
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800" 
          style={{ 
            backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(255,255,255,0.03) 8px, rgba(255,255,255,0.03) 16px)'
          }} 
        />
        
        {/* Character */}
        <div className="absolute inset-0">
          <PixelCharacter 
            isOperator={true} 
            state={state} 
            containerWidth={300}
          />
        </div>

        {/* Floating particles */}
        {state === 'thinking' && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-purple-400"
                initial={{ x: 50 + i * 50, y: 100 }}
                animate={{ y: [100, 20, 100], opacity: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
              />
            ))}
          </div>
        )}

        {state === 'executing' && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-yellow-400"
                style={{ left: `${10 + i * 12}%` }}
                animate={{ 
                  y: [Math.random() * 50 + 50, Math.random() * 30, Math.random() * 50 + 50],
                  opacity: [0.3, 1, 0.3]
                }}
                transition={{ duration: 0.5 + Math.random() * 0.5, repeat: Infinity, delay: i * 0.1 }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        {session.channel && (
          <div className="bg-slate-900 p-2 border border-slate-700">
            <span className="text-slate-500">CHANNEL:</span>
            <span className="text-slate-300 ml-2">{session.channel}</span>
          </div>
        )}
        {session.turns !== undefined && (
          <div className="bg-slate-900 p-2 border border-slate-700">
            <span className="text-slate-500">TURNS:</span>
            <span className="text-indigo-400 ml-2">{session.turns}</span>
          </div>
        )}
        {session.model && (
          <div className="col-span-2 bg-slate-900 p-2 border border-slate-700 truncate">
            <span className="text-slate-500">MODEL:</span>
            <span className="text-purple-400 ml-2">{session.model.split("/").pop()}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Subagent Card with pixel sprite
function SubagentCard({ session }: { session: Session }) {
  const state = getAgentState(session);
  const label = session.label || session.key.split(":").pop() || "worker";

  // Get color theme based on label
  const colorThemes = {
    emerald: { border: 'border-emerald-500', shadow: 'rgba(16, 185, 129, 0.3)', bg: 'from-emerald-950 to-slate-950' },
    amber: { border: 'border-amber-500', shadow: 'rgba(245, 158, 11, 0.3)', bg: 'from-amber-950 to-slate-950' },
    red: { border: 'border-red-500', shadow: 'rgba(239, 68, 68, 0.3)', bg: 'from-red-950 to-slate-950' },
    cyan: { border: 'border-cyan-500', shadow: 'rgba(6, 182, 212, 0.3)', bg: 'from-cyan-950 to-slate-950' },
    pink: { border: 'border-pink-500', shadow: 'rgba(236, 72, 153, 0.3)', bg: 'from-pink-950 to-slate-950' },
    lime: { border: 'border-lime-500', shadow: 'rgba(132, 204, 22, 0.3)', bg: 'from-lime-950 to-slate-950' },
  };

  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorNames = Object.keys(colorThemes);
  const colorKey = colorNames[Math.abs(hash) % colorNames.length] as keyof typeof colorThemes;
  const theme = colorThemes[colorKey];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, y: -20 }}
      className={`relative p-3 border-4 ${theme.border} bg-gradient-to-b ${theme.bg}`}
      style={{ 
        boxShadow: `6px 6px 0 ${theme.shadow}`,
        imageRendering: 'pixelated'
      }}
    >
      {/* Corner pixels */}
      <div className={`absolute top-0 left-0 w-2 h-2 ${theme.border.replace('border-', 'bg-')}`} />
      <div className={`absolute top-0 right-0 w-2 h-2 ${theme.border.replace('border-', 'bg-')}`} />
      <div className={`absolute bottom-0 left-0 w-2 h-2 ${theme.border.replace('border-', 'bg-')}`} />
      <div className={`absolute bottom-0 right-0 w-2 h-2 ${theme.border.replace('border-', 'bg-')}`} />

      {/* Title */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-mono font-bold text-slate-200 truncate flex items-center gap-1">
          <span>🤖</span> {label.slice(0, 12)}
        </h3>
      </div>

      {/* Sprite arena */}
      <div className="relative h-20 bg-slate-900 border-2 border-slate-700 mb-2 overflow-hidden">
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-slate-800" />
        <PixelCharacter 
          isOperator={false} 
          state={state} 
          label={label}
          containerWidth={150}
        />
      </div>

      <StatusBadge state={state} />

      {session.model && (
        <p className="text-[10px] font-mono text-slate-600 mt-2 truncate">
          {session.model.split("/").pop()}
        </p>
      )}
    </motion.div>
  );
}

// Connection status
function ConnectionStatus({ connected, lastUpdate }: { connected: boolean; lastUpdate: Date | null }) {
  return (
    <div className="flex items-center gap-3 font-mono text-sm">
      <div className="flex items-center gap-2">
        <motion.div
          className={`w-3 h-3 ${connected ? "bg-green-500" : "bg-red-500"}`}
          animate={connected ? { opacity: [1, 0.5, 1] } : {}}
          transition={{ duration: 1, repeat: Infinity }}
          style={{ boxShadow: connected ? '0 0 8px #22c55e' : '0 0 8px #ef4444' }}
        />
        <span className={connected ? "text-green-400" : "text-red-400"}>
          {connected ? "ONLINE" : "OFFLINE"}
        </span>
      </div>
      {lastUpdate && (
        <span className="text-slate-600 text-xs">
          {lastUpdate.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}

// Main Dashboard
export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch("/api/sessions");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: SessionsResponse = await response.json();
      setSessions(data.sessions || []);
      setConnected(true);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
      setConnected(false);
      setError(err instanceof Error ? err.message : "Connection failed");
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 3000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const operator = sessions.find(
    (s) => s.key.includes(":main:main") || s.label === "main"
  );
  const subagents = sessions.filter((s) => s.key.includes(":subagent:"));

  return (
    <main className="min-h-screen p-4 md:p-8 bg-slate-950">
      {/* Scanline effect */}
      <div 
        className="fixed inset-0 pointer-events-none z-50 opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)'
        }}
      />

      {/* Header */}
      <header className="max-w-5xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 border-4 border-slate-700 bg-slate-900"
          style={{ boxShadow: '8px 8px 0 rgba(0,0,0,0.3)' }}
        >
          <div>
            <h1 className="text-2xl md:text-3xl font-mono font-bold tracking-wider">
              <span className="text-indigo-400">AGENT</span>
              <span className="text-purple-400">_</span>
              <span className="text-pink-400">DASHBOARD</span>
            </h1>
            <p className="text-slate-600 text-xs font-mono mt-1">
              {">> "}CLAWDBOT REAL-TIME MONITOR v2.0
            </p>
          </div>
          <ConnectionStatus connected={connected} lastUpdate={lastUpdate} />
        </div>
      </header>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-5xl mx-auto mb-6 p-3 bg-red-950 border-4 border-red-500 font-mono text-red-400 text-sm"
            style={{ boxShadow: '4px 4px 0 rgba(239,68,68,0.3)' }}
          >
            ⚠️ ERROR: {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="max-w-5xl mx-auto">
        {/* Operator section */}
        <section className="mb-8">
          <h2 className="text-xs font-mono text-slate-500 tracking-widest mb-4 flex items-center gap-2">
            <span className="w-8 h-px bg-slate-700" />
            MAIN_AGENT
            <span className="flex-1 h-px bg-slate-700" />
          </h2>
          {operator ? (
            <OperatorCard session={operator} />
          ) : (
            <div className="p-8 border-4 border-dashed border-slate-700 text-center font-mono">
              <div className="text-4xl mb-2 opacity-50">⚡</div>
              <p className="text-slate-600">OPERATOR_NOT_ACTIVE</p>
            </div>
          )}
        </section>

        {/* Subagents section */}
        <section>
          <h2 className="text-xs font-mono text-slate-500 tracking-widest mb-4 flex items-center gap-2">
            <span className="w-8 h-px bg-slate-700" />
            WORKERS [{subagents.length}]
            <span className="flex-1 h-px bg-slate-700" />
          </h2>
          {subagents.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              <AnimatePresence mode="popLayout">
                {subagents.map((session) => (
                  <SubagentCard key={session.key} session={session} />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="p-6 border-4 border-dashed border-slate-700 text-center font-mono">
              <p className="text-slate-600">NO_ACTIVE_WORKERS</p>
            </div>
          )}
        </section>

        {/* Stats footer */}
        <footer className="mt-12 pt-6 border-t-4 border-slate-800">
          <div className="flex flex-wrap justify-center gap-6 text-sm font-mono text-slate-500">
            <div>
              TOTAL: <span className="text-slate-300">{sessions.length}</span>
            </div>
            <div>
              OPERATOR: <span className="text-indigo-400">{operator ? 1 : 0}</span>
            </div>
            <div>
              WORKERS: <span className="text-emerald-400">{subagents.length}</span>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
