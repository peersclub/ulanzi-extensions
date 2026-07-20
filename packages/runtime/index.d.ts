import UlanziApi from "@ulanzi-lab/sdk";

export class Button {
  $UD: UlanziApi;
  context: string;
  uuid: string;
  state: Record<string, any>;
  settings: Record<string, any>;
  active: boolean;
  setIcon(dataUri: string, text?: string): void;
  setStateIcon(i: number, text?: string): void;
  hotkey(key: string): void;
  toast(msg: string): void;
  save(patch: Record<string, any>): void;
  every(ms: number, fn: () => void, opts?: { jitter?: number; leading?: boolean }): () => void;
}

export interface ActionDef {
  uuid: string;
  active?(b: Button): void;
  inactive?(b: Button): void;
  run?(b: Button): void;
  dial?(b: Button, ticks: number): void;
  dialDown?(b: Button): void;
  settings?(b: Button, settings: Record<string, any>): void;
}

export function defineAction(def: ActionDef): ActionDef;

export interface Plugin {
  $UD: UlanziApi;
  buttons: Map<string, Button>;
  start(): Plugin;
}

export function definePlugin(cfg: {
  uuid: string;
  actions: ActionDef[];
  onReady?: () => void;
}): Plugin;
