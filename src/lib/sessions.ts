import type { UIMessage } from "ai";
import type { AgentId } from "./agents";

export interface Session {
  id: string;
  title: string;
  agentId: AgentId;
  messages: UIMessage[];
  createdAt: number;
  updatedAt: number;
}

const SESSIONS_KEY = "forge.sessions.v3";
const ACTIVE_KEY = "forge.activeSession.v3";

export function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function loadSessions(): Session[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Session[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveSessions(list: Session[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(list));
  } catch {}
}

export function loadActiveId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_KEY, id);
    else window.localStorage.removeItem(ACTIVE_KEY);
  } catch {}
}

export function createSession(agentId: AgentId, title = "New Session"): Session {
  const now = Date.now();
  return { id: makeId(), title, agentId, messages: [], createdAt: now, updatedAt: now };
}

export function deriveTitle(messages: UIMessage[]): string | null {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return null;
  const text = firstUser.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim();
  if (!text) return null;
  return text.length > 48 ? text.slice(0, 48).trim() + "…" : text;
}

export function formatRelative(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}
