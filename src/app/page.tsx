"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

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

// Avatar colors for subagents based on hash
const SUBAGENT_COLORS = [
  { primary: "#10b981", secondary: "#059669", name: "emerald" },
  { primary: "#f59e0b", secondary: "#d97706", name: "amber" },
  { primary: "#ef4444", secondary: "#dc2626", name: "red" },
  { primary: "#06b6d4", secondary: "#0891b2", name: "cyan" },
  { primary: "#ec4899", secondary: "#db2777", name: "pink" },
  { primary: "#84cc16", secondary: "#65a30d", name: "lime" },
];

function getColorForLabel(label: string) {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SUBAGENT_COLORS[Math.abs(hash) % SUBAGENT_COLORS.length];
}

function getAgentState(session: Session): AgentState {
  // Check if session was active in last 30 seconds
  const now = Date.now();
  const lastUpdate = session.updatedAt || 0;
  const isRecent = now - lastUpdate < 30000;
  
  if (isRecent && session.thinkingLevel) return "thinking";
  if (isRecent) return "executing";
  return "idle";
}

// Operator Avatar (Lightning themed)
function OperatorAvatar({ state, size = 120 }: { state: AgentState; size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Pulse rings for thinking state */}
      {state === "thinking" && (
        <>
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-indigo-500"
            animate={{ scale: [1, 1.5], opacity: [0.8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-purple-500"
            animate={{ scale: [1, 1.5], opacity: [0.8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
          />
        </>
      )}

      {/* Main avatar container */}
      <motion.div
        className="relative w-full h-full rounded-full bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 flex items-center justify-center overflow-hidden"
        animate={
          state === "thinking"
            ? { scale: [1, 1.05, 1] }
            : state === "executing"
            ? { rotate: [0, 5, -5, 0] }
            : {}
        }
        transition={{ duration: 0.5, repeat: state !== "idle" && state !== "complete" ? Infinity : 0 }}
        style={{
          boxShadow:
            state === "thinking"
              ? "0 0 30px rgba(99, 102, 241, 0.6), 0 0 60px rgba(139, 92, 246, 0.4)"
              : state === "executing"
              ? "0 0 20px rgba(99, 102, 241, 0.5)"
              : "0 0 15px rgba(99, 102, 241, 0.3)",
        }}
      >
        {/* Inner glow */}
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-indigo-400/20 to-transparent" />

        {/* Lightning bolt SVG */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-1/2 h-1/2 lightning-glow"
          style={{ filter: "drop-shadow(0 0 8px #a78bfa)" }}
        >
          <motion.path
            d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"
            fill="url(#lightning-gradient)"
            stroke="#c4b5fd"
            strokeWidth="0.5"
            animate={
              state === "executing"
                ? { opacity: [1, 0.7, 1] }
                : {}
            }
            transition={{ duration: 0.15, repeat: Infinity }}
          />
          <defs>
            <linearGradient id="lightning-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e0e7ff" />
              <stop offset="50%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
        </svg>

        {/* Complete checkmark overlay */}
        {state === "complete" && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute inset-0 bg-green-500/80 rounded-full flex items-center justify-center"
          >
            <svg className="w-1/2 h-1/2" viewBox="0 0 24 24" fill="none">
              <motion.path
                d="M5 13l4 4L19 7"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.4 }}
              />
            </svg>
          </motion.div>
        )}
      </motion.div>

      {/* Typing indicator for executing state */}
      {state === "executing" && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1 bg-slate-800 rounded-full px-2 py-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-indigo-400"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Subagent Avatar (Worker bot)
function SubagentAvatar({
  label,
  state,
  size = 80,
}: {
  label: string;
  state: AgentState;
  size?: number;
}) {
  const colors = getColorForLabel(label);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Pulse ring for thinking */}
      {state === "thinking" && (
        <motion.div
          className="absolute inset-0 rounded-lg border-2"
          style={{ borderColor: colors.primary }}
          animate={{ scale: [1, 1.3], opacity: [0.8, 0] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}

      {/* Main avatar */}
      <motion.div
        className="relative w-full h-full rounded-lg flex items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
          boxShadow:
            state === "thinking"
              ? `0 0 20px ${colors.primary}80`
              : `0 0 10px ${colors.primary}40`,
        }}
        animate={
          state === "thinking"
            ? { scale: [1, 1.05, 1] }
            : state === "executing"
            ? { y: [0, -2, 0] }
            : {}
        }
        transition={{ duration: 0.4, repeat: state !== "idle" && state !== "complete" ? Infinity : 0 }}
      >
        {/* Robot face */}
        <svg viewBox="0 0 40 40" className="w-3/4 h-3/4">
          {/* Antenna */}
          <circle cx="20" cy="4" r="2" fill="#fff" opacity="0.9" />
          <line x1="20" y1="6" x2="20" y2="12" stroke="#fff" strokeWidth="2" opacity="0.8" />

          {/* Head */}
          <rect x="8" y="12" width="24" height="20" rx="4" fill="#fff" opacity="0.2" />

          {/* Eyes */}
          <motion.circle
            cx="14"
            cy="20"
            r="3"
            fill="#fff"
            animate={state === "executing" ? { opacity: [1, 0.3, 1] } : {}}
            transition={{ duration: 0.3, repeat: Infinity }}
          />
          <motion.circle
            cx="26"
            cy="20"
            r="3"
            fill="#fff"
            animate={state === "executing" ? { opacity: [1, 0.3, 1] } : {}}
            transition={{ duration: 0.3, repeat: Infinity, delay: 0.15 }}
          />

          {/* Mouth - changes based on state */}
          {state === "idle" && (
            <line x1="15" y1="28" x2="25" y2="28" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          )}
          {state === "thinking" && (
            <circle cx="20" cy="28" r="2" fill="#fff" opacity="0.8" />
          )}
          {state === "executing" && (
            <motion.rect
              x="14"
              y="26"
              width="12"
              height="4"
              rx="1"
              fill="#fff"
              animate={{ scaleX: [1, 0.6, 1] }}
              transition={{ duration: 0.2, repeat: Infinity }}
            />
          )}
          {state === "complete" && (
            <path d="M14 27 Q20 32 26 27" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
          )}
        </svg>

        {/* Complete overlay */}
        {state === "complete" && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-0 right-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center -translate-y-1/4 translate-x-1/4"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </motion.div>
        )}
      </motion.div>

      {/* Typing indicator */}
      {state === "executing" && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 bg-slate-800 rounded-full px-1.5 py-0.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1 h-1 rounded-full"
              style={{ backgroundColor: colors.primary }}
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Status badge
function StatusBadge({ state }: { state: AgentState }) {
  const config = {
    idle: { bg: "bg-slate-600", text: "Idle", dot: "bg-slate-400" },
    thinking: { bg: "bg-purple-600", text: "Thinking", dot: "bg-purple-400" },
    executing: { bg: "bg-blue-600", text: "Executing", dot: "bg-blue-400" },
    complete: { bg: "bg-green-600", text: "Complete", dot: "bg-green-400" },
  };

  const c = config[state];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg}`}>
      <motion.span
        className={`w-1.5 h-1.5 rounded-full ${c.dot}`}
        animate={state === "thinking" || state === "executing" ? { opacity: [1, 0.4, 1] } : {}}
        transition={{ duration: 0.8, repeat: Infinity }}
      />
      {c.text}
    </span>
  );
}

// Agent Card
function AgentCard({
  session,
  isOperator,
}: {
  session: Session;
  isOperator: boolean;
}) {
  const state = getAgentState(session);
  const label = session.label || session.key.split(":").pop() || "Agent";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`relative p-4 rounded-xl border backdrop-blur-sm ${
        isOperator
          ? "bg-gradient-to-br from-indigo-950/50 to-purple-950/50 border-indigo-500/30"
          : "bg-slate-900/50 border-slate-700/50"
      }`}
    >
      <div className="flex flex-col items-center gap-3">
        {isOperator ? (
          <OperatorAvatar state={state} size={100} />
        ) : (
          <SubagentAvatar label={label} state={state} size={70} />
        )}

        <div className="text-center">
          <h3 className={`font-semibold ${isOperator ? "text-lg text-indigo-200" : "text-sm text-slate-200"}`}>
            {isOperator ? "⚡ Operator" : label}
          </h3>
          {session.channel && (
            <p className="text-xs text-slate-500 mt-0.5">{session.channel}</p>
          )}
        </div>

        <StatusBadge state={state} />

        {session.model && (
          <p className="text-[10px] text-slate-600 font-mono truncate max-w-full">
            {session.model.split("/").pop()}
          </p>
        )}

        {session.turns !== undefined && (
          <p className="text-[10px] text-slate-500">
            {session.turns} turn{session.turns !== 1 ? "s" : ""}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// Connection status indicator
function ConnectionStatus({ connected, lastUpdate }: { connected: boolean; lastUpdate: Date | null }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <motion.div
        className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
        animate={connected ? { opacity: [1, 0.5, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <span className="text-slate-400">
        {connected ? "Connected" : "Disconnected"}
      </span>
      {lastUpdate && (
        <span className="text-slate-600 text-xs">
          Updated {lastUpdate.toLocaleTimeString()}
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
    const interval = setInterval(fetchSessions, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [fetchSessions]);

  // Separate operator (main) and subagents
  const operator = sessions.find(
    (s) => s.key.includes(":main:main") || (s.label === "main" && !false)
  );
  const subagents = sessions.filter(
    (s) => s.key.includes(":subagent:") || false
  );

  return (
    <main className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <header className="max-w-4xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Agent Dashboard
            </h1>
            <p className="text-slate-500 text-sm mt-1">Clawdbot real-time agent monitor</p>
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
            className="max-w-4xl mx-auto mb-6 p-3 bg-red-950/50 border border-red-500/30 rounded-lg text-red-400 text-sm"
          >
            ⚠️ {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="max-w-4xl mx-auto">
        {/* Operator section */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">
            Main Agent
          </h2>
          {operator ? (
            <AgentCard session={operator} isOperator={true} />
          ) : (
            <div className="p-8 rounded-xl border border-dashed border-slate-700 text-center">
              <div className="text-slate-600 text-4xl mb-2">⚡</div>
              <p className="text-slate-500">Operator not active</p>
            </div>
          )}
        </section>

        {/* Subagents section */}
        <section>
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">
            Worker Agents ({subagents.length})
          </h2>
          {subagents.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              <AnimatePresence mode="popLayout">
                {subagents.map((session) => (
                  <AgentCard key={session.key} session={session} isOperator={false} />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="p-6 rounded-xl border border-dashed border-slate-700 text-center">
              <p className="text-slate-500">No active subagents</p>
            </div>
          )}
        </section>

        {/* Stats footer */}
        <footer className="mt-12 pt-6 border-t border-slate-800">
          <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-500">
            <div>
              <span className="text-slate-300 font-medium">{sessions.length}</span> total sessions
            </div>
            <div>
              <span className="text-indigo-400 font-medium">{operator ? 1 : 0}</span> operator
            </div>
            <div>
              <span className="text-emerald-400 font-medium">{subagents.length}</span> workers
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
