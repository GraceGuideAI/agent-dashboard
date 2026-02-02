"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PixelCharacter } from "@/components/PixelSprite";

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

interface TerminalItem {
  id: string;
  type: "tool_call" | "tool_result" | "system";
  source?: string;
  detail?: string;
  role?: string;
  timestamp: string;
}

interface ProcessItem {
  id: string;
  name: string;
  status: string;
  cpu?: number;
  memory?: number;
}

interface CronJob {
  id: string;
  name: string;
  schedule?: string;
  lastRun?: string;
  lastStatus?: string;
  lastFailure?: string;
}

interface CronRun {
  id: string;
  jobId?: string;
  status: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

interface QueueItem {
  id: string;
  name: string;
  direction?: string;
  depth?: number;
  inflight?: number;
  updatedAt?: string;
}

interface SystemEvent {
  id: string;
  level: string;
  message: string;
  source?: string;
  timestamp: string;
}

interface UsageItem {
  id: string;
  model: string;
  tokens?: number;
  cost?: number;
  window?: string | null;
}

interface TelemetryResponse {
  gateway: {
    available: boolean;
    latencyMs?: number | null;
    error?: string | null;
  };
  sessions: {
    sessions: Session[];
    total?: number;
  };
  terminal: {
    items: TerminalItem[];
    sourceSession?: string | null;
  };
  sessionStatus?: Record<string, unknown> | null;
  processes: { tool?: string | null; items: ProcessItem[] };
  cron: { tool?: string | null; jobs: CronJob[]; runs: CronRun[] };
  queues: { tool?: string | null; items: QueueItem[] };
  systemEvents: { tool?: string | null; items: SystemEvent[] };
  usage: { tool?: string | null; items: UsageItem[] };
  risk: { whoopTokenExpiresAt?: string | null; sofiRisk?: string | null; gatewayDown?: boolean };
  warnings: string[];
}

type AgentState = "idle" | "thinking" | "executing" | "complete";

type ActiveTab = "agents" | "terminal" | "ops" | "cron" | "data";

function getAgentState(session: Session): AgentState {
  const now = Date.now();
  const lastUpdate = session.updatedAt || 0;
  const isRecent = now - lastUpdate < 30000;

  if (isRecent && session.thinkingLevel) return "thinking";
  if (isRecent) return "executing";
  return "idle";
}

function formatRelativeTime(iso?: string) {
  if (!iso) return "-";
  const now = Date.now();
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "-";
  const diff = Math.max(0, now - time);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms)) return "-";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remaining}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatTimestamp(iso?: string) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function statusTone(status?: string | null) {
  const value = (status || "").toLowerCase();
  if (value.includes("fail") || value.includes("error")) return "text-red-400";
  if (value.includes("warn")) return "text-amber-300";
  if (value.includes("run") || value.includes("ok") || value.includes("success")) return "text-emerald-400";
  if (value.includes("queue") || value.includes("wait")) return "text-cyan-300";
  return "text-slate-300";
}

function StateChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between bg-slate-950/60 border border-slate-700 px-3 py-2 text-[10px] sm:text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="border-4 border-slate-700 bg-slate-900/70 p-4 font-mono"
      style={{ boxShadow: "6px 6px 0 rgba(15,23,42,0.55)" }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div>
          <h2 className="text-[10px] sm:text-xs text-slate-500 tracking-widest">{title}</h2>
          {subtitle && <p className="text-[10px] text-slate-600 mt-1">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full sm:w-64 bg-black/60 border-2 border-slate-700 text-slate-200 text-[10px] sm:text-xs px-3 py-2 focus:outline-none focus:border-indigo-500"
    />
  );
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
      className={`inline-flex items-center gap-2 px-2 sm:px-3 py-1 ${c.bg} ${c.color} text-[10px] sm:text-xs font-mono tracking-wider border-2 border-current`}
      style={{ imageRendering: "pixelated", boxShadow: state !== "idle" ? `0 0 10px currentColor` : "none" }}
      animate={state === "thinking" || state === "executing" ? { opacity: [1, 0.7, 1] } : {}}
      transition={{ duration: 0.5, repeat: Infinity }}
    >
      <motion.span
        className="w-2 h-2 bg-current"
        animate={state !== "idle" ? { scale: [1, 1.2, 1] } : {}}
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
      className="relative p-3 sm:p-4 rounded-none border-4 border-indigo-500 bg-gradient-to-b from-indigo-950 to-purple-950"
      style={{ boxShadow: "8px 8px 0 rgba(99, 102, 241, 0.3)", imageRendering: "pixelated" }}
    >
      <div className="absolute top-0 left-0 w-4 h-4 bg-indigo-400" />
      <div className="absolute top-0 right-0 w-4 h-4 bg-indigo-400" />
      <div className="absolute bottom-0 left-0 w-4 h-4 bg-indigo-400" />
      <div className="absolute bottom-0 right-0 w-4 h-4 bg-indigo-400" />

      <div className="flex items-center justify-between mb-2 pb-2 border-b-2 border-indigo-500">
        <h3 className="text-base sm:text-lg font-mono font-bold text-indigo-200 tracking-wider flex items-center gap-2">
          <span className="text-yellow-400">⚡</span> OPERATOR
        </h3>
        <StatusBadge state={state} />
      </div>

      <div className="relative h-28 sm:h-32 bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-slate-700 mb-3 overflow-hidden">
        <div
          className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(255,255,255,0.03) 8px, rgba(255,255,255,0.03) 16px)",
          }}
        />

        <div className="absolute inset-0">
          <PixelCharacter isOperator={true} state={state} containerWidth={260} />
        </div>

        {state === "thinking" && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(7)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-purple-400"
                initial={{ x: 50 + i * 50, y: 100 }}
                animate={{ y: [100, 12, 100], opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
                transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        )}

        {state === "executing" && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-yellow-400"
                style={{ left: `${10 + i * 12}%` }}
                animate={{
                  y: [Math.random() * 50 + 45, Math.random() * 20 + 10, Math.random() * 50 + 45],
                  opacity: [0.3, 1, 0.3],
                  scale: [0.8, 1.3, 0.8],
                }}
                transition={{ duration: 0.4 + Math.random() * 0.4, repeat: Infinity, delay: i * 0.08 }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] sm:text-xs font-mono">
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

  const colorThemes = {
    emerald: { border: "border-emerald-500", shadow: "rgba(16, 185, 129, 0.3)", bg: "from-emerald-950 to-slate-950" },
    amber: { border: "border-amber-500", shadow: "rgba(245, 158, 11, 0.3)", bg: "from-amber-950 to-slate-950" },
    red: { border: "border-red-500", shadow: "rgba(239, 68, 68, 0.3)", bg: "from-red-950 to-slate-950" },
    cyan: { border: "border-cyan-500", shadow: "rgba(6, 182, 212, 0.3)", bg: "from-cyan-950 to-slate-950" },
    pink: { border: "border-pink-500", shadow: "rgba(236, 72, 153, 0.3)", bg: "from-pink-950 to-slate-950" },
    lime: { border: "border-lime-500", shadow: "rgba(132, 204, 22, 0.3)", bg: "from-lime-950 to-slate-950" },
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
      className={`relative p-2.5 sm:p-3 border-4 ${theme.border} bg-gradient-to-b ${theme.bg}`}
      style={{ boxShadow: `6px 6px 0 ${theme.shadow}`, imageRendering: "pixelated" }}
    >
      <div className={`absolute top-0 left-0 w-2 h-2 ${theme.border.replace("border-", "bg-")}`} />
      <div className={`absolute top-0 right-0 w-2 h-2 ${theme.border.replace("border-", "bg-")}`} />
      <div className={`absolute bottom-0 left-0 w-2 h-2 ${theme.border.replace("border-", "bg-")}`} />
      <div className={`absolute bottom-0 right-0 w-2 h-2 ${theme.border.replace("border-", "bg-")}`} />

      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] sm:text-sm font-mono font-bold text-slate-200 truncate flex items-center gap-1">
          <span>🤖</span> {label.slice(0, 12)}
        </h3>
      </div>

      <div className="relative h-16 sm:h-20 bg-slate-900 border-2 border-slate-700 mb-2 overflow-hidden">
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-slate-800" />
        <PixelCharacter isOperator={false} state={state} label={label} containerWidth={130} />
      </div>

      <StatusBadge state={state} />

      {session.model && (
        <p className="text-[10px] font-mono text-slate-600 mt-2 truncate">{session.model.split("/").pop()}</p>
      )}
    </motion.div>
  );
}

function ConnectionStatus({ connected, lastUpdate }: { connected: boolean; lastUpdate: Date | null }) {
  return (
    <div className="flex items-center gap-3 font-mono text-xs sm:text-sm">
      <div className="flex items-center gap-2">
        <motion.div
          className={`w-3 h-3 ${connected ? "bg-green-500" : "bg-red-500"}`}
          animate={connected ? { opacity: [1, 0.5, 1] } : {}}
          transition={{ duration: 1, repeat: Infinity }}
          style={{ boxShadow: connected ? "0 0 8px #22c55e" : "0 0 8px #ef4444" }}
        />
        <span className={connected ? "text-green-400" : "text-red-400"}>{connected ? "ONLINE" : "OFFLINE"}</span>
      </div>
      {lastUpdate && <span className="text-slate-600 text-xs">{lastUpdate.toLocaleTimeString()}</span>}
    </div>
  );
}

export default function Dashboard() {
  const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("agents");
  const [terminalSearch, setTerminalSearch] = useState("");
  const [cronSearch, setCronSearch] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [queueSearch, setQueueSearch] = useState("");
  const [cronAction, setCronAction] = useState<string | null>(null);

  const fetchTelemetry = useCallback(async () => {
    try {
      const response = await fetch("/api/telemetry", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: TelemetryResponse = await response.json();
      setTelemetry(data);
      setConnected(Boolean(data.gateway?.available));
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      console.error("Failed to fetch telemetry:", err);
      setConnected(false);
      setError(err instanceof Error ? err.message : "Telemetry fetch failed");
    }
  }, []);

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 5000);
    return () => clearInterval(interval);
  }, [fetchTelemetry]);

  const sessions = telemetry?.sessions?.sessions || [];
  const operator = sessions.find((s) => s.key.includes(":main:main") || s.label === "main");
  const subagents = sessions.filter((s) => s.key.includes(":subagent:"));

  const terminalItems = telemetry?.terminal?.items || [];
  const filteredTerminal = terminalItems.filter((item) => {
    const haystack = `${item.source || ""} ${item.detail || ""} ${item.type}`.toLowerCase();
    return haystack.includes(terminalSearch.toLowerCase());
  });

  const cronJobs = telemetry?.cron?.jobs || [];
  const cronRuns = telemetry?.cron?.runs || [];
  const filteredCronJobs = cronJobs.filter((job) => {
    const haystack = `${job.name} ${job.schedule || ""} ${job.lastStatus || ""}`.toLowerCase();
    return haystack.includes(cronSearch.toLowerCase());
  });

  const queueItems = telemetry?.queues?.items || [];
  const filteredQueues = queueItems.filter((queue) => {
    const haystack = `${queue.name} ${queue.direction || ""}`.toLowerCase();
    return haystack.includes(queueSearch.toLowerCase());
  });

  const systemEvents = telemetry?.systemEvents?.items || [];
  const filteredEvents = systemEvents.filter((event) => {
    const haystack = `${event.message} ${event.level} ${event.source || ""}`.toLowerCase();
    return haystack.includes(eventSearch.toLowerCase());
  });

  const activeSessions = sessions.filter((session) => getAgentState(session) !== "idle");

  const operatorScore = useMemo(() => {
    const total = sessions.length;
    const thinking = sessions.filter((session) => getAgentState(session) === "thinking").length;
    const executing = sessions.filter((session) => getAgentState(session) === "executing").length;
    const idle = sessions.filter((session) => getAgentState(session) === "idle").length;
    const totalTokens = sessions.reduce((sum, session) => sum + (session.totalTokens || 0), 0);
    const totalTurns = sessions.reduce((sum, session) => sum + (session.turns || 0), 0);
    const lastActivity = sessions.reduce<string | undefined>((latest, session) => {
      if (!session.lastActivity) return latest;
      if (!latest) return session.lastActivity;
      return new Date(session.lastActivity).getTime() > new Date(latest).getTime()
        ? session.lastActivity
        : latest;
    }, undefined);
    return { total, thinking, executing, idle, totalTokens, totalTurns, lastActivity };
  }, [sessions]);

  const modelUsage = useMemo(() => {
    const usageItems = telemetry?.usage?.items || [];
    if (usageItems.length) return usageItems;
    const byModel = new Map<string, { model: string; tokens: number }>();
    sessions.forEach((session) => {
      if (!session.model) return;
      const key = session.model.split("/").pop() || session.model;
      const entry = byModel.get(key) || { model: key, tokens: 0 };
      entry.tokens += session.totalTokens || 0;
      byModel.set(key, entry);
    });
    return Array.from(byModel.values()).map((entry, index) => ({
      id: `${entry.model}-${index}`,
      model: entry.model,
      tokens: entry.tokens,
    }));
  }, [sessions, telemetry?.usage?.items]);

  const queueDepth = queueItems.reduce((sum, queue) => sum + (queue.depth || 0), 0);
  const processCount = telemetry?.processes?.items?.length || 0;

  const whoopExpiry = telemetry?.risk?.whoopTokenExpiresAt
    ? new Date(telemetry.risk.whoopTokenExpiresAt)
    : null;
  const whoopRemaining = whoopExpiry
    ? whoopExpiry.getTime() > Date.now()
      ? formatDuration(whoopExpiry.getTime() - Date.now())
      : "EXPIRED"
    : "Not configured";

  const handleCronRun = async (jobId: string) => {
    setCronAction(`Rerunning ${jobId}...`);
    try {
      const response = await fetch("/api/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      setCronAction(`Triggered ${jobId}`);
      setTimeout(() => setCronAction(null), 3000);
      fetchTelemetry();
    } catch (err) {
      setCronAction(err instanceof Error ? err.message : "Cron trigger failed");
      setTimeout(() => setCronAction(null), 4000);
    }
  };

  return (
    <main className="min-h-screen p-3 sm:p-4 md:p-8 bg-slate-950">
      <div
        className="fixed inset-0 pointer-events-none z-50 opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)",
        }}
      />

      <header className="max-w-6xl mx-auto mb-6 sm:mb-8">
        <div
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4 p-3 sm:p-4 border-4 border-slate-700 bg-slate-900"
          style={{ boxShadow: "8px 8px 0 rgba(0,0,0,0.3)" }}
        >
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-mono font-bold tracking-wider">
              <span className="text-indigo-400">AGENT</span>
              <span className="text-purple-400">_</span>
              <span className="text-pink-400">DASHBOARD</span>
            </h1>
            <p className="text-slate-600 text-[10px] sm:text-xs font-mono mt-1">{">> "}OPENCLAW SYSTEM OPS v3.0</p>
          </div>
          <ConnectionStatus connected={connected} lastUpdate={lastUpdate} />
        </div>
      </header>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-6xl mx-auto mb-6 p-3 bg-red-950 border-4 border-red-500 font-mono text-red-400 text-sm"
            style={{ boxShadow: "4px 4px 0 rgba(239,68,68,0.3)" }}
          >
            ⚠️ ERROR: {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center gap-2 mb-6 font-mono text-[10px] sm:text-xs">
          {[
            { id: "agents" as const, label: "AGENTS" },
            { id: "terminal" as const, label: "TERMINAL_FEED" },
            { id: "ops" as const, label: "OPS_STATUS" },
            { id: "cron" as const, label: "CRON_MONITOR" },
            { id: "data" as const, label: "DATA_PIPELINE" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 border-2 tracking-widest ${
                activeTab === tab.id
                  ? "bg-indigo-800 text-indigo-100 border-indigo-400"
                  : "bg-slate-900 text-slate-500 border-slate-700"
              }`}
              style={{ boxShadow: activeTab === tab.id ? "3px 3px 0 rgba(99,102,241,0.4)" : "none" }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "agents" && (
          <>
            <section className="mb-8">
              <h2 className="text-[10px] sm:text-xs font-mono text-slate-500 tracking-widest mb-4 flex items-center gap-2">
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

            <section>
              <h2 className="text-[10px] sm:text-xs font-mono text-slate-500 tracking-widest mb-4 flex items-center gap-2">
                <span className="w-8 h-px bg-slate-700" />
                WORKERS [{subagents.length}]
                <span className="flex-1 h-px bg-slate-700" />
              </h2>
              {subagents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
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
          </>
        )}

        {activeTab === "terminal" && (
          <div className="space-y-4">
            <Panel
              title="TERMINAL_FEED"
              subtitle="Live tool calls, tool results, and system messages"
              action={<SearchInput value={terminalSearch} onChange={setTerminalSearch} placeholder="Filter feed" />}
            >
              {filteredTerminal.length > 0 ? (
                <div
                  className="border-4 border-slate-800 bg-black/80 p-3 sm:p-4 text-[10px] sm:text-xs text-emerald-200 max-h-[60vh] overflow-y-auto"
                  style={{ boxShadow: "6px 6px 0 rgba(15,23,42,0.5)" }}
                >
                  {filteredTerminal.map((item) => (
                    <div key={item.id} className="whitespace-pre-wrap leading-relaxed">
                      <span className="text-slate-500">[{formatTimestamp(item.timestamp)}]</span>{" "}
                      <span className="text-indigo-300">{item.source || "main"}</span>{" "}
                      <span className="text-slate-400">{item.type}</span>{" "}
                      <span className="text-emerald-200">{item.detail}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 border-4 border-dashed border-slate-700 text-center font-mono">
                  <div className="text-3xl mb-2 opacity-40">🛰️</div>
                  <p className="text-slate-600">NO_TERMINAL_ACTIVITY</p>
                </div>
              )}
            </Panel>
          </div>
        )}

        {activeTab === "ops" && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Panel title="SYSTEM_HEALTH" subtitle="Gateway status, latency, queues, and processes">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <StateChip label="GATEWAY" value={connected ? "ONLINE" : "OFFLINE"} />
                  <StateChip
                    label="LATENCY"
                    value={telemetry?.gateway?.latencyMs ? `${telemetry.gateway.latencyMs}ms` : "-"}
                  />
                  <StateChip label="QUEUE_DEPTH" value={queueDepth ? `${queueDepth}` : "-"} />
                  <StateChip label="PROCESSES" value={processCount ? `${processCount}` : "-"} />
                </div>
                {telemetry?.sessionStatus && (
                  <div className="mt-3 text-[10px] text-slate-500 bg-black/40 border border-slate-800 p-2">
                    STATUS_PAYLOAD: {JSON.stringify(telemetry.sessionStatus).slice(0, 160)}
                  </div>
                )}
              </Panel>

              <Panel title="RISK_ALERTS" subtitle="WHOOP token expiry, SOFI risk, gateway down">
                <div className="space-y-2 text-[10px] sm:text-xs">
                  <div className="flex items-center justify-between border border-slate-800 bg-black/40 px-3 py-2">
                    <span className="text-slate-500">WHOOP_TOKEN_EXPIRY</span>
                    <span className="text-amber-300">
                      {whoopExpiry && !Number.isNaN(whoopExpiry.getTime())
                        ? `${formatTimestamp(telemetry?.risk?.whoopTokenExpiresAt || undefined)} (${whoopRemaining})`
                        : "NOT_CONFIGURED"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border border-slate-800 bg-black/40 px-3 py-2">
                    <span className="text-slate-500">SOFI_RISK</span>
                    <span className={statusTone(telemetry?.risk?.sofiRisk)}>
                      {telemetry?.risk?.sofiRisk || "UNKNOWN"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border border-slate-800 bg-black/40 px-3 py-2">
                    <span className="text-slate-500">GATEWAY_DOWN</span>
                    <span className={connected ? "text-emerald-400" : "text-red-400"}>
                      {connected ? "NO" : "YES"}
                    </span>
                  </div>
                </div>
              </Panel>
            </div>

            <Panel title="OPERATOR_SCORECARD" subtitle="Session totals, activity, and usage signal">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <StateChip label="TOTAL_SESSIONS" value={`${operatorScore.total}`} />
                <StateChip label="ACTIVE" value={`${operatorScore.executing + operatorScore.thinking}`} />
                <StateChip label="IDLE" value={`${operatorScore.idle}`} />
                <StateChip label="TOKENS" value={`${operatorScore.totalTokens}`} />
                <StateChip label="TOTAL_TURNS" value={`${operatorScore.totalTurns}`} />
                <StateChip label="LAST_ACTIVITY" value={operatorScore.lastActivity ? formatRelativeTime(operatorScore.lastActivity) : "-"} />
              </div>
            </Panel>

            <Panel title="ACTIVE_TASKS" subtitle="Running execution sessions">
              {activeSessions.length > 0 ? (
                <div className="space-y-2 text-[10px] sm:text-xs">
                  {activeSessions.map((session) => (
                    <div
                      key={session.key}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-slate-800 bg-black/40 px-3 py-2"
                    >
                      <div>
                        <div className="text-slate-300">{session.label || session.key}</div>
                        <div className="text-slate-600">{session.model?.split("/").pop() || "model"}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge state={getAgentState(session)} />
                        <span className="text-slate-500">{session.lastActivity ? formatRelativeTime(session.lastActivity) : "-"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 border-2 border-dashed border-slate-700 text-center text-slate-600 text-[10px]">
                  NO_RUNNING_TASKS
                </div>
              )}
            </Panel>

            <Panel title="AGENT_STATE_MAP" subtitle="Live state grid by session">
              {sessions.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-[10px]">
                  {sessions.map((session) => {
                    const state = getAgentState(session);
                    const tone =
                      state === "thinking"
                        ? "bg-purple-700"
                        : state === "executing"
                        ? "bg-blue-700"
                        : "bg-slate-700";
                    return (
                      <div
                        key={session.key}
                        title={session.label || session.key}
                        className={`border border-slate-800 px-2 py-2 ${tone} text-slate-100 truncate`}
                      >
                        {session.label || session.key.slice(-8)}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 border-2 border-dashed border-slate-700 text-center text-slate-600 text-[10px]">
                  NO_SESSION_MAP
                </div>
              )}
            </Panel>
          </div>
        )}

        {activeTab === "cron" && (
          <div className="space-y-4">
            <Panel
              title="CRON_MONITOR"
              subtitle="Jobs, last run, failures, and rerun"
              action={<SearchInput value={cronSearch} onChange={setCronSearch} placeholder="Filter cron jobs" />}
            >
              {cronAction && (
                <div className="mb-3 text-[10px] text-amber-300 border border-amber-500/40 bg-black/40 px-3 py-2">
                  {cronAction}
                </div>
              )}
              {filteredCronJobs.length > 0 ? (
                <div className="space-y-2 text-[10px] sm:text-xs">
                  {filteredCronJobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border border-slate-800 bg-black/40 px-3 py-2"
                    >
                      <div>
                        <div className="text-slate-200">{job.name}</div>
                        <div className="text-slate-600">{job.schedule || "schedule unknown"}</div>
                        <div className="text-slate-500">Last run: {job.lastRun ? formatRelativeTime(job.lastRun) : "-"}</div>
                        {job.lastFailure && <div className="text-red-400">{job.lastFailure}</div>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={statusTone(job.lastStatus)}>{job.lastStatus || "unknown"}</span>
                        <button
                          onClick={() => handleCronRun(job.id)}
                          className="px-3 py-1 border-2 border-indigo-500 text-indigo-200 text-[10px] hover:bg-indigo-900"
                        >
                          RERUN
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 border-2 border-dashed border-slate-700 text-center text-slate-600 text-[10px]">
                  NO_CRON_JOBS
                </div>
              )}
            </Panel>

            <Panel title="CRON_RUNS" subtitle="Recent execution history">
              {cronRuns.length > 0 ? (
                <div className="space-y-2 text-[10px] sm:text-xs">
                  {cronRuns.slice(0, 12).map((run) => (
                    <div
                      key={run.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-slate-800 bg-black/40 px-3 py-2"
                    >
                      <div>
                        <div className="text-slate-200">{run.jobId || "job"}</div>
                        <div className="text-slate-600">{run.startedAt ? formatRelativeTime(run.startedAt) : "-"}</div>
                        {run.error && <div className="text-red-400">{run.error}</div>}
                      </div>
                      <span className={statusTone(run.status)}>{run.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 border-2 border-dashed border-slate-700 text-center text-slate-600 text-[10px]">
                  NO_CRON_RUNS
                </div>
              )}
            </Panel>
          </div>
        )}

        {activeTab === "data" && (
          <div className="space-y-4">
            <Panel title="MODEL_COST_TRACKER" subtitle="Models in-flight and usage if available">
              {modelUsage.length > 0 ? (
                <div className="space-y-2 text-[10px] sm:text-xs">
                  {modelUsage.map((usage) => (
                    <div
                      key={usage.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-slate-800 bg-black/40 px-3 py-2"
                    >
                      <div>
                        <div className="text-slate-200">{usage.model}</div>
                        {('window' in usage && usage.window) && (
                          <div className="text-slate-600">{usage.window}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-300">{usage.tokens ? `${usage.tokens} tokens` : "tokens -"}</span>
                        <span className="text-amber-300">{('cost' in usage && usage.cost) ? `$${usage.cost.toFixed(4)}` : "cost -"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 border-2 border-dashed border-slate-700 text-center text-slate-600 text-[10px]">
                  NO_MODEL_USAGE_DATA
                </div>
              )}
            </Panel>

            <Panel
              title="INPUTS_OUTPUTS_QUEUE"
              subtitle="Queue depth and inflight counts"
              action={<SearchInput value={queueSearch} onChange={setQueueSearch} placeholder="Filter queues" />}
            >
              {filteredQueues.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] sm:text-xs">
                  {filteredQueues.map((queue) => (
                    <div key={queue.id} className="border border-slate-800 bg-black/40 px-3 py-2">
                      <div className="text-slate-200">{queue.name}</div>
                      <div className="text-slate-500">{queue.direction || "queue"}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-cyan-300">depth: {queue.depth ?? "-"}</span>
                        <span className="text-emerald-300">inflight: {queue.inflight ?? "-"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 border-2 border-dashed border-slate-700 text-center text-slate-600 text-[10px]">
                  NO_QUEUE_DATA
                </div>
              )}
            </Panel>

            <Panel
              title="SYSTEM_EVENTS_FEED"
              subtitle="Gateway/system events stream"
              action={<SearchInput value={eventSearch} onChange={setEventSearch} placeholder="Filter events" />}
            >
              {filteredEvents.length > 0 ? (
                <div className="space-y-2 text-[10px] sm:text-xs">
                  {filteredEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-slate-800 bg-black/40 px-3 py-2"
                    >
                      <div>
                        <div className="text-slate-200">{event.message}</div>
                        <div className="text-slate-600">{event.source || "system"}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={statusTone(event.level)}>{event.level.toUpperCase()}</span>
                        <span className="text-slate-500">{formatRelativeTime(event.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 border-2 border-dashed border-slate-700 text-center text-slate-600 text-[10px]">
                  NO_SYSTEM_EVENTS
                </div>
              )}
            </Panel>

            <Panel title="IDEAS_NEXT_ACTIONS" subtitle="Autogenerated ideas and manual overrides">
              <div className="space-y-2 text-[10px] sm:text-xs">
                <div className="border border-slate-800 bg-black/40 px-3 py-2 text-slate-300">
                  - Wire queue depth alerts into Slack or PagerDuty.
                </div>
                <div className="border border-slate-800 bg-black/40 px-3 py-2 text-slate-300">
                  - Configure WHOOP/SOFI env keys to unlock risk scoring.
                </div>
                <div className="border border-slate-800 bg-black/40 px-3 py-2 text-slate-300">
                  - Add budget thresholds for model usage spikes.
                </div>
              </div>
            </Panel>
          </div>
        )}

        {telemetry?.warnings?.length ? (
          <div className="mt-6 p-3 border-2 border-amber-500/40 bg-black/50 text-[10px] sm:text-xs text-amber-200 font-mono">
            TOOL_WARNINGS: {telemetry.warnings.join(" | ")}
          </div>
        ) : null}

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
