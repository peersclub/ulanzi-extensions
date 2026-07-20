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
  ts?: number;
}

export const BROKER_DIR: string;
export const STALE_MS: number;

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
