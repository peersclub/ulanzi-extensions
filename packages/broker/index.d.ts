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
  costSession?: number;
  sessionSecs?: number;
  linesChanged?: number;
  lastTool?: string;
  cwd?: string;
  note?: string;
  name?: string;
  sessionId?: string;
  activeTs?: number;
  ts?: number;
}

export interface CurrentSession extends AiState {
  sessionId: string;
  stale: boolean;
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

export function currentSession(
  app: string,
  opts?: { now?: () => number }
): CurrentSession | null;
