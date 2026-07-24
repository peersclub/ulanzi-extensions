/**
 * Typed facade over the official UlanziDeck `plugin-common-node` runtime.
 *
 * The runtime ships as plain ESM (see ./index.js). These declarations wrap the
 * real `UlanziApi` class so plugin code gets full autocomplete on `$UD.*`.
 * Payload shapes come from the official ./apiTypes.d.ts.
 */
import type {
  UlanzideckParamRespData,
  UlanzideckClearRespData,
  UlanzideckSetActiveRespData,
} from "./apiTypes";

/** A resolved per-button instance id (uuid + actionid + key), used everywhere as `context`. */
export type Context = string;

/** Decoded identity of a button instance. */
export interface DecodedContext {
  uuid: string;
  actionid: string;
  key: string;
}

export type AddPayload = UlanzideckParamRespData<"add">;
export type RunPayload = UlanzideckParamRespData<"run">;
export type SetActivePayload = UlanzideckSetActiveRespData;
export type ClearPayload = UlanzideckClearRespData;
export type SettingsPayload = UlanzideckParamRespData<"didReceiveSettings">;
export type DialRotatePayload = UlanzideckParamRespData<"dialrotate"> & {
  ticks?: number;
  /** D200X reports direction here (no ticks field). */
  rotateEvent?: "left" | "right";
};

/**
 * The `$UD` object. One instance per plugin process; `connect()` opens the
 * WebSocket bridge to UlanziDeck. A UUID with exactly 4 dot-segments is treated
 * as the "main service"; 5+ segments identify an action (Property Inspector side).
 */
export default class UlanziApi {
  uuid: string;
  isMain: boolean;

  connect(uuid: string, port?: number, address?: string): void;
  disconnect(): void;
  send(cmd: string, params: Record<string, unknown>): void;

  encodeContext(data: Partial<DecodedContext>): Context;
  decodeContext(context: Context): DecodedContext;

  // --- key rendering ---
  /** Set a state defined in manifest `States[]`, with optional label text. */
  setStateIcon(context: Context, state: number, text?: string): void;
  /** Set the key image from a data: URI (e.g. `data:image/svg+xml;base64,...`). */
  setBaseDataIcon(context: Context, dataUri: string, text?: string): void;
  /** Set the key image from a file path relative to the plugin. */
  setPathIcon(context: Context, path: string, text?: string): void;
  setGifDataIcon(context: Context, gifData: string, text?: string): void;
  setGifPathIcon(context: Context, gifPath: string, text?: string): void;

  // --- commands ---
  /** Inject a hotkey / key-combo into the OS (goes to the focused window). */
  hotkey(key: string): void;
  toast(msg: string): void;
  showAlert(context: Context): void;
  openUrl(url: string, local?: boolean, param?: unknown): void;
  /** Open a popup webview on a local page. */
  openView(url: string, width?: number, height?: number, x?: number, y?: number, param?: unknown): void;
  logMessage(msg: string, level?: string): void;

  // --- settings ---
  getSettings(context: Context): void;
  setSettings(settings: Record<string, unknown>, context: Context): void;
  getGlobalSettings(context?: Context): void;
  setGlobalSettings(settings: Record<string, unknown>, context?: Context): void;

  // --- property inspector <-> plugin ---
  sendToPropertyInspector(settings: Record<string, unknown>, context: Context): void;
  sendToPlugin(settings: Record<string, unknown>): void;
  sendParamFromPlugin(settings: Record<string, unknown>, context: Context): void;

  // --- lifecycle / events ---
  onConnected(fn: () => void): void;
  onClose(fn: () => void): void;
  onError(fn: (error: string) => void): void;
  onAdd(fn: (data: AddPayload) => void): void;
  onRun(fn: (data: RunPayload) => void): void;
  onSetActive(fn: (data: SetActivePayload) => void): void;
  onClear(fn: (data: ClearPayload) => void): void;
  onKeyDown(fn: (data: RunPayload) => void): void;
  onKeyUp(fn: (data: RunPayload) => void): void;
  onDialRotate(fn: (data: DialRotatePayload) => void): void;
  onDialDown(fn: (data: RunPayload) => void): void;
  onDialUp(fn: (data: RunPayload) => void): void;
  onDidReceiveSettings(fn: (data: SettingsPayload) => void): void;
  onDidReceiveGlobalSettings(fn: (data: SettingsPayload) => void): void;
  onSendToPlugin(fn: (data: SettingsPayload) => void): void;
  onSendToPropertyInspector(fn: (data: SettingsPayload) => void): void;
}

export declare const Utils: {
  getQueryParams(key: string): string | undefined;
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
};
export declare const RandomPort: unknown;
