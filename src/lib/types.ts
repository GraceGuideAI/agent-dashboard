export interface Session {
  id: string;
  label: string;
  status: 'active' | 'idle' | 'processing';
  task?: string;
  startedAt: string;
  lastActivity: string;
  messageCount: number;
  model?: string;
}

export interface ActivityItem {
  id: string;
  sessionId: string;
  sessionLabel: string;
  type: 'message' | 'tool_call' | 'completion' | 'error';
  content: string;
  timestamp: string;
}

export interface DashboardStats {
  totalSessions: number;
  activeSessions: number;
  idleSessions: number;
  totalMessages: number;
}
