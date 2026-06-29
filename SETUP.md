# Self-Hosting Setup (after downloading ZIP / cloning from GitHub)

This project runs on **TanStack Start v1 + Vite 7** and uses **Supabase** (Lovable Cloud) for DB/auth and **Stripe** for payments.

## 1. Install

```bash
bun install     # or: npm install / pnpm install
```

## 2. Environment variables

Create a `.env` file in the project root:

```env
# --- Supabase (copy from your Supabase project → Settings → API) ---
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...        # anon / publishable key
VITE_SUPABASE_PROJECT_ID=YOUR-PROJECT

SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...            # KEEP SECRET — server only

# --- AI Gateway (Lovable AI) ---
LOVABLE_API_KEY=lvbl_...                    # get from Lovable dashboard, or swap to OpenAI

# --- Google Maps (lead search) ---
GOOGLE_MAPS_API_KEY=AIza...                 # server-side Places API key
GOOGLE_MAPS_BROWSER_KEY=AIza...             # optional, browser-side

# --- Stripe (test or live) ---
STRIPE_SECRET_KEY=sk_test_...               # test key for trials
STRIPE_TRIAL_DAYS=7                         # free-trial length (default 7)
STRIPE_PRODUCT_STARTER=prod_...             # Stripe product IDs (create in dashboard)
STRIPE_PRODUCT_PRO=prod_...
STRIPE_PRODUCT_AGENCY=prod_...
```

## 3. Database

Run all migrations against your Supabase project:

```bash
supabase db push      # if you use the supabase CLI
# OR copy/paste the SQL from supabase/migrations/*.sql into the SQL editor
```

## 4. Run locally

```bash
bun run dev           # opens http://localhost:8080
```

## 5. Build & deploy

```bash
bun run build
bun run start         # production server
```

Deploys cleanly to **Cloudflare Workers**, **Vercel**, **Netlify**, **Fly.io**,
or any Node host. Set the same env vars in your host's dashboard.

## 6. Stripe trial subscriptions

- Pricing page is `/subscription`.
- Checkout asks for an email and opens Stripe Checkout with a **7-day free trial** (`STRIPE_TRIAL_DAYS`).
- Test cards: `4242 4242 4242 4242`, any future date, any CVC.
- Manage existing subscription → "Manage existing subscription" button → enter the same email → Stripe Customer Portal.

## 7. Web-Design templates

The 16-template library + animation/3D recipes live in `src/lib/web-templates/index.ts`. Edit that file to add/remove starters — the chat agent's system prompt rebuilds automatically from it.
