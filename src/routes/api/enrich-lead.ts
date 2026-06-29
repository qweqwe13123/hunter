import { createFileRoute } from "@tanstack/react-router";

// Scrape a business website for contact email + social links.
// Tries homepage + a few common contact paths. Best-effort, fast-fail.

const COMMON_PATHS = ["", "/contact", "/contact-us", "/about", "/about-us", "/impressum"];
const FETCH_TIMEOUT_MS = 6000;
const MAX_BYTES = 400_000;

interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  tiktok?: string;
  youtube?: string;
  whatsapp?: string;
}

const SOCIAL_PATTERNS: { key: keyof SocialLinks; re: RegExp }[] = [
  { key: "facebook", re: /https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/[A-Za-z0-9_.\-/?=&%]+/i },
  { key: "instagram", re: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.\-/?=&%]+/i },
  { key: "twitter", re: /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[A-Za-z0-9_.\-/?=&%]+/i },
  { key: "linkedin", re: /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in|school)\/[A-Za-z0-9_.\-/?=&%]+/i },
  { key: "tiktok", re: /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9_.\-/?=&%]+/i },
  { key: "youtube", re: /https?:\/\/(?:www\.)?youtube\.com\/(?:@|c\/|channel\/|user\/)[A-Za-z0-9_.\-/?=&%]+/i },
  { key: "whatsapp", re: /https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send)[A-Za-z0-9_.\-/?=&%]*/i },
];

const EMAIL_RE = /\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b/gi;
// Block obviously-bad matches: image filenames, tracking pixels, sentry/wix junk.
const EMAIL_BLOCK_RE = /(\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?)$|sentry|wixpress|example\.com|@2x|@3x|noreply|no-reply|donotreply|mailer-daemon)/i;

function scoreEmail(e: string): number {
  const lo = e.toLowerCase();
  if (/^(contact|info|hello|hi|sales|booking|reservations?|reception|office|admin|enquir)/.test(lo.split("@")[0])) return 10;
  if (/gmail|yahoo|hotmail|outlook|aol|icloud/.test(lo)) return 5;
  return 1;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SolverHuntBot/1.0; +https://solverhunt.app)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en;q=0.9",
      },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const reader = res.body?.getReader();
    if (!reader) return await res.text();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
    try { await reader.cancel(); } catch { /* ignore */ }
    const buf = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) { buf.set(c, o); o += c.byteLength; }
    return new TextDecoder("utf-8", { fatal: false }).decode(buf);
  } catch {
    return null;
  }
}

function extractFromHtml(html: string, found: { emails: Map<string, number>; socials: SocialLinks }) {
  // mailto: explicit
  const mailto = html.match(/mailto:([^"'\s>?]+)/gi);
  if (mailto) {
    for (const m of mailto) {
      const e = m.replace(/^mailto:/i, "").split("?")[0].trim();
      if (e && !EMAIL_BLOCK_RE.test(e)) {
        found.emails.set(e.toLowerCase(), (found.emails.get(e.toLowerCase()) ?? 0) + scoreEmail(e) + 20);
      }
    }
  }
  // plain text emails
  const matches = html.match(EMAIL_RE);
  if (matches) {
    for (const e of matches) {
      if (EMAIL_BLOCK_RE.test(e)) continue;
      found.emails.set(e.toLowerCase(), (found.emails.get(e.toLowerCase()) ?? 0) + scoreEmail(e));
    }
  }
  // socials
  for (const { key, re } of SOCIAL_PATTERNS) {
    if (found.socials[key]) continue;
    const m = html.match(re);
    if (m) {
      let url = m[0].replace(/["'<>]+$/, "");
      // drop sharer/intent links
      if (/sharer|share\.php|intent\/(tweet|post)|plugins\/like/.test(url)) continue;
      // strip trailing punctuation
      url = url.replace(/[).,;]+$/, "");
      found.socials[key] = url;
    }
  }
}

export const Route = createFileRoute("/api/enrich-lead")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { url?: string };
        try { body = (await request.json()) as { url?: string }; } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const raw = (body.url ?? "").trim();
        if (!raw) return Response.json({ error: "Missing url" }, { status: 400 });

        let base: URL;
        try {
          base = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
        } catch {
          return Response.json({ error: "Invalid url" }, { status: 400 });
        }

        const found = { emails: new Map<string, number>(), socials: {} as SocialLinks };

        // Fetch homepage first, then 1-2 contact pages in parallel.
        const home = await fetchText(base.toString());
        if (home) extractFromHtml(home, found);

        // If we already have a high-confidence contact email and 2+ socials, skip extras.
        const haveGood = [...found.emails.entries()].some(([, s]) => s >= 20);
        if (!haveGood || Object.keys(found.socials).length < 2) {
          const extras = await Promise.all(
            COMMON_PATHS.slice(1, 4).map((p) => fetchText(new URL(p, base).toString())),
          );
          for (const html of extras) if (html) extractFromHtml(html, found);
        }

        const bestEmail = [...found.emails.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([e]) => e)[0] ?? null;

        return Response.json({
          email: bestEmail,
          emails: [...found.emails.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([e]) => e),
          socials: found.socials,
        });
      },
    },
  },
});
