export type SessionStatus =
  | "idle"
  | "thinking"
  | "tool"
  | "awaiting_input"
  | "done"
  | "error";

export interface AiState {
  app?: string;
  model?: string;
  status?: SessionStatus;
  contextPct?: number;
  tokensUsed?: number;
  tokensWindow?: number;
  costSession?: number;
  hist?: Array<{ t: number; pct?: number | null; cost?: number | null }>;
  sessionSecs?: number;
  linesChanged?: number;
  lastTool?: string;
  mode?: "default" | "acceptEdits" | "plan" | "bypassPermissions" | string;
  cwd?: string;
  note?: string;
  ask?: { type: "permission" | "plan"; tool?: string; cmd?: string; ts?: number } | null;
  plan?: { steps: string[]; raw: string; ts: number } | null;
  name?: string;
  sessionId?: string;
  activeTs?: number;
  startedTs?: number;
  finishedTs?: number;
  viewedTs?: number;
  ts?: number;
}

export interface CurrentSession extends AiState {
  sessionId: string;
  stale: boolean;
  pinned: boolean;
  sessionCount: number;
  liveCount: number;
}

export const BROKER_DIR: string;
export const SESSIONS_DIR: string;
export const STALE_MS: number;
export const SESSION_LIVE_MS: number;

export function writeState(
  app: string,
  patch: Partial<AiState>,
  now?: () => number
): Promise<AiState>;

export function readState(
  app: string,
  now?: () => number
): (AiState & { stale?: boolean }) | null;

export function watchState(
  app: string,
  onChange: (s: AiState & { stale?: boolean }) => void
): () => void;

export function writeSession(
  app: string,
  sessionId: string,
  patch: Partial<AiState>,
  opts?: { bumpActive?: boolean; now?: () => number }
): Promise<AiState>;

export function listSessions(app: string): Array<AiState & { sessionId: string }>;

export function watchSessions(app: string, onChange: () => void): () => void;

export function setPin(app: string, sessionId: string): Promise<void>;
export function getPin(app: string): { sessionId: string; ts: number } | null;
export function clearPin(app: string): Promise<void>;
export function liveSessions(
  app: string,
  opts?: { now?: () => number }
): Array<AiState & { sessionId: string }>;

export function currentSession(
  app: string,
  opts?: { now?: () => number }
): CurrentSession | null;
