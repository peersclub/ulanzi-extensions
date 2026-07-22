export const SIZE: number;
export const palette: Record<string, string>;
export const statusStyle: Record<string, { color: string; glyph: string; label: string }>;

export function escapeXml(s: unknown): string;
export function toDataUrl(svg: string): string;

export function KpiTile(o: { title: string; value: string | number; sub?: string; accent?: string }): string;
export function StatusDot(o: { status: string; sub?: string; stale?: boolean }): string;
export function GaugeTile(o: { label: string; pct: number; accent?: string; sub?: string }): string;
export function SparkTile(o: { label: string; values: number[]; accent?: string; value?: string | number }): string;
export function NameTile(o: { name: string; sub?: string; accent?: string; dim?: boolean }): string;
export function ActionTile(o: { glyph: string; caption: string; accent?: string; sub?: string; dim?: boolean }): string;
