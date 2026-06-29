import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowUp, Code2, Eye, Monitor, Smartphone, Tablet, RotateCw, Download, Square,
  Globe, MessagesSquare, Workflow, PenLine, Microscope, Palette, Plus, Search,
  Trash2, Zap, Cpu, Radio, MapPin, DollarSign, Phone, PhoneCall, PhoneOff, Star, ExternalLink, Loader2,
  PanelLeftClose, PanelLeft, Mail, MessageCircle, Github, Rocket, X, Delete, CheckCircle2, AlertCircle,
  Utensils, Coffee, Wine, Scissors, Dumbbell, Stethoscope, Car, Hotel, ShoppingBag,
  Wrench, BookOpen, PawPrint, Camera, Building2, Briefcase, Flower2,
  Facebook, Instagram, Linkedin, Twitter, Youtube, Music2, Sparkles, Heart,
  LogOut, User as UserIcon,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseLeadQuery } from "@/lib/lead-ai.functions";
import { extractHtml, stripCodeBlocks } from "@/lib/extract-html";
import { makeTwilioCall, listTwilioNumbers, listRecentCalls } from "@/lib/twilio.functions";
import { AGENT_LIST, getAgent, type AgentDef, type AgentId } from "@/lib/agents";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  type Session, createSession, loadSessions, saveSessions, loadActiveId, saveActiveId,
  deriveTitle, formatRelative,
} from "@/lib/sessions";
import { getMyUsage, type UsageInfo } from "@/lib/usage.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SolverHunt — Find local businesses without a website" },
      { name: "description", content: "SolverHunt scans Google Maps for nearby businesses missing a website, surfaces their contact channels, and helps you reach owners on phone, WhatsApp, or email." },
      { property: "og:title", content: "SolverHunt — Lead prospector for businesses without a website" },
      { property: "og:description", content: "Scan Google Maps for local businesses without a website and connect with owners instantly." },
    ],
  }),
  component: Index,
});

const ICONS: Record<string, LucideIcon> = {
  MessagesSquare, Globe, Code2, Workflow, PenLine, Microscope, Palette, MapPin,
};

type View = "chat" | "prospector" | "custom-website" | "waitlist";
type WaitlistTopic = "dialer" | "automations" | "others";

function Index() {
  const isMobile = useIsMobile();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<View>("prospector");
  const [waitlistTopic, setWaitlistTopic] = useState<WaitlistTopic>("dialer");
  const [prefill, setPrefill] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  useEffect(() => {
    let list = loadSessions();
    let id = loadActiveId();
    if (list.length === 0) {
      const s = createSession("chat", "New Session");
      list = [s];
      id = s.id;
    } else if (!id || !list.some((s) => s.id === id)) {
      id = list[0].id;
    }
    setSessions(list);
    setActiveId(id);
    setHydrated(true);
    // On desktop start expanded; on mobile start collapsed.
    setSidebarCollapsed(window.innerWidth < 768);
  }, []);

  useEffect(() => { if (hydrated) saveSessions(sessions); }, [sessions, hydrated]);
  useEffect(() => { if (hydrated) saveActiveId(activeId); }, [activeId, hydrated]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId],
  );

  const newSession = useCallback((agentId: AgentId = "chat", title = "New Session") => {
    const s = createSession(agentId, title);
    setSessions((prev) => [s, ...prev]);
    setActiveId(s.id);
    return s;
  }, []);

  const deleteSession = (id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (id === activeId) {
        if (next.length > 0) setActiveId(next[0].id);
        else {
          const fresh = createSession("chat");
          setActiveId(fresh.id);
          return [fresh];
        }
      }
      return next;
    });
  };

  const updateSession = useCallback((id: string, patch: Partial<Session>) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s)));
  }, []);

  const switchAgent = (agentId: AgentId) => {
    setView("chat");
    if (!activeSession) return newSession(agentId);
    if (activeSession.messages.length === 0) {
      updateSession(activeSession.id, { agentId });
    } else {
      newSession(agentId);
    }
  };

  const launchBuilderFor = (text: string) => {
    const s = newSession("chat", text.slice(0, 48));
    setPrefill(text);
    setView("chat");
    return s;
  };

  if (!hydrated || !activeSession) {
    return <div className="grid h-screen place-items-center bg-slate-50 text-emerald-600">Booting…</div>;
  }

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-slate-50 font-sans text-slate-900 antialiased">

      <LeftSidebar
        sessions={sessions}
        activeId={activeSession.id}
        activeAgentId={activeSession.agentId}
        view={view}
        waitlistTopic={waitlistTopic}
        collapsed={sidebarCollapsed}
        isMobile={isMobile}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        onPickSession={(id) => { setActiveId(id); setView("chat"); if (isMobile) setSidebarCollapsed(true); }}
        onNewSession={() => { newSession(activeSession.agentId); setView("chat"); if (isMobile) setSidebarCollapsed(true); }}
        onDeleteSession={deleteSession}
        onPickAgent={(id) => { switchAgent(id); if (isMobile) setSidebarCollapsed(true); else setSidebarCollapsed(false); }}
        onPickProspector={() => { setView("prospector"); if (isMobile) setSidebarCollapsed(true); }}
        onPickCustomWebsite={() => { setView("custom-website"); if (isMobile) setSidebarCollapsed(true); }}
        onPickWaitlist={(topic) => { setWaitlistTopic(topic); setView("waitlist"); if (isMobile) setSidebarCollapsed(true); }}
      />
      {/* Mobile backdrop when sidebar expanded */}
      {isMobile && !sidebarCollapsed && (
        <button
          aria-label="Close sidebar"
          onClick={() => setSidebarCollapsed(true)}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
        />
      )}
      {view === "chat" ? (
        <ChatWorkspace
          key={activeSession.id}
          session={activeSession}
          onUpdate={(patch) => updateSession(activeSession.id, patch)}
          prefill={prefill}
          onPrefillConsumed={() => setPrefill(null)}
        />
      ) : view === "custom-website" ? (
        <CustomWebsiteView />
      ) : view === "waitlist" ? (
        <WaitlistView topic={waitlistTopic} />
      ) : (
        <MapsProspector onBuildSiteFor={launchBuilderFor} />
      )}
    </div>
  );
}

/* =============================== LEFT SIDEBAR =============================== */

function LeftSidebar({
  sessions, activeId, activeAgentId, view, waitlistTopic, collapsed, isMobile, onToggleCollapsed,
  onPickSession, onNewSession, onDeleteSession, onPickAgent, onPickProspector, onPickCustomWebsite, onPickWaitlist,
}: {
  sessions: Session[];
  activeId: string;
  activeAgentId: AgentId;
  view: View;
  waitlistTopic: WaitlistTopic;
  collapsed: boolean;
  isMobile: boolean;
  onToggleCollapsed: () => void;
  onPickSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onPickAgent: (id: AgentId) => void;
  onPickProspector: () => void;
  onPickCustomWebsite: () => void;
  onPickWaitlist: (topic: WaitlistTopic) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? sessions.filter((s) => s.title.toLowerCase().includes(q)) : sessions;
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [sessions, query]);

  const NAV_BG = "bg-[#0e2a47]";
  const NAV_BG_HOVER = "hover:bg-white/5";
  const NAV_ACTIVE = "bg-white/10 text-white";
  const NAV_IDLE = "text-slate-300";

  if (collapsed) {
    return (
      <aside className={`relative z-40 flex w-[60px] shrink-0 flex-col items-center gap-2 ${NAV_BG} py-3`}>
        <button
          onClick={onToggleCollapsed}
          className="grid h-9 w-9 place-items-center rounded-md text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <div className="my-1 flex flex-col items-center gap-1">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-emerald-500 text-white text-sm font-black leading-none">SH</div>
        </div>
        <button
          onClick={onNewSession}
          className="grid h-9 w-9 place-items-center rounded-md bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
          aria-label="New session"
          title="New session"
        >
          <Plus className="h-4 w-4" />
        </button>
        <div className="mt-2 h-px w-8 bg-white/10" />
        <button
          onClick={onPickProspector}
          title="Leads Map"
          className={`grid h-9 w-9 place-items-center rounded-md transition-colors ${
            view === "prospector" ? NAV_ACTIVE : `${NAV_IDLE} ${NAV_BG_HOVER} hover:text-white`
          }`}
        >
          <MapPin className="h-4 w-4" />
        </button>
        {AGENT_LIST.map((a) => {
          const Icon = ICONS[a.icon] ?? MessagesSquare;
          const active = view === "chat" && a.id === activeAgentId;
          return (
            <button
              key={a.id}
              onClick={() => onPickAgent(a.id)}
              title={a.name}
              className={`grid h-9 w-9 place-items-center rounded-md transition-colors ${
                active ? NAV_ACTIVE : `${NAV_IDLE} ${NAV_BG_HOVER} hover:text-white`
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
        <button
          onClick={onPickCustomWebsite}
          title="Custom Website Design"
          className={`grid h-9 w-9 place-items-center rounded-md transition-colors ${
            view === "custom-website" ? NAV_ACTIVE : `${NAV_IDLE} ${NAV_BG_HOVER} hover:text-white`
          }`}
        >
          <Sparkles className="h-4 w-4" />
        </button>
        <div className="mt-2 h-px w-8 bg-white/10" />
        <button
          onClick={() => onPickWaitlist("dialer")}
          title="Dialer (Waitlist)"
          className={`grid h-9 w-9 place-items-center rounded-md transition-colors ${
            view === "waitlist" && waitlistTopic === "dialer" ? NAV_ACTIVE : `${NAV_IDLE} ${NAV_BG_HOVER} hover:text-white`
          }`}
        >
          <Phone className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPickWaitlist("automations")}
          title="Automations (Waitlist)"
          className={`grid h-9 w-9 place-items-center rounded-md transition-colors ${
            view === "waitlist" && waitlistTopic === "automations" ? NAV_ACTIVE : `${NAV_IDLE} ${NAV_BG_HOVER} hover:text-white`
          }`}
        >
          <Workflow className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPickWaitlist("others")}
          title="Others"
          className={`grid h-9 w-9 place-items-center rounded-md transition-colors ${
            view === "waitlist" && waitlistTopic === "others" ? NAV_ACTIVE : `${NAV_IDLE} ${NAV_BG_HOVER} hover:text-white`
          }`}
        >
          <Cpu className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className={`${isMobile ? "fixed inset-y-0 left-0 z-40 w-[85vw] max-w-[280px] shadow-2xl shadow-black/40" : "relative w-[240px]"} flex shrink-0 flex-col ${NAV_BG} text-white`}>
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-5">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-emerald-500 text-white text-xs font-black leading-none">SH</span>
        <div className="flex flex-col leading-tight">
          <span className="text-base font-bold tracking-tight text-white">SolverHunt</span>
        </div>
        <button
          onClick={onToggleCollapsed}
          className="ml-auto grid h-7 w-7 place-items-center rounded-md text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Main nav */}
      <nav className="px-3 pt-2 space-y-1">
        <button
          onClick={onPickProspector}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            view === "prospector" ? NAV_ACTIVE : `${NAV_IDLE} ${NAV_BG_HOVER} hover:text-white`
          }`}
        >
          <MapPin className="h-4 w-4" />
          <span className="flex-1 text-left">Leads Map</span>
        </button>

        {AGENT_LIST.map((a) => {
          const Icon = ICONS[a.icon] ?? MessagesSquare;
          const active = view === "chat" && a.id === activeAgentId;
          return (
            <button
              key={a.id}
              onClick={() => onPickAgent(a.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? NAV_ACTIVE : `${NAV_IDLE} ${NAV_BG_HOVER} hover:text-white`
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">{a.name}</span>
            </button>
          );
        })}

        <button
          onClick={onPickCustomWebsite}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            view === "custom-website" ? NAV_ACTIVE : `${NAV_IDLE} ${NAV_BG_HOVER} hover:text-white`
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span className="flex-1 text-left">Custom Website Design</span>
        </button>

        <button
          onClick={onNewSession}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${NAV_IDLE} ${NAV_BG_HOVER} hover:text-white`}
        >
          <Plus className="h-4 w-4 text-emerald-400" />
          <span className="flex-1 text-left">New Session</span>
        </button>
      </nav>

      {/* Waitlist */}
      <div className="px-3 pt-5">
        <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Waitlist</div>
        <div className="space-y-0.5">
          {([
            { id: "dialer" as const, name: "Dialer", icon: Phone },
            { id: "automations" as const, name: "Automations", icon: Workflow },
            { id: "others" as const, name: "Others", icon: Cpu },
          ]).map((item) => {
            const Icon = item.icon;
            const active = view === "waitlist" && waitlistTopic === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onPickWaitlist(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? NAV_ACTIVE : `${NAV_IDLE} ${NAV_BG_HOVER} hover:text-white`
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1 text-left">{item.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sessions */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-6 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <span>Sessions</span>
        </div>
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 focus-within:bg-white/10">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sessions…"
              className="w-full bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-[11px] text-slate-500">No sessions.</div>
          )}
          {filtered.map((s) => {
            const agent = getAgent(s.agentId);
            const Icon = ICONS[agent.icon] ?? MessagesSquare;
            const active = view === "chat" && s.id === activeId;
            return (
              <div
                key={s.id}
                className={`group relative rounded-lg px-3 py-2 transition-colors ${
                  active ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                <button onClick={() => onPickSession(s.id)} className="block w-full text-left">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-emerald-400" : "text-slate-400"}`} />
                    <span className={`truncate text-xs ${active ? "text-white" : "text-slate-300"}`}>
                      {s.title}
                    </span>
                  </div>
                  <div className="mt-0.5 pl-5 text-[10px] text-slate-500">
                    {formatRelative(s.updatedAt)}
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }}
                  className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded text-slate-400 opacity-0 transition-opacity hover:bg-rose-500/20 hover:text-rose-400 group-hover:opacity-100"
                  aria-label="Delete session"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-white/5 px-3 py-3 space-y-1">
        <a
          href="https://www.solverwebsite.com/contact"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex w-full items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-sm font-medium text-white shadow-[0_8px_24px_-12px_rgba(34,211,238,0.55)] transition-all hover:shadow-[0_12px_30px_-10px_rgba(34,211,238,0.85)]"
          style={{
            background:
              "linear-gradient(135deg, rgb(16,185,129) 0%, rgb(34,211,238) 50%, rgb(59,130,246) 100%)",
          }}
        >
          <Mail className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Contact Us</span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            ↗
          </span>
        </a>
        <a
          href="https://buy.stripe.com/eVqdR92AC49hbN40Xu5Rm00"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex w-full items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-sm font-medium text-white shadow-[0_8px_24px_-12px_rgba(244,114,182,0.6)] transition-all hover:shadow-[0_12px_30px_-10px_rgba(244,114,182,0.8)]"
          style={{
            background:
              "linear-gradient(135deg, rgb(244,114,182) 0%, rgb(217,70,239) 50%, rgb(139,92,246) 100%)",
          }}
        >
          <Heart className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Support Us</span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            ♥
          </span>
        </a>
        <Link
          to="/subscription"
          className="group relative flex w-full items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-sm font-medium text-white shadow-[0_8px_24px_-12px_rgba(16,185,129,0.6)] transition-all hover:shadow-[0_12px_30px_-10px_rgba(16,185,129,0.8)]"
          style={{
            background:
              "linear-gradient(135deg, rgb(16,185,129) 0%, rgb(20,184,166) 50%, rgb(59,130,246) 100%)",
          }}
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Upgrade</span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            Pro
          </span>
        </Link>
        <UserAccountMenu />
      </div>
    </aside>
  );
}

function UserAccountMenu() {
  const [user, setUser] = useState<{ email?: string | null; name?: string | null; avatar?: string | null } | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const u = data.user;
      if (!u) { setUser(null); return; }
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      setUser({
        email: u.email,
        name: (meta.full_name as string) || (meta.name as string) || null,
        avatar: (meta.avatar_url as string) || (meta.picture as string) || null,
      });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      if (!u) { setUser(null); return; }
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      setUser({
        email: u.email,
        name: (meta.full_name as string) || (meta.name as string) || null,
        avatar: (meta.avatar_url as string) || (meta.picture as string) || null,
      });
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!user) {
    return (
      <Link
        to="/auth"
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
      >
        <UserIcon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Sign in</span>
      </Link>
    );
  }

  const initials = (user.name || user.email || "U").trim().charAt(0).toUpperCase();
  const display = user.name || user.email || "Account";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-200 hover:bg-white/5"
      >
        {user.avatar ? (
          <img src={user.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 text-xs font-bold text-white">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0 text-left">
          <div className="truncate text-xs font-semibold text-white">{display}</div>
          {user.name && user.email && (
            <div className="truncate text-[11px] text-slate-400">{user.email}</div>
          )}
        </div>
      </button>
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-lg border border-white/10 bg-[#0e2a47] shadow-2xl">
          <Link
            to="/subscription"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-200 hover:bg-white/5"
          >
            <Sparkles className="h-4 w-4 text-emerald-400" />
            Upgrade plan
          </Link>
          <button
            onClick={async () => { setOpen(false); await supabase.auth.signOut(); window.location.href = "/"; }}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-rose-300 hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

/* =============================== CHAT WORKSPACE =============================== */

type Device = "desktop" | "tablet" | "mobile";

function ChatWorkspace({
  session, onUpdate, prefill, onPrefillConsumed,
}: {
  session: Session;
  onUpdate: (patch: Partial<Session>) => void;
  prefill: string | null;
  onPrefillConsumed: () => void;
}) {
  const agent = getAgent(session.agentId);
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { agentId: session.agentId } }),
    [session.agentId],
  );

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport,
    messages: session.messages,
    id: session.id,
  });

  const [input, setInput] = useState("");
  const [previewOpen, setPreviewOpen] = useState(true);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (prefill) {
      setInput(prefill);
      onPrefillConsumed();
      textareaRef.current?.focus();
    }
  }, [prefill, onPrefillConsumed]);

  useEffect(() => {
    if (messages === session.messages) return;
    const patch: Partial<Session> = { messages };
    if (session.title === "New Session") {
      const t = deriveTitle(messages);
      if (t) patch.title = t;
    }
    onUpdate(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => { textareaRef.current?.focus(); }, [status, session.id]);

  const isLoading = status === "submitted" || status === "streaming";

  // Find the latest assistant message that contains HTML — that's what we render in the side preview.
  // While streaming, we DO NOT update the preview: we keep showing the previously finished site
  // (or a "Building…" placeholder if there is none yet). The preview only refreshes once the
  // assistant has finished writing the new HTML, so the user sees the final result, not the build.
  const latestHtml = useMemo(() => {
    if (!agent.producesHtml) return null;
    if (isLoading) return null; // recomputed below to keep prior value while streaming
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
      const h = extractHtml(text);
      if (h && (h.toLowerCase().includes("<html") || h.toLowerCase().includes("<!doctype"))) return h;
    }
    return null;
  }, [messages, agent.producesHtml, isLoading]);

  // Keep last finished HTML so the preview pane stays mounted while a new build is streaming.
  const lastFinishedHtmlRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isLoading && latestHtml) lastFinishedHtmlRef.current = latestHtml;
  }, [isLoading, latestHtml]);
  const stableHtml = latestHtml ?? lastFinishedHtmlRef.current;

  // Detect if the assistant is currently building a site (so we can swap the preview for a
  // "Building…" loader instead of showing the half-streamed code).
  const isBuilding = useMemo(() => {
    if (!isLoading || !agent.producesHtml) return false;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return status === "submitted";
    const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    return /```html|<!doctype|<html/i.test(text);
  }, [messages, status, isLoading, agent.producesHtml]);

  const showPreview = previewOpen && (!!stableHtml || isBuilding);



  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage({ text });
    setInput("");
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const clearConversation = () => {
    setMessages([]);
    onUpdate({ messages: [], title: "New Session" });
  };

  const AgentIcon = ICONS[agent.icon] ?? MessagesSquare;

  return (
    <main className="relative flex min-w-0 flex-1 flex-col bg-slate-50 text-slate-900 lg:flex-row">
      {/* CHAT COLUMN */}
      <section className={`flex min-w-0 flex-col ${showPreview ? "lg:w-[44%] lg:max-w-[640px]" : "flex-1"}`}>
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 sm:gap-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
              <AgentIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">{agent.name}</div>
              <div className="hidden truncate text-xs text-slate-500 sm:block">{agent.tagline}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs">
            <div className="hidden items-center gap-1.5 text-emerald-600 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {isLoading ? "Working" : "Ready"}
            </div>
            {latestHtml && !previewOpen && (
              <button
                onClick={() => setPreviewOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <Eye className="h-3.5 w-3.5" /> Preview
              </button>
            )}
            <button
              onClick={clearConversation}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </header>

        {/* Conversation */}
        <div ref={transcriptRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-3 py-6 sm:px-6 sm:py-8">
            {messages.length === 0 ? (
              <EmptyChat agent={agent} onSuggest={(t) => setInput(t)} />
            ) : (
              <div className="space-y-5">
                {messages.map((m) => (
                  <Message key={m.id} message={m} producesHtml={agent.producesHtml} />
                ))}
                {status === "submitted" && (
                  <div className="flex items-center gap-1.5 px-1 text-xs text-emerald-600">
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="ml-1">Thinking…</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-3 sm:px-6 sm:py-4">
          <form onSubmit={handleSubmit} className="mx-auto w-full max-w-3xl">
            <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm focus-within:border-emerald-400">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                rows={3}
                placeholder={agent.placeholder}
                className="block w-full resize-none bg-transparent px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-3 py-2">
                <div className="flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                  <Radio className="h-3 w-3" /> {agent.name}
                </div>
                {isLoading ? (
                  <button
                    type="button"
                    onClick={stop}
                    className="flex items-center gap-1.5 rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                  >
                    <Square className="h-3 w-3 fill-current" /> Stop
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                  >
                    Send <ArrowUp className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
            <div className="mt-2 text-center text-[11px] text-slate-400">
              Enter to send · Shift+Enter newline
            </div>
          </form>
        </div>
      </section>

      {/* SIDE PREVIEW PANEL */}
      {showPreview && (
        <aside className="flex min-h-[60vh] flex-1 flex-col border-t border-slate-200 bg-white lg:min-h-0 lg:border-l lg:border-t-0">
          <SidePreview html={stableHtml} onClose={() => setPreviewOpen(false)} streaming={isLoading} building={isBuilding} />
        </aside>
      )}
    </main>
  );
}

function EmptyChat({ agent, onSuggest }: { agent: AgentDef; onSuggest: (t: string) => void }) {
  const Icon = ICONS[agent.icon] ?? MessagesSquare;
  return (
    <div className="grid place-items-center py-12 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-sm">
        <Icon className="h-6 w-6" />
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
        {agent.name}
      </h1>
      <p className="mt-2 text-sm text-slate-500">{agent.tagline}</p>
      {agent.suggestions.length > 0 && (
        <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
          {agent.suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onSuggest(s)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 hover:text-slate-900"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* =============================== MESSAGE + SIDE PREVIEW =============================== */

function Message({ message, producesHtml }: { message: UIMessage; producesHtml: boolean }) {
  const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-emerald-600 px-4 py-3 text-white shadow-sm">
          <p className="whitespace-pre-wrap text-sm">{text}</p>
        </div>
      </div>
    );
  }

  const hasHtml = producesHtml && !!extractHtml(text);
  const display = producesHtml ? stripCodeBlocks(text) : text;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Assistant</div>
        <div className="prose prose-sm max-w-none text-sm text-slate-800 prose-p:my-2 prose-headings:my-3 prose-headings:text-slate-900 prose-strong:text-slate-900 prose-pre:my-3 prose-pre:rounded-lg prose-pre:border prose-pre:border-slate-200 prose-pre:bg-slate-50 prose-pre:p-3 prose-pre:text-xs prose-pre:text-slate-800 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-xs prose-code:text-emerald-700 prose-code:before:content-none prose-code:after:content-none prose-a:text-emerald-700">
          <ReactMarkdown>{display || (hasHtml ? "Built your site — see the preview →" : " ")}</ReactMarkdown>
        </div>
        {hasHtml && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
            <Eye className="h-3 w-3" /> Live preview opened on the right
          </div>
        )}
      </div>
    </div>
  );
}

function SidePreview({
  html, onClose, streaming, building,
}: {
  html: string | null;
  onClose: () => void;
  streaming: boolean;
  building: boolean;
}) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [device, setDevice] = useState<Device>("desktop");
  const [iframeKey, setIframeKey] = useState(0);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [ghOpen, setGhOpen] = useState(false);
  const width = device === "desktop" ? "100%" : device === "tablet" ? "768px" : "390px";
  const hasHtml = !!html;

  const download = () => {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "index.html"; a.click();
    URL.revokeObjectURL(url);
  };

  const openNewTab = () => {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const publish = () => {
    if (!html) return;
    download();
    const blob = new Blob([html], { type: "text/html" });
    setPublishedUrl(URL.createObjectURL(blob));
    window.open("https://app.netlify.com/drop", "_blank");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Top action bar */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3">
        <div className="flex items-center gap-1.5">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-emerald-100 text-emerald-700">
            <Eye className="h-3 w-3" />
          </span>
          <span className="text-sm font-semibold text-slate-900">Live Preview</span>
          {building && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
              <Loader2 className="h-2.5 w-2.5 animate-spin" /> Building
            </span>
          )}
          {streaming && !building && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
              <Loader2 className="h-2.5 w-2.5 animate-spin" /> Working
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={publish}
            disabled={!hasHtml}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
            title="Publish — downloads the file and opens Netlify Drop"
          >
            <Rocket className="h-3 w-3" /> Publish
          </button>
          <button
            onClick={() => setGhOpen(true)}
            disabled={!hasHtml}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            title="Publish to GitHub"
          >
            <Github className="h-3 w-3" /> GitHub
          </button>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Toolbar: tabs + device + utilities */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-2">
        <div className="flex items-center gap-1">
          <TabBtn active={tab === "preview"} onClick={() => setTab("preview")}><Eye className="h-3 w-3" /> Preview</TabBtn>
          <TabBtn active={tab === "code"} onClick={() => setTab("code")}><Code2 className="h-3 w-3" /> Code</TabBtn>
        </div>
        <div className="flex items-center gap-1">
          <IconBtn active={device === "desktop"} onClick={() => setDevice("desktop")} label="Desktop"><Monitor className="h-3 w-3" /></IconBtn>
          <IconBtn active={device === "tablet"} onClick={() => setDevice("tablet")} label="Tablet"><Tablet className="h-3 w-3" /></IconBtn>
          <IconBtn active={device === "mobile"} onClick={() => setDevice("mobile")} label="Mobile"><Smartphone className="h-3 w-3" /></IconBtn>
          <IconBtn onClick={() => setIframeKey((k) => k + 1)} label="Reload"><RotateCw className="h-3 w-3" /></IconBtn>
          <IconBtn onClick={openNewTab} label="Open in new tab"><ExternalLink className="h-3 w-3" /></IconBtn>
          <IconBtn onClick={download} label="Download HTML"><Download className="h-3 w-3" /></IconBtn>
        </div>
      </div>

      {publishedUrl && (
        <div className="flex shrink-0 items-center gap-2 border-b border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
          <Rocket className="h-3 w-3" />
          <span className="font-medium">Ready to publish.</span>
          <span className="opacity-80">Drop the downloaded file onto Netlify Drop, or </span>
          <a href={publishedUrl} target="_blank" rel="noreferrer" className="underline font-medium">open temporary preview</a>
        </div>
      )}

      {/* Preview / code area */}
      <div className="min-h-0 flex-1 bg-slate-100 p-2">
        {building ? (
          <BuildingPlaceholder />
        ) : tab === "preview" ? (
          hasHtml ? (
            <div className="mx-auto h-full transition-all" style={{ width, maxWidth: "100%" }}>
              <iframe
                key={iframeKey}
                srcDoc={html!}
                title="Preview"
                sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
                className="h-full w-full rounded-md border border-slate-200 bg-white shadow-sm"
              />
            </div>
          ) : (
            <div className="grid h-full place-items-center text-xs text-slate-400">No site yet.</div>
          )
        ) : (
          <pre className="h-full overflow-auto rounded-md border border-slate-200 bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-emerald-300">
            <code>{html ?? ""}</code>
          </pre>
        )}
      </div>

      {ghOpen && html && (
        <GitHubPublishModal html={html} onClose={() => setGhOpen(false)} />
      )}
    </div>
  );
}

function BuildingPlaceholder() {
  return (
    <div className="grid h-full place-items-center rounded-md border border-dashed border-emerald-200 bg-white">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative grid h-14 w-14 place-items-center rounded-full bg-emerald-50 ring-1 ring-emerald-200">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
        </div>
        <div className="text-sm font-semibold text-slate-900">Building your site…</div>
        <div className="max-w-xs text-xs text-slate-500">
          The preview will appear here automatically when it's ready.
        </div>
      </div>
    </div>
  );
}

/* =============================== GITHUB PUBLISH =============================== */

function GitHubPublishModal({ html, onClose }: { html: string; onClose: () => void }) {
  const [token, setToken] = useState<string>(() =>
    (typeof window !== "undefined" ? localStorage.getItem("gh_token") ?? "" : "")
  );
  const [repo, setRepo] = useState<string>(() => `site-${Date.now().toString(36)}`);
  const [remember, setRemember] = useState(true);
  const [enablePages, setEnablePages] = useState(true);
  const [status, setStatus] = useState<"idle" | "publishing" | "done" | "error">("idle");
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<{ repoUrl: string; pagesUrl: string | null } | null>(null);

  const append = (s: string) => setLog((l) => [...l, s]);

  const publish = async () => {
    if (!token.trim() || !repo.trim()) return;
    setStatus("publishing");
    setLog([]);
    setResult(null);
    try {
      const headers = {
        "Authorization": `Bearer ${token.trim()}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      };

      append("Verifying token…");
      const userRes = await fetch("https://api.github.com/user", { headers });
      if (!userRes.ok) throw new Error(`GitHub auth failed (${userRes.status}). Check token has 'repo' scope.`);
      const user = await userRes.json();
      const owner = user.login as string;
      append(`Signed in as @${owner}`);

      append(`Creating repo ${repo}…`);
      const createRes = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: repo, description: "Built with SolverHunt", auto_init: true, private: false,
        }),
      });
      if (!createRes.ok && createRes.status !== 422) {
        const t = await createRes.text();
        throw new Error(`Repo create failed: ${createRes.status} ${t}`);
      }
      if (createRes.status === 422) append("Repo already exists — uploading files into it.");
      else append("Repo created.");

      // Tiny wait for auto_init to settle.
      await new Promise((r) => setTimeout(r, 800));

      const toB64 = (s: string) => {
        // utf-8 safe base64
        const bytes = new TextEncoder().encode(s);
        let bin = "";
        bytes.forEach((b) => (bin += String.fromCharCode(b)));
        return btoa(bin);
      };

      const putFile = async (path: string, content: string, message: string) => {
        // Check if file exists to get sha
        let sha: string | undefined;
        const probe = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers });
        if (probe.ok) {
          const j = await probe.json();
          sha = j.sha;
        }
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
          method: "PUT",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ message, content: toB64(content), sha }),
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(`Upload ${path} failed: ${res.status} ${t}`);
        }
      };

      append("Uploading index.html…");
      await putFile("index.html", html, "Add site");
      append("Uploading README.md…");
      await putFile("README.md", `# ${repo}\n\nBuilt and published with SolverHunt.\n`, "Add README");

      let pagesUrl: string | null = null;
      if (enablePages) {
        append("Enabling GitHub Pages…");
        const pagesRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ source: { branch: "main", path: "/" } }),
        });
        if (pagesRes.ok || pagesRes.status === 409) {
          pagesUrl = `https://${owner}.github.io/${repo}/`;
          append(`Pages will be live at ${pagesUrl} (takes ~1 min).`);
        } else {
          append(`Pages enable returned ${pagesRes.status} — you can enable it manually in repo Settings → Pages.`);
        }
      }

      const repoUrl = `https://github.com/${owner}/${repo}`;
      setResult({ repoUrl, pagesUrl });
      setStatus("done");
      if (remember) localStorage.setItem("gh_token", token.trim());
      else localStorage.removeItem("gh_token");
    } catch (e: any) {
      append(`Error: ${e?.message || String(e)}`);
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Github className="h-4 w-4" /> Publish to GitHub
          </div>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <p className="text-xs text-slate-500">
            Paste a GitHub <a className="text-emerald-700 underline" target="_blank" rel="noreferrer" href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=SolverHunt">Personal Access Token</a> with <code className="rounded bg-slate-100 px-1">repo</code> scope. We'll create a new repo, push the site, and turn on GitHub Pages.
          </p>

          <label className="block text-xs font-medium text-slate-700">GitHub token
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_…"
              className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>

          <label className="block text-xs font-medium text-slate-700">Repository name
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value.replace(/[^a-zA-Z0-9._-]/g, "-"))}
              className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>

          <div className="flex items-center gap-4 text-xs text-slate-700">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={enablePages} onChange={(e) => setEnablePages(e.target.checked)} />
              Enable GitHub Pages
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Remember token on this device
            </label>
          </div>

          {log.length > 0 && (
            <div className="max-h-40 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-[11px] text-slate-700">
              {log.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}

          {result && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <div className="font-semibold">Published 🎉</div>
              <div className="mt-1">
                Repo: <a className="underline" target="_blank" rel="noreferrer" href={result.repoUrl}>{result.repoUrl}</a>
              </div>
              {result.pagesUrl && (
                <div className="mt-0.5">
                  Live site: <a className="underline" target="_blank" rel="noreferrer" href={result.pagesUrl}>{result.pagesUrl}</a>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
          <button
            onClick={publish}
            disabled={status === "publishing" || !token.trim() || !repo.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            {status === "publishing" ? <><Loader2 className="h-3 w-3 animate-spin" /> Publishing…</> : <><Github className="h-3 w-3" /> Publish</>}
          </button>
        </div>
      </div>
    </div>
  );
}


function TabBtn({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
        active ? "bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200" : "text-slate-500 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

function IconBtn({ active, onClick, children, label }: { active?: boolean; onClick: () => void; children: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-7 w-7 place-items-center rounded-md transition-colors ${
        active ? "bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200" : "text-slate-500 hover:bg-white hover:text-emerald-700"
      }`}
    >
      {children}
    </button>
  );
}

/* =============================== MAPS PROSPECTOR =============================== */

interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  tiktok?: string;
  youtube?: string;
  whatsapp?: string;
}

interface LeadEnrichment {
  status: "pending" | "done" | "error";
  email?: string | null;
  socials?: SocialLinks;
}

interface Place {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  intlPhone?: string | null;
  website: string | null;
  mapsUri: string | null;
  rating: number | null;
  reviews: number | null;
  category: string | null;
  primaryType?: string | null;
  types?: string[];
  status: string | null;
}

const METERS_PER_MILE = 1609.344;

// Map a Google primaryType / category text to an icon + color hint.
function categoryIconKey(p: Place): string {
  const t = `${p.primaryType ?? ""} ${(p.types ?? []).join(" ")} ${p.category ?? ""}`.toLowerCase();
  if (/restaurant|food|meal|pizza|burger|steak|sushi|deli|diner|brunch/.test(t)) return "restaurant";
  if (/cafe|coffee|tea|bakery|patisser|donut/.test(t)) return "cafe";
  if (/bar|pub|brewery|wine|cocktail|lounge|night/.test(t)) return "bar";
  if (/hair|salon|barber|beauty|nail|spa/.test(t)) return "scissors";
  if (/gym|fitness|yoga|pilates|crossfit|trainer/.test(t)) return "dumbbell";
  if (/dentist|doctor|clinic|hospital|pharmac|chiroprac|medical|health|veterinar/.test(t)) return "stethoscope";
  if (/car|auto|mechanic|tire|towing|detail|gas_station/.test(t)) return "car";
  if (/hotel|lodging|motel|inn|resort/.test(t)) return "hotel";
  if (/store|shop|market|grocery|boutique|retail|clothing|jewel|book|electronic/.test(t)) return "shop";
  if (/plumb|electric|hvac|roof|paint|handyman|contract|construct|landscape|clean|locksmith|mover/.test(t)) return "wrench";
  if (/school|tutor|education|university|library/.test(t)) return "book";
  if (/pet|dog|cat|grooming/.test(t)) return "paw";
  if (/photograph|studio|art|gallery|music|theatre|cinema|entertain/.test(t)) return "camera";
  if (/real_estate|apartment|property/.test(t)) return "building";
  if (/lawyer|attorney|legal|account|finance|bank|insurance|consult/.test(t)) return "briefcase";
  if (/florist|flower|garden/.test(t)) return "flower";
  return "globe";
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  restaurant: Utensils, cafe: Coffee, bar: Wine, scissors: Scissors,
  dumbbell: Dumbbell, stethoscope: Stethoscope, car: Car, hotel: Hotel,
  shop: ShoppingBag, wrench: Wrench, book: BookOpen, paw: PawPrint,
  camera: Camera, building: Building2, briefcase: Briefcase, flower: Flower2,
  globe: Globe,
};

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: "bg-orange-100 text-orange-600",
  cafe: "bg-amber-100 text-amber-700",
  bar: "bg-purple-100 text-purple-600",
  scissors: "bg-pink-100 text-pink-600",
  dumbbell: "bg-red-100 text-red-600",
  stethoscope: "bg-sky-100 text-sky-700",
  car: "bg-slate-200 text-slate-700",
  hotel: "bg-indigo-100 text-indigo-600",
  shop: "bg-fuchsia-100 text-fuchsia-600",
  wrench: "bg-yellow-100 text-yellow-700",
  book: "bg-blue-100 text-blue-600",
  paw: "bg-emerald-100 text-emerald-700",
  camera: "bg-teal-100 text-teal-700",
  building: "bg-stone-200 text-stone-700",
  briefcase: "bg-slate-100 text-slate-700",
  flower: "bg-rose-100 text-rose-600",
  globe: "bg-slate-100 text-slate-500",
};

function CategoryBadge({ place }: { place: Place }) {
  const key = categoryIconKey(place);
  const Icon = CATEGORY_ICONS[key] ?? Globe;
  const cls = CATEGORY_COLORS[key] ?? CATEGORY_COLORS.globe;
  return (
    <span className={`grid h-7 w-7 place-items-center rounded-md ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

// Best-effort: derive an email guess from a website domain. Returns null if not usable.
function guessEmailFromWebsite(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = u.hostname.replace(/^www\./, "");
    if (!host || host.split(".").length < 2) return null;
    return `info@${host}`;
  } catch {
    return null;
  }
}

const BROWSER_KEY = (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined) ?? "";
const TRACKING_ID = (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined) ?? "";

// Global Maps JS loader (singleton).
let mapsPromise: Promise<any> | null = null;
function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    if (!BROWSER_KEY) { reject(new Error("Missing Google Maps browser key")); return; }
    (window as any).__forgeInitMap = () => resolve((window as any).google);
    const s = document.createElement("script");
    const params = new URLSearchParams({
      key: BROWSER_KEY,
      loading: "async",
      callback: "__forgeInitMap",
      language: "en",
      region: "US",
    });
    if (TRACKING_ID) params.set("channel", TRACKING_ID);
    s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    s.async = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return mapsPromise;
}

const CATEGORIES: { label: string; query: string }[] = [
  { label: "All businesses", query: "__ALL__" },
  // Local services
  { label: "Apartments", query: "apartments" },
  { label: "Barbers", query: "barber shops" },
  { label: "Hair Salons", query: "hair salons" },
  { label: "Nail Salons", query: "nail salons" },
  { label: "Tattoo Shops", query: "tattoo shops" },
  { label: "Restaurants", query: "restaurants" },
  { label: "Cafes", query: "cafes" },
  { label: "Food Trucks", query: "food trucks" },
  { label: "Bakeries", query: "bakeries" },
  { label: "Plumbers", query: "plumbers" },
  { label: "Electricians", query: "electricians" },
  { label: "Roofers", query: "roofing contractors" },
  { label: "Landscapers", query: "landscaping services" },
  { label: "Cleaning", query: "cleaning services" },
  { label: "Auto Repair", query: "auto repair shops" },
  { label: "Car Detailing", query: "car detailing" },
  { label: "Tow Trucks", query: "towing services" },
  { label: "Locksmiths", query: "locksmiths" },
  { label: "Movers", query: "moving companies" },
  { label: "Handymen", query: "handyman services" },
  { label: "HVAC", query: "hvac contractors" },
  { label: "Painters", query: "house painters" },
  { label: "Photographers", query: "photographers" },
  { label: "Personal Trainers", query: "personal trainers" },
  { label: "Yoga Studios", query: "yoga studios" },
  { label: "Gyms", query: "gyms" },
  { label: "Dentists", query: "dentists" },
  { label: "Chiropractors", query: "chiropractors" },
  { label: "Pet Groomers", query: "pet groomers" },
  { label: "Dog Walkers", query: "dog walking services" },
  { label: "Tutors", query: "tutoring services" },
  { label: "Music Teachers", query: "music teachers" },
  { label: "Florists", query: "florists" },
  // Yachts & Marine
  { label: "🛥 Yacht Charters", query: "yacht charter" },
  { label: "🛥 Yacht Sales", query: "yacht sales brokerage" },
  { label: "🛥 Yacht Rentals", query: "yacht rental" },
  { label: "🛥 Yacht Brokers", query: "yacht brokers" },
  { label: "🛥 Marinas", query: "yacht marina" },
  { label: "🛥 Yacht Repair", query: "yacht repair" },
  { label: "🛥 Yacht Maintenance", query: "yacht maintenance service" },
  { label: "🛥 Sailing Schools", query: "sailing school" },
  // Private aviation
  { label: "✈️ Private Jet Charter", query: "private jet charter" },
  { label: "✈️ Aircraft Sales", query: "aircraft sales" },
  { label: "✈️ Helicopter Tours", query: "helicopter tours" },
  { label: "✈️ VIP Aviation", query: "VIP aviation services" },
  // Luxury cars
  { label: "🚘 Ferrari Dealers", query: "ferrari dealer" },
  { label: "🚘 Lamborghini Dealers", query: "lamborghini dealer" },
  { label: "🚘 Rolls-Royce Dealers", query: "rolls royce dealer" },
  { label: "🚘 Bentley Dealers", query: "bentley dealer" },
  { label: "🚘 McLaren Dealers", query: "mclaren dealer" },
  { label: "🚘 Aston Martin Dealers", query: "aston martin dealer" },
  { label: "🚘 Porsche Dealers", query: "porsche dealer" },
  { label: "🚘 Exotic Car Rental", query: "exotic luxury car rental" },
  // Luxury real estate
  { label: "🏰 Luxury Real Estate", query: "luxury real estate agency" },
  { label: "🏰 Luxury Villas", query: "luxury villa rental" },
  { label: "🏰 Penthouses", query: "penthouse for sale" },
  { label: "🏰 Property Developers", query: "real estate developer" },
  { label: "🏰 Investment Property", query: "investment real estate firm" },
  // Luxury shopping
  { label: "💎 Jewelry Boutiques", query: "luxury jewelry boutique" },
  { label: "💎 Luxury Watches", query: "rolex patek philippe watch boutique" },
  { label: "💎 Designer Furniture", query: "designer luxury furniture showroom" },
  { label: "💎 Luxury Fashion", query: "luxury fashion boutique" },
  // Luxury hospitality
  { label: "🏨 5-Star Hotels", query: "5 star luxury hotel" },
  { label: "🏨 Boutique Hotels", query: "boutique hotel" },
  { label: "🏨 Luxury Resorts", query: "luxury resort" },
  { label: "🏨 Private Villas", query: "private luxury villa" },
  { label: "🏨 VIP Concierge", query: "VIP concierge service" },
  // Premium lifestyle
  { label: "🍷 Wineries", query: "winery" },
  { label: "🍷 Cigar Clubs", query: "cigar lounge club" },
  { label: "🍷 Private Clubs", query: "private members club" },
  { label: "🍷 Golf Clubs", query: "golf club" },
  { label: "🍷 Polo Clubs", query: "polo club" },
  // Premium health
  { label: "💉 Plastic Surgeons", query: "plastic surgeon clinic" },
  { label: "💉 Aesthetic Clinics", query: "aesthetic medicine clinic" },
  { label: "💉 Hair Transplant", query: "hair transplant clinic" },
  { label: "💉 IVF Clinics", query: "IVF fertility clinic" },
  { label: "💉 VIP Dental Clinics", query: "luxury dental clinic" },
  // B2B premium
  { label: "👔 Law Firms", query: "law firm" },
  { label: "👔 Investment Firms", query: "investment firm" },
  { label: "👔 Family Offices", query: "family office wealth" },
  { label: "👔 Wealth Management", query: "wealth management firm" },
  { label: "👔 Business Consulting", query: "business consulting firm" },
];

function MapsProspector({ onBuildSiteFor }: { onBuildSiteFor: (text: string) => void }) {
  const [category, setCategory] = useState<string>(CATEGORIES[0].query);
  const [location, setLocation] = useState<string>("Brooklyn, NY");
  const [onlyNoWebsite, setOnlyNoWebsite] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [stats, setStats] = useState<{ scanned: number; filtered: number; pages: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enrich, setEnrich] = useState<Record<string, LeadEnrichment>>({});

  // NEW — pin + radius mode
  const [usePin, setUsePin] = useState(true);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>({ lat: 40.6782, lng: -73.9442 });
  const [radius, setRadius] = useState<number>(32187); // 20 miles in meters
  const [pickMode, setPickMode] = useState(false);

  // Plan + usage badge
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const fetchUsage = useServerFn(getMyUsage);
  const canUseAllCategories = usage?.plan === "pro" || usage?.plan === "agency";

  // Mobile: which pane is showing (map vs list/controls)
  const [mobilePane, setMobilePane] = useState<"list" | "map">("list");

  // AI assistant
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReason, setAiReason] = useState<string | null>(null);
  const [autoRun, setAutoRun] = useState(0);
  const [aiQueryOverride, setAiQueryOverride] = useState<string | null>(null);
  const callParse = useServerFn(parseLeadQuery);

  useEffect(() => {
    let alive = true;
    void fetchUsage().then((u) => { if (alive) setUsage(u); }).catch(() => {});
    return () => { alive = false; };
  }, [fetchUsage]);

  const query = useMemo(() => {
    // "__ALL__" = generic catch-all; biased by pin so it returns nearby businesses.
    const base = aiQueryOverride && aiQueryOverride.trim()
      ? aiQueryOverride.trim()
      : (category === "__ALL__" ? "businesses" : category);
    if (usePin && pin) return base;
    return `${base} in ${location}`.trim();
  }, [category, location, usePin, pin, aiQueryOverride]);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoRef = useRef<any>(null);
  const pinMarkerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const clickListenerRef = useRef<any>(null);

  // Initialise the map once.
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !mapRef.current || mapInstance.current) return;
        mapInstance.current = new g.maps.Map(mapRef.current, {
          center: pin ?? { lat: 40.6782, lng: -73.9442 },
          zoom: 13,
          disableDefaultUI: false,
          clickableIcons: false,
        });
        infoRef.current = new g.maps.InfoWindow();
      })
      .catch((e) => setError(String(e.message ?? e)));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render / update pin marker + radius circle
  useEffect(() => {
    const g = (window as any).google;
    if (!g || !mapInstance.current) return;

    if (!usePin || !pin) {
      pinMarkerRef.current?.setMap(null); pinMarkerRef.current = null;
      circleRef.current?.setMap(null); circleRef.current = null;
      return;
    }

    if (!pinMarkerRef.current) {
      pinMarkerRef.current = new g.maps.Marker({
        position: pin,
        map: mapInstance.current,
        draggable: true,
        zIndex: 9999,
        icon: {
          path: "M 0,-18 C -7,-18 -12,-12 -12,-6 C -12,2 0,16 0,16 C 0,16 12,2 12,-6 C 12,-12 7,-18 0,-18 Z",
          fillColor: "#0f172a",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 1.2,
          anchor: new g.maps.Point(0, 16),
        },
      });
      pinMarkerRef.current.addListener("dragend", (e: any) => {
        setPin({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      });
    } else {
      pinMarkerRef.current.setPosition(pin);
      pinMarkerRef.current.setMap(mapInstance.current);
    }

    if (!circleRef.current) {
      circleRef.current = new g.maps.Circle({
        map: mapInstance.current,
        center: pin,
        radius,
        strokeColor: "#10b981",
        strokeOpacity: 0.7,
        strokeWeight: 1.5,
        fillColor: "#10b981",
        fillOpacity: 0.08,
        clickable: false,
      });
    } else {
      circleRef.current.setCenter(pin);
      circleRef.current.setRadius(radius);
      circleRef.current.setMap(mapInstance.current);
    }
  }, [pin, radius, usePin]);

  // Map click → place pin (when pickMode active)
  useEffect(() => {
    const g = (window as any).google;
    if (!g || !mapInstance.current) return;
    if (clickListenerRef.current) {
      g.maps.event.removeListener(clickListenerRef.current);
      clickListenerRef.current = null;
    }
    if (pickMode) {
      clickListenerRef.current = mapInstance.current.addListener("click", (e: any) => {
        setPin({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        setUsePin(true);
        setPickMode(false);
      });
      mapInstance.current.setOptions({ draggableCursor: "crosshair" });
    } else {
      mapInstance.current.setOptions({ draggableCursor: null });
    }
  }, [pickMode]);

  // Render result markers when places change.
  useEffect(() => {
    const g = (window as any).google;
    if (!g || !mapInstance.current) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (places.length === 0) return;
    const bounds = new g.maps.LatLngBounds();
    places.forEach((p) => {
      if (p.lat == null || p.lng == null) return;
      const marker = new g.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map: mapInstance.current,
        title: p.name,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: p.website ? "#94a3b8" : "#10b981",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      marker.addListener("click", () => {
        setSelectedId(p.id);
        infoRef.current?.setContent(renderPlaceInfoHtml(p));
        infoRef.current?.open({ anchor: marker, map: mapInstance.current });
      });
      markersRef.current.push(marker);
      bounds.extend({ lat: p.lat, lng: p.lng });
    });
    if (usePin && pin) {
      const cb = circleRef.current?.getBounds?.();
      if (cb) bounds.union(cb); else bounds.extend(pin);
    }
    if (!bounds.isEmpty()) mapInstance.current.fitBounds(bounds, 80);
  }, [places, usePin, pin]);

  const runSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading) return;
    if (usePin && !pin) { setError("Drop a pin on the map first."); return; }
    setLoading(true); setError(null);

    // Auth removed — places-search runs as guest.
    const authHeaders: Record<string, string> = {};

    // For "All", fan-out across many categories to cover every kind of place.
    // Gate "All categories" to Pro / Agency only.
    const hasOverride = !!(aiQueryOverride && aiQueryOverride.trim() && aiQueryOverride.trim() !== "businesses");
    const isAllMode = !hasOverride && category === "__ALL__";
    if (isAllMode && !canUseAllCategories) {
      setError("'All categories' is available on the Pro and Agency plans. Pick a specific category or upgrade.");
      setLoading(false);
      return;
    }
    const allQueries = CATEGORIES.filter((c) => c.query !== "__ALL__").map((c) => c.query);
    const queriesToRun = isAllMode
      ? allQueries.map((cat) => (usePin && pin ? cat : `${cat} in ${location}`.trim()))
      : [query];

    try {
      const results = await Promise.all(
        queriesToRun.map(async (q) => {
          const res = await fetch("/api/places-search", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({
              query: q,
              onlyNoWebsite,
              targetCount: isAllMode ? 40 : 100,
              center: usePin ? pin : null,
              radius: usePin ? radius : 32187,
              locationText: usePin ? undefined : location,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            if (res.status === 402 && data?.limitReached) {
              throw new Error(`${data.error} (${data.used}/${data.limit} searches used this month).`);
            }
            throw new Error(data.error ?? `HTTP ${res.status}`);
          }
          return data;
        }),
      );
      const merged = new Map<string, Place>();
      let scanned = 0, pages = 0;
      let latestUsage: UsageInfo | null = null;
      for (const r of results) {
        scanned += r.scanned ?? 0;
        pages += r.pages ?? 0;
        if (r.usage) latestUsage = r.usage as UsageInfo;
        for (const p of (r.places ?? []) as Place[]) {
          if (!merged.has(p.id)) merged.set(p.id, p);
        }
      }
      const list = Array.from(merged.values());
      setPlaces(list);
      setStats({ scanned, filtered: list.length, pages });
      if (latestUsage) setUsage(latestUsage);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPlaces([]); setStats(null);
      // Re-sync usage on failure (limit may have been consumed).
      void fetchUsage().then(setUsage).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  // When the AI assistant updates filters, auto-run a fresh search.
  useEffect(() => {
    if (autoRun === 0) return;
    void runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun]);

  const runAi = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const prompt = aiPrompt.trim();
    if (!prompt || aiLoading) return;
    setAiLoading(true);
    setError(null);
    setAiReason(null);
    try {
      const plan = await callParse({ data: { prompt } });
      // Use AI's free-form English search query directly. Reset to "__ALL__" so
      // the override drives the query, not the category dropdown.
      const sq = (plan.searchQuery ?? "").trim();
      setAiQueryOverride(sq && sq.toLowerCase() !== "businesses" ? sq : null);
      setCategory("__ALL__");
      setOnlyNoWebsite(!!plan.onlyNoWebsite);
      const r = Math.round(Math.max(0.3, Math.min(20, Number(plan.radiusMiles) || 5)) * METERS_PER_MILE);
      setRadius(r);
      if (plan.useMyLocation) {
        setUsePin(true);
        useMyLocation();
      } else if (plan.location && plan.location.trim()) {
        setUsePin(false);
        setLocation(plan.location.trim());
      }
      setAiReason(plan.reasoning || null);
      setAutoRun((n) => n + 1);
      setAiPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not parse your request.");
    } finally {
      setAiLoading(false);
    }
  };


  useEffect(() => {
    const targets = places.filter((p) => p.website && !enrich[p.id]).slice(0, 40);
    if (targets.length === 0) return;
    let cancelled = false;
    setEnrich((prev) => {
      const next = { ...prev };
      for (const p of targets) next[p.id] = { status: "pending" };
      return next;
    });
    const CONCURRENCY = 4;
    let i = 0;
    const worker = async () => {
      while (!cancelled && i < targets.length) {
        const p = targets[i++];
        try {
          const res = await fetch("/api/enrich-lead", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: p.website }),
          });
          if (!res.ok) throw new Error(String(res.status));
          const data = (await res.json()) as { email?: string | null; socials?: SocialLinks };
          if (cancelled) return;
          setEnrich((prev) => ({
            ...prev,
            [p.id]: { status: "done", email: data.email ?? null, socials: data.socials ?? {} },
          }));
        } catch {
          if (cancelled) return;
          setEnrich((prev) => ({ ...prev, [p.id]: { status: "error" } }));
        }
      }
    };
    const workers = Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () => worker());
    void Promise.all(workers);
    return () => { cancelled = true; };
  }, [places, enrich]);



  const focusOn = (p: Place) => {
    setSelectedId(p.id);
    if (p.lat != null && p.lng != null && mapInstance.current) {
      mapInstance.current.panTo({ lat: p.lat, lng: p.lng });
      mapInstance.current.setZoom(16);
    }
    // On mobile, jump to map so the user can see the pin/info window
    if (typeof window !== "undefined" && window.innerWidth < 768) setMobilePane("map");
  };

  const recenterToPin = () => {
    if (pin && mapInstance.current) {
      mapInstance.current.panTo(pin);
      mapInstance.current.setZoom(14);
    }
  };

  const useMyLocation = () => {
    setError(null);
    if (!navigator.geolocation) { setError("Geolocation not supported in this browser."); return; }
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setError("Geolocation requires HTTPS. Open the published site to use it.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUsePin(true);
        setPin(p);
        setPickMode(false);
        mapInstance.current?.panTo(p);
        mapInstance.current?.setZoom(14);
      },
      (err) => {
        const msg = err.code === err.PERMISSION_DENIED
          ? "Location permission denied. Enable it in your browser site settings."
          : err.code === err.POSITION_UNAVAILABLE
          ? "Location unavailable right now. Try again or drop a pin manually."
          : err.code === err.TIMEOUT
          ? "Location request timed out. Try again."
          : err.message || "Could not get your location.";
        setError(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const pitchEmail = (p: Place) => {
    const phone = p.phone ? ` They can be reached at ${p.phone}.` : "";
    onBuildSiteFor(
      `Build a modern, conversion-focused one-page website for "${p.name}" — a ${p.category ?? "local business"} located at ${p.address}.${phone} They currently have NO website. Include a hero, services / menu, location with embedded map, hours, reviews highlight (${p.rating ?? "good"}★ from ${p.reviews ?? "many"} reviews), and a strong contact / call-now CTA. Use a tasteful, on-brand visual style appropriate to the business.`,
    );
  };

  const radiusMiles = (radius / METERS_PER_MILE).toFixed(radius >= METERS_PER_MILE * 2 ? 0 : 1);

  const locationLabel = usePin && pin ? `${pin.lat.toFixed(3)}, ${pin.lng.toFixed(3)}` : (location || "—");
  const noSiteCount = places.filter((p) => !p.website).length;
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <main className="relative flex min-w-0 flex-1 flex-col overflow-y-auto bg-slate-50 text-slate-900">
      {/* Top bar */}
      <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-5">
        <div className="text-sm font-semibold text-slate-900">Dashboard</div>
        <form onSubmit={runSearch} className="mx-auto flex h-8 w-full max-w-xl items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 focus-within:border-emerald-400 focus-within:bg-white">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input
            value={location}
            onChange={(e) => { setLocation(e.target.value); setUsePin(false); }}
            placeholder="Search city, area or keywords"
            className="h-full flex-1 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
          <button type="submit" className="grid h-6 w-6 place-items-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700">
            <Search className="h-3 w-3" />
          </button>
        </form>
      </header>

      <div className="px-5 py-3">
        {/* Title row */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-base font-semibold text-slate-900">
            Found <span className="text-emerald-600">{noSiteCount || stats?.filtered || 0}</span> Businesses Without Websites in {locationLabel}
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { const el = document.getElementById("prospects-list"); el?.scrollIntoView({ behavior: "smooth" }); }}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Eye className="h-4 w-4" /> View Prospects
            </button>
            <button
              type="button"
              onClick={runSearch}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? "Scanning…" : "Find Leads"}
            </button>
          </div>
        </div>

        {/* AI Assistant */}
        <form
          onSubmit={runAi}
          className="mb-3 flex flex-col gap-2 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 p-3 shadow-sm sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-2 sm:flex-1">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-600 text-white shadow">
              <Sparkles className="h-4 w-4" />
            </span>
            <input
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder='Smart search: e.g. "Find barber shops in Brooklyn without a website within 3 miles"'
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={aiLoading || !aiPrompt.trim()}
            className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {aiLoading ? "Thinking…" : "Smart Search"}
          </button>
        </form>
        {aiReason && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{aiReason}</span>
          </div>
        )}

        {/* Filters + Map */}
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          {/* Filter card */}
          <form onSubmit={runSearch} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Location</label>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-emerald-400">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  <input
                    value={location}
                    onChange={(e) => { setLocation(e.target.value); setUsePin(false); }}
                    placeholder="Seattle, WA"
                    className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-600">Industry</label>
                  {usage && (
                    <Link
                      to="/subscription"
                      className="text-[10px] font-medium uppercase tracking-wider text-emerald-600 hover:text-emerald-700"
                      title={`${usage.used}/${usage.limit} searches used this month`}
                    >
                      {usage.plan} · {usage.remaining} left
                    </Link>
                  )}
                </div>
                <select
                  value={category}
                  onChange={(e) => {
                    if (e.target.value === "__ALL__" && !canUseAllCategories) {
                      window.location.href = "/subscription";
                      return;
                    }
                    setAiQueryOverride(null);
                    setCategory(e.target.value);
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none"
                >
                  {CATEGORIES.map((c) => {
                    const locked = c.query === "__ALL__" && !canUseAllCategories;
                    return (
                      <option key={c.query} value={c.query}>
                        {locked ? `${c.label} (Pro+)` : c.label}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Status</label>
                <select
                  value={onlyNoWebsite ? "no" : "all"}
                  onChange={(e) => setOnlyNoWebsite(e.target.value === "no")}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none"
                >
                  <option value="no">Unverified (No website)</option>
                  <option value="all">All businesses</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Search Radius</label>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-slate-500">Around pin</span>
                    <span className="text-xs font-semibold text-emerald-600">{radiusMiles} mi</span>
                  </div>
                  <input
                    type="range"
                    min={500}
                    max={32187}
                    step={500}
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                    <span>0.3 mi</span><span>20 mi</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPickMode((v) => !v)}
                  className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                    pickMode ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-700 hover:border-emerald-300"
                  }`}
                >
                  <MapPin className="h-3.5 w-3.5" /> {pickMode ? "Click map…" : "Drop pin"}
                </button>
                <button
                  type="button"
                  onClick={useMyLocation}
                  className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-700 hover:border-emerald-300"
                >
                  <Radio className="h-3.5 w-3.5" /> My location
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || (usePin ? !pin : !location.trim())}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? "Scanning…" : "Find Leads"}
              </button>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
              )}
              {!BROWSER_KEY && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Map disabled: missing browser key.
                </div>
              )}
            </div>
          </form>

          {/* Map */}
          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm min-h-[480px]">
            <div ref={mapRef} className="absolute inset-0 h-full w-full" />
            {pickMode && (
              <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-emerald-500 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 shadow">
                Click the map to drop your pin
              </div>
            )}
            <button
              type="button"
              onClick={recenterToPin}
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:text-emerald-600"
              aria-label="Recenter"
            >
              <MapPin className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Prospects List */}
        <div id="prospects-list" className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-slate-900">
              Prospects List <span className="text-slate-500">({places.length} Businesses)</span>
            </h2>
            <button type="button" className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700">
              Filters <span className="text-[10px]">▾</span>
            </button>
          </div>
          <div className="max-h-[58vh] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="w-8 px-3 py-2"><input type="checkbox" className="accent-emerald-600" /></th>
                  <th className="px-2 py-2 font-medium">Business</th>
                  <th className="px-2 py-2 font-medium">Owner</th>
                  <th className="px-2 py-2 font-medium">Industry</th>
                  <th className="px-2 py-2 font-medium">Location</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Contact</th>
                  <th className="px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {places.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                      {loading ? "Scanning Google Maps…" : "No prospects yet — run a search."}
                    </td>
                  </tr>
                )}
                {places.map((p) => {
                  const active = p.id === selectedId;
                  const phoneDigits = p.phone ? p.phone.replace(/[^+\d]/g, "") : null;
                  const waNumber = p.intlPhone ?? p.phone;
                  const waDigits = waNumber ? waNumber.replace(/[^\d]/g, "") : null;
                  const enr = enrich[p.id];
                  const enrichedEmail = enr?.email ?? null;
                  const email = enrichedEmail ?? guessEmailFromWebsite(p.website);
                  const isEmailVerified = !!enrichedEmail;
                  const socials = enr?.socials ?? {};
                  const enrichLoading = enr?.status === "pending";
                  const ownerMatch = p.name.match(/^([A-Z][a-z]+)(?:'s\b| &| and\b)/);
                  const ownerGuess = ownerMatch ? ownerMatch[1] : "—";
                  return (
                    <tr
                      key={p.id}
                      onClick={() => focusOn(p)}
                      className={`cursor-pointer border-t border-slate-100 transition-colors ${active ? "bg-emerald-50/60" : "hover:bg-slate-50"}`}
                    >
                      <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className="accent-emerald-600" />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <CategoryBadge place={p} />
                          <span className="font-medium text-slate-900">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-slate-600">{ownerGuess}</td>
                      <td className="px-2 py-1.5 text-slate-600">{p.category ?? "—"}</td>
                      <td className="px-2 py-1.5">
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          {p.address?.split(",").slice(-2).join(",").trim() || "—"}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        {p.website ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-emerald-100 text-[9px]">✓</span>
                            Site
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-600">
                            <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-rose-100 text-[9px]">✕</span>
                            No site
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {phoneDigits && (
                            <a href={`tel:${phoneDigits}`} title={`Call ${p.phone}`} className="grid h-6 w-6 place-items-center rounded-md bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700">
                              <Phone className="h-3 w-3" />
                            </a>
                          )}
                          {waDigits && (
                            <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noreferrer" title="WhatsApp" className="grid h-6 w-6 place-items-center rounded-md bg-slate-100 text-slate-600 hover:bg-green-100 hover:text-green-700">
                              <MessageCircle className="h-3 w-3" />
                            </a>
                          )}
                          {email && (
                            <a
                              href={`mailto:${email}`}
                              title={isEmailVerified ? `Email (verified): ${email}` : `Email (guess): ${email}`}
                              className={`relative grid h-6 w-6 place-items-center rounded-md ${isEmailVerified ? "bg-sky-100 text-sky-700 hover:bg-sky-200" : "bg-slate-100 text-slate-600 hover:bg-sky-100 hover:text-sky-700"}`}
                            >
                              <Mail className="h-3 w-3" />
                              {isEmailVerified && (
                                <span className="absolute -right-0.5 -top-0.5 grid h-2.5 w-2.5 place-items-center rounded-full bg-emerald-500 text-[7px] leading-none text-white">✓</span>
                              )}
                            </a>
                          )}
                          {p.website && (
                            <a href={p.website} target="_blank" rel="noreferrer" title="Website" className="grid h-6 w-6 place-items-center rounded-md bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-700">
                              <Globe className="h-3 w-3" />
                            </a>
                          )}
                          {socials.facebook && (
                            <a href={socials.facebook} target="_blank" rel="noreferrer" title="Facebook" className="grid h-6 w-6 place-items-center rounded-md bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700">
                              <Facebook className="h-3 w-3" />
                            </a>
                          )}
                          {socials.instagram && (
                            <a href={socials.instagram} target="_blank" rel="noreferrer" title="Instagram" className="grid h-6 w-6 place-items-center rounded-md bg-slate-100 text-slate-600 hover:bg-pink-100 hover:text-pink-700">
                              <Instagram className="h-3 w-3" />
                            </a>
                          )}
                          {socials.linkedin && (
                            <a href={socials.linkedin} target="_blank" rel="noreferrer" title="LinkedIn" className="grid h-6 w-6 place-items-center rounded-md bg-slate-100 text-slate-600 hover:bg-sky-100 hover:text-sky-800">
                              <Linkedin className="h-3 w-3" />
                            </a>
                          )}
                          {socials.twitter && (
                            <a href={socials.twitter} target="_blank" rel="noreferrer" title="X / Twitter" className="grid h-6 w-6 place-items-center rounded-md bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white">
                              <Twitter className="h-3 w-3" />
                            </a>
                          )}
                          {socials.tiktok && (
                            <a href={socials.tiktok} target="_blank" rel="noreferrer" title="TikTok" className="grid h-6 w-6 place-items-center rounded-md bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white">
                              <Music2 className="h-3 w-3" />
                            </a>
                          )}
                          {socials.youtube && (
                            <a href={socials.youtube} target="_blank" rel="noreferrer" title="YouTube" className="grid h-6 w-6 place-items-center rounded-md bg-slate-100 text-slate-600 hover:bg-red-100 hover:text-red-700">
                              <Youtube className="h-3 w-3" />
                            </a>
                          )}
                          {enrichLoading && (
                            <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                          )}
                          {!phoneDigits && !waDigits && !email && !p.website && !enrichLoading && (
                            <span className="text-[10px] text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {p.mapsUri && (
                            <a
                              href={p.mapsUri}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50"
                            >
                              <Eye className="h-3 w-3" /> View
                            </a>
                          )}
                          {!p.website && (
                            <button
                              onClick={() => pitchEmail(p)}
                              className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
                            >
                              Build site
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}


function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}

function renderPlaceInfoHtml(p: Place): string {
  const name = escapeHtml(p.name);
  const address = p.address ? escapeHtml(p.address) : "";
  const category = p.category ? escapeHtml(p.category) : "";
  const status = p.status === "OPERATIONAL" ? "" : p.status ? escapeHtml(p.status.replace(/_/g, " ").toLowerCase()) : "";
  const phoneRaw = p.phone ?? "";
  const phoneTxt = phoneRaw ? escapeHtml(phoneRaw) : "";
  const phoneHref = phoneRaw ? `tel:${phoneRaw.replace(/[^+\d]/g, "")}` : "";
  const website = p.website ? escapeHtml(p.website) : "";
  const websiteLabel = website ? escapeHtml(p.website!.replace(/^https?:\/\//, "").replace(/\/$/, "").slice(0, 40)) : "";
  const mapsUri = p.mapsUri ? escapeHtml(p.mapsUri) : "";
  const ratingHtml = p.rating != null
    ? `<div style="display:flex;align-items:center;gap:4px;margin-top:4px;font-size:13px;color:#0f172a">
         <span style="font-weight:600">${p.rating.toFixed(1)}</span>
         <span style="color:#f59e0b">★</span>
         ${p.reviews != null ? `<span style="color:#64748b">(${p.reviews.toLocaleString()})</span>` : ""}
       </div>` : "";
  const badges: string[] = [];
  if (category) badges.push(`<span style="background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:500">${category}</span>`);
  if (!p.website) badges.push(`<span style="background:#fce7f3;color:#be185d;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:500">No website</span>`);
  if (status) badges.push(`<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:500">${status}</span>`);

  const actions: string[] = [];
  if (mapsUri) actions.push(`<a href="${mapsUri}" target="_blank" rel="noopener" style="flex:1;text-align:center;background:#0f172a;color:#fff;padding:7px 10px;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none">Directions</a>`);
  if (website) actions.push(`<a href="${website}" target="_blank" rel="noopener" style="flex:1;text-align:center;background:#fff;color:#0f172a;border:1px solid #cbd5e1;padding:7px 10px;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none">Website</a>`);
  if (phoneHref) actions.push(`<a href="${phoneHref}" style="flex:1;text-align:center;background:#fff;color:#0f172a;border:1px solid #cbd5e1;padding:7px 10px;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none">Call</a>`);

  return `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;color:#0f172a;max-width:280px;padding:4px 2px">
      <div style="font-size:15px;font-weight:700;line-height:1.25">${name}</div>
      ${ratingHtml}
      ${badges.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${badges.join("")}</div>` : ""}
      ${address ? `<div style="margin-top:8px;font-size:12px;color:#475569;line-height:1.4">📍 ${address}</div>` : ""}
      ${phoneTxt ? `<div style="margin-top:4px;font-size:12px;color:#475569">📞 ${phoneTxt}</div>` : ""}
      ${websiteLabel ? `<div style="margin-top:4px;font-size:12px;color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🌐 ${websiteLabel}</div>` : ""}
      ${actions.length ? `<div style="display:flex;gap:6px;margin-top:10px">${actions.join("")}</div>` : ""}
    </div>
   `;
}



// Dark map style — keeps the HUD aesthetic consistent.
const DARK_MAP_STYLE: any[] = [
  { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#475569" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#0b3d2e" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#334155" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#020617" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#475569" }] },
];

/* =============================== TWILIO DIALER =============================== */

type CallEntry = {
  sid: string;
  to: string;
  from: string;
  status: string;
  startTime: string | null;
  duration: string | null;
  direction: string;
};

function TwilioDialer() {
  const callFn = useServerFn(makeTwilioCall);
  const numbersFn = useServerFn(listTwilioNumbers);
  const historyFn = useServerFn(listRecentCalls);

  const [numbers, setNumbers] = useState<{ phoneNumber: string; friendlyName: string }[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [bridgeTo, setBridgeTo] = useState("");
  const [mode, setMode] = useState<"speak" | "bridge">("speak");
  const [message, setMessage] = useState("Hello, this is a call from SolverHunt.");
  const [calling, setCalling] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [history, setHistory] = useState<CallEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const refreshHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const r = await historyFn();
      setHistory(r.calls);
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  }, [historyFn]);

  useEffect(() => {
    (async () => {
      try {
        const n = await numbersFn();
        setNumbers(n.numbers);
        if (n.numbers[0]) setFrom(n.numbers[0].phoneNumber);
      } catch {
        // ignore
      }
    })();
    refreshHistory();
  }, [numbersFn, refreshHistory]);

  const handleKey = (k: string) => setTo((v) => (v + k).slice(0, 20));
  const handleBack = () => setTo((v) => v.slice(0, -1));
  const handleClear = () => setTo("");

  const callable = from.trim() && to.trim() && (mode === "speak" || bridgeTo.trim());

  const placeCall = async () => {
    if (!callable || calling) return;
    setCalling(true);
    setFeedback(null);
    try {
      const r = await callFn({
        data: {
          from: from.trim(),
          to: to.trim(),
          bridgeTo: mode === "bridge" ? bridgeTo.trim() : undefined,
          message: mode === "speak" ? message : undefined,
        },
      });
      setFeedback({ kind: "ok", text: `Call ${r.status} (SID ${r.sid?.slice(0, 10)}…)` });
      setTimeout(refreshHistory, 1500);
    } catch (e) {
      setFeedback({ kind: "err", text: e instanceof Error ? e.message : "Call failed" });
    } finally {
      setCalling(false);
    }
  };

  const keys: string[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

  return (
    <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-gradient-to-br from-slate-950 via-[#0b1a2f] to-slate-950 text-white">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-white/5 px-6 py-4">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30">
          <PhoneCall className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight">Twilio Dialer</h1>
          <p className="text-xs text-slate-400">Place real calls through your connected Twilio account</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto grid w-full max-w-6xl gap-6 p-6 lg:grid-cols-[1fr_1.1fr]">
          {/* Dialer card */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl">
            {/* From + mode */}
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">From (your Twilio number)</label>
                {numbers.length > 0 ? (
                  <select
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
                  >
                    {numbers.map((n) => (
                      <option key={n.phoneNumber} value={n.phoneNumber}>
                        {n.friendlyName} — {n.phoneNumber}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    placeholder="+15558675309"
                    className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
                  />
                )}
              </div>

              {/* Mode toggle */}
              <div className="flex gap-1.5 rounded-xl border border-white/10 bg-slate-900/40 p-1">
                <button
                  onClick={() => setMode("speak")}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${mode === "speak" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "text-slate-400 hover:text-white"}`}
                >
                  Speak message
                </button>
                <button
                  onClick={() => setMode("bridge")}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${mode === "bridge" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "text-slate-400 hover:text-white"}`}
                >
                  Bridge two phones
                </button>
              </div>

              {/* Destination display */}
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-5 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">To</div>
                <div className="mt-1 min-h-[40px] truncate text-3xl font-light tracking-wider text-white">
                  {to || <span className="text-slate-600">+1 555 000 0000</span>}
                </div>
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-2.5">
                {keys.map((k) => (
                  <button
                    key={k}
                    onClick={() => handleKey(k)}
                    className="group relative grid h-14 place-items-center rounded-2xl border border-white/5 bg-gradient-to-b from-white/[0.06] to-white/[0.02] text-xl font-medium text-white transition active:scale-95 hover:border-emerald-400/40 hover:from-emerald-500/10"
                  >
                    {k}
                  </button>
                ))}
                <button
                  onClick={() => handleKey("+")}
                  className="grid h-14 place-items-center rounded-2xl border border-white/5 bg-white/[0.04] text-base font-semibold text-slate-300 transition active:scale-95 hover:border-emerald-400/40"
                >
                  +
                </button>
                <button
                  onClick={placeCall}
                  disabled={!callable || calling}
                  className="grid h-14 place-items-center rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/40 transition active:scale-95 hover:shadow-emerald-500/60 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-800 disabled:shadow-none"
                  title="Call"
                >
                  {calling ? <Loader2 className="h-5 w-5 animate-spin" /> : <PhoneCall className="h-5 w-5" />}
                </button>
                <button
                  onClick={handleBack}
                  className="grid h-14 place-items-center rounded-2xl border border-white/5 bg-white/[0.04] text-slate-300 transition active:scale-95 hover:border-rose-400/40 hover:text-rose-300"
                  title="Backspace"
                >
                  <Delete className="h-4 w-4" />
                </button>
              </div>

              {/* Bridge / message inputs */}
              {mode === "bridge" ? (
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Bridge to (second leg)</label>
                  <input
                    value={bridgeTo}
                    onChange={(e) => setBridgeTo(e.target.value)}
                    placeholder="+15558675310"
                    className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-500">Twilio will call <span className="text-slate-300">To</span> first, then bridge them to this number.</p>
                </div>
              ) : (
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Message (text-to-speech)</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
                  />
                </div>
              )}

              {/* Quick actions */}
              <div className="flex items-center gap-2">
                <button onClick={handleClear} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:border-white/20 hover:text-white">Clear</button>
                <div className="ml-auto text-[11px] text-slate-500">E.164 format, e.g. +15558675309</div>
              </div>

              {feedback && (
                <div
                  className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${
                    feedback.kind === "ok"
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                      : "border-rose-400/30 bg-rose-500/10 text-rose-200"
                  }`}
                >
                  {feedback.kind === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  <span>{feedback.text}</span>
                </div>
              )}
            </div>
          </section>

          {/* Recent calls */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Recent calls</h2>
              <button
                onClick={refreshHistory}
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-slate-400 transition hover:border-emerald-400/40 hover:text-emerald-300"
                title="Refresh"
              >
                {loadingHistory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
              </button>
            </div>

            {history.length === 0 ? (
              <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
                <PhoneOff className="mb-2 h-7 w-7 text-slate-600" />
                <div className="text-sm text-slate-400">No calls yet</div>
                <div className="mt-1 text-xs text-slate-500">Place your first call from the dialer</div>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {history.map((c) => (
                  <li
                    key={c.sid}
                    className="group flex items-center gap-3 rounded-xl border border-white/5 bg-slate-900/40 px-3 py-2.5 transition hover:border-emerald-400/30 hover:bg-slate-900/70"
                  >
                    <div
                      className={`grid h-9 w-9 place-items-center rounded-lg ${
                        c.direction.includes("outbound") ? "bg-emerald-500/15 text-emerald-300" : "bg-sky-500/15 text-sky-300"
                      }`}
                    >
                      <PhoneCall className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-white">{c.direction.includes("outbound") ? c.to : c.from}</div>
                      <div className="truncate text-[11px] text-slate-500">
                        {c.direction} · {c.startTime ? new Date(c.startTime).toLocaleString() : "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          c.status === "completed"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : c.status === "failed" || c.status === "busy" || c.status === "no-answer"
                            ? "bg-rose-500/15 text-rose-300"
                            : "bg-slate-500/15 text-slate-300"
                        }`}
                      >
                        {c.status}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">{c.duration ? `${c.duration}s` : "—"}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

/* =============================== CUSTOM WEBSITE DESIGN =============================== */

function CustomWebsiteView() {
  const [iframeKey, setIframeKey] = useState(0);
  const url = "https://www.solverwebsite.com/";

  return (
    <main className="relative flex min-w-0 flex-1 flex-col bg-slate-50">
      <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 sm:gap-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">Custom Website Design</div>
            <div className="hidden truncate text-xs text-slate-500 sm:block">Live preview of solverwebsite.com</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs">
          <a
            href="https://www.solverwebsite.com/contact"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,0.6)] hover:opacity-95"
            style={{ background: "linear-gradient(135deg, rgb(16,185,129) 0%, rgb(20,184,166) 50%, rgb(59,130,246) 100%)" }}
          >
            <Mail className="h-3.5 w-3.5" /> Contact Us
          </a>
          <button
            onClick={() => setIframeKey((k) => k + 1)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RotateCw className="h-3.5 w-3.5" /> Reload
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open
          </a>
        </div>
      </header>
      <div className="relative min-h-0 flex-1 bg-slate-100 p-2">
        <iframe
          key={iframeKey}
          src={url}
          title="Custom Website Design"
          loading="eager"
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
          className="h-full w-full rounded-md border border-slate-200 bg-white shadow-sm"
        />
      </div>
    </main>
  );
}

/* =============================== WAITLIST =============================== */

const WAITLIST_CONTENT: Record<WaitlistTopic, {
  title: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  features: { icon: LucideIcon; title: string; description: string }[];
}> = {
  dialer: {
    title: "Dialer",
    tagline: "Smart outbound calling at scale",
    description: "One-click dialing, smart call routing, live transcription, and auto follow-ups for every lead in your pipeline.",
    icon: Phone,
    accent: "from-emerald-400 via-teal-500 to-cyan-500",
    features: [
      { icon: PhoneCall, title: "One-click outbound", description: "Tap to call any lead from Maps Prospector. Twilio numbers, local presence, instant connect." },
      { icon: Sparkles, title: "Smart voice agents", description: "Hand off cold calls to a custom-trained voice that books meetings while you sleep." },
      { icon: Radio, title: "Live transcripts", description: "Real-time speech-to-text with sentiment scoring and instant summaries after every call." },
      { icon: Zap, title: "Auto-followups", description: "Missed a call? A smart agent texts, emails, and re-dials on the perfect cadence." },
    ],
  },
  automations: {
    title: "Automations",
    tagline: "Workflows that close deals for you",
    description: "Connect SolverHunt to your CRM, email, WhatsApp, and calendar. Trigger sequences the moment a lead matches your perfect profile.",
    icon: Workflow,
    accent: "from-violet-400 via-fuchsia-500 to-pink-500",
    features: [
      { icon: Cpu, title: "Visual workflow builder", description: "Drag, drop, deploy. Build multi-step sequences without writing a single line of code." },
      { icon: Mail, title: "Multi-channel sequences", description: "Email, SMS, WhatsApp, and DMs orchestrated from one timeline per lead." },
      { icon: Zap, title: "Smart decision nodes", description: "Let the agent decide the next step based on lead behavior, reply tone, or website quality." },
      { icon: Globe, title: "1,000+ integrations", description: "Sync to HubSpot, Notion, Slack, Airtable, Sheets — anywhere your team lives." },
    ],
  },
  others: {
    title: "More coming soon",
    tagline: "The full SolverHunt operating system",
    description: "We're building an entire suite of tools around lead generation, outbound, and automated client delivery.",
    icon: Cpu,
    accent: "from-amber-400 via-orange-500 to-rose-500",
    features: [
      { icon: PenLine, title: "Proposal generator", description: "Auto-drafted, branded proposals based on the lead's industry and current website state." },
      { icon: Microscope, title: "Lead enrichment", description: "Owner names, emails, socials, and recent reviews pulled in one click." },
      { icon: DollarSign, title: "Invoicing & payments", description: "Send Stripe / PayPal invoices the moment a client says yes." },
      { icon: BookOpen, title: "Knowledge base", description: "Playbooks, scripts, and outbound templates curated by top operators." },
    ],
  },
};

function WaitlistView({ topic }: { topic: WaitlistTopic }) {
  const data = WAITLIST_CONTENT[topic];
  const Icon = data.icon;
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when topic changes
  useEffect(() => {
    setEmail("");
    setSubmitted(false);
    setError(null);
  }, [topic]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    try {
      const key = "solverhunt:waitlist";
      const raw = localStorage.getItem(key);
      const list: { email: string; topic: WaitlistTopic; at: number }[] = raw ? JSON.parse(raw) : [];
      list.push({ email: trimmed, topic, at: Date.now() });
      localStorage.setItem(key, JSON.stringify(list));
    } catch {
      // ignore storage errors
    }
    setError(null);
    setSubmitted(true);
  };

  return (
    <main className="relative flex min-w-0 flex-1 flex-col overflow-y-auto bg-slate-950 text-white">
      {/* Animated gradient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className={`absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-br ${data.accent} opacity-30 blur-3xl`} />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute bottom-1/4 left-0 h-[300px] w-[300px] rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 py-16 sm:px-8 sm:py-24">
        {/* Pill */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70 backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Coming soon · Join the waitlist
        </div>

        {/* Icon */}
        <div className={`mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br ${data.accent} shadow-2xl shadow-black/40 ring-1 ring-white/20`}>
          <Icon className="h-9 w-9 text-white drop-shadow" />
        </div>

        {/* Title */}
        <h1 className="text-center text-5xl font-bold tracking-tight sm:text-7xl">
          <span className={`bg-gradient-to-br ${data.accent} bg-clip-text text-transparent`}>
            {data.title}
          </span>
        </h1>
        <p className="mt-4 text-center text-lg font-medium text-white/80 sm:text-2xl">{data.tagline}</p>
        <p className="mt-4 max-w-2xl text-center text-sm leading-relaxed text-white/60 sm:text-base">
          {data.description}
        </p>

        {/* Waitlist form */}
        <div className="mt-10 w-full max-w-md">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-6 py-8 text-center backdrop-blur-md">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500/20">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
              <div className="text-lg font-semibold text-white">You're on the list!</div>
              <div className="text-sm text-white/70">
                We'll email <span className="font-medium text-emerald-300">{email}</span> the moment {data.title} is ready.
              </div>
              <button
                onClick={() => { setSubmitted(false); setEmail(""); }}
                className="mt-2 text-xs font-medium text-white/60 underline-offset-4 hover:text-white hover:underline"
              >
                Add another email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-1.5 backdrop-blur-md transition-all focus-within:border-white/30 focus-within:bg-white/10">
                <div className="flex items-center gap-2">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10">
                    <Mail className="h-4 w-4 text-white/70" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(null); }}
                    placeholder="you@company.com"
                    required
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className={`inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r ${data.accent} px-4 text-sm font-semibold text-white shadow-lg shadow-black/30 transition-transform hover:scale-[1.02] active:scale-[0.98]`}
                  >
                    Join <ArrowUp className="h-3.5 w-3.5 rotate-45" />
                  </button>
                </div>
              </div>
              {error && (
                <div className="flex items-center gap-1.5 px-2 text-xs text-rose-300">
                  <AlertCircle className="h-3 w-3" /> {error}
                </div>
              )}
              <div className="text-center text-[11px] text-white/40">
                No spam. Early access, founder updates, lifetime discount for waitlist members.
              </div>
            </form>
          )}
        </div>

        {/* Support Us */}
        <div className="mt-10 flex w-full max-w-md flex-col items-center gap-3">
          <a
            href="https://buy.stripe.com/eVqdR92AC49hbN40Xu5Rm00"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold text-white shadow-[0_12px_40px_-12px_rgba(244,114,182,0.7)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background:
                "linear-gradient(135deg, rgb(244,114,182) 0%, rgb(217,70,239) 50%, rgb(139,92,246) 100%)",
            }}
          >
            <Heart className="h-4 w-4" />
            Support Us
          </a>
          <p className="text-center text-xs text-white/50">
            Help us build the future of SolverHunt
          </p>
        </div>

        {/* Features grid */}
        <div className="mt-20 grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          {data.features.map((f) => {
            const FIcon = f.icon;
            return (
              <div
                key={f.title}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md transition-all hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className={`mb-4 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${data.accent} opacity-90 shadow-lg shadow-black/30 ring-1 ring-white/20`}>
                  <FIcon className="h-4 w-4 text-white" />
                </div>
                <div className="text-sm font-semibold text-white">{f.title}</div>
                <div className="mt-1.5 text-xs leading-relaxed text-white/60">{f.description}</div>
              </div>
            );
          })}
        </div>

        {/* Footer ribbon */}
        <div className="mt-16 flex items-center gap-2 text-[11px] text-white/40">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          <span>Built by the SolverHunt team · Shipping Q3 2026</span>
        </div>
      </div>
    </main>
  );
}
